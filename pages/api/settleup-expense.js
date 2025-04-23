// /pages/api/settleup-expense.js

import axios from 'axios';
// Optional Firebase Admin SDK imports
// import admin from 'firebase-admin';
// import { initializeFirebaseAdmin } from '../../lib/firebaseAdmin';
// initializeFirebaseAdmin();

// --- Configuration ---
const SETTLE_UP_API_URL = process.env.NEXT_PUBLIC_SETTLE_UP_ENV === 'production'
  ? 'https://settle-up-live.firebaseio.com'
  : 'https://settle-up-sandbox.firebaseio.com';

const SETTLE_UP_GROUP_ID = process.env.SETTLE_UP_GROUP_ID;
const SETTLE_UP_CURRENCY_CODE = process.env.SETTLE_UP_CURRENCY_CODE || 'CAD';

/**
 * Placeholder: Get Firebase ID token (Implement based on your auth setup)
 * @param {import('next').NextApiRequest} req
 * @returns {Promise<string|null>}
 */
async function getFirebaseIdToken(req) {
  const authorization = req.headers.authorization;
  if (authorization && authorization.startsWith('Bearer ')) {
    const token = authorization.split('Bearer ')[1];
    // RECOMMENDED: Verify token
    return token;
  }
  console.warn("Firebase ID Token not found in request.");
  return null;
}

/**
 * Fetches player data from /api/players and creates a name -> Member ID map.
 * @param {import('next').NextApiRequest} req
 * @returns {Promise<object>} Map { playerName: memberId }
 */
async function getPlayerToMemberIdMap(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = process.env.VERCEL_URL || req.headers.host;
  const apiUrl = `${protocol}://${host}/api/players`;
  console.log(`Fetching player map from internal URL: ${apiUrl}`);
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`Failed to fetch player list. Status: ${response.status}`);
    const { data: players } = await response.json();
    if (!Array.isArray(players)) throw new Error("Invalid player data format.");

    const playerMap = {};
    players.forEach(player => {
      if (player.name && player.settleUpMemberId) {
        playerMap[player.name.trim()] = player.settleUpMemberId.trim();
      } else {
        console.warn(`Player data incomplete for ID ${player.id}. Missing name or settleUpMemberId.`);
      }
    });
    console.log(`Successfully built player map with ${Object.keys(playerMap).length} entries.`);
    return playerMap;
  } catch (error) {
    console.error("Error fetching/processing player data for Member ID map:", error);
    throw new Error(`Could not retrieve player mapping: ${error.message}`);
  }
}

// --- API Handler ---
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!SETTLE_UP_GROUP_ID) {
    console.error("SETTLE_UP_GROUP_ID environment variable is not set.");
    return res.status(500).json({ error: "Server configuration error [SUGI]" });
  }

  const firebaseIdToken = await getFirebaseIdToken(req);
  if (!firebaseIdToken) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid authentication token." });
  }

  const { gameId, scores, players } = req.body;
  if (!scores || !players || typeof scores !== 'object' || typeof players !== 'object') {
    return res.status(400).json({ error: "Invalid request body: Missing or malformed scores/players data." });
  }

  try {
    const memberIdMap = await getPlayerToMemberIdMap(req);
    if (Object.keys(memberIdMap).length === 0) {
        return res.status(500).json({ error: "Server configuration error: Could not load player mapping." });
    }

    // --- Transaction Logic ---
    const activePlayers = Object.entries(players)
        .filter(([seat, name]) => name && name.trim() !== '')
        .map(([seat, name]) => ({
            seat: seat,
            name: name.trim(),
            score: scores[seat] !== undefined ? parseFloat(scores[seat]) : NaN
        }))
        .filter(p => !isNaN(p.score));

    if (activePlayers.length < 2) {
         return res.status(400).json({ error: "Need at least two active players with valid scores." });
    }
    // Optional server-side sum check...

    const winners = activePlayers.filter(p => p.score > 0).sort((a, b) => b.score - a.score);
    const losers = activePlayers.filter(p => p.score < 0).sort((a, b) => a.score - b.score);

    if (winners.length === 0 || losers.length === 0) {
        console.log(`No clear winner/loser for GameID ${gameId}. No Settle Up transaction created.`);
        return res.status(200).json({ message: "Scores recorded, but no Settle Up transaction needed." });
    }

    const mainWinner = winners[0];
    const totalAmount = mainWinner.score; // Total amount is the winner's score

    // Helper to get Member IDs for a player string (potentially "Alice + Bob")
    const getMemberIdsForPlayerString = (playerString) => {
        const names = playerString.split(' + ').map(name => name.trim());
        const ids = names.map(name => memberIdMap[name]).filter(id => id);
        if (ids.length < names.length) {
             console.warn(`Could not find Member IDs for all names in "${playerString}".`);
        }
        return ids;
    };

    // Determine primary payer Member ID (handles multiple winners in a seat mapping to *different* IDs)
    const payerMemberIds = getMemberIdsForPlayerString(mainWinner.name);
    if (payerMemberIds.length === 0) {
        throw new Error(`Could not map winner '${mainWinner.name}' to Settle Up Member ID.`);
    }
    const primaryPayerMemberId = payerMemberIds[0]; // Still use the first ID for the main payer seat
    if (payerMemberIds.length > 1) {
        console.warn(`Winner seat "${mainWinner.name}" maps to multiple Member IDs. Using primary: ${primaryPayerMemberId}`);
    }


    // --- Aggregate losses per Settle Up Member ID ---
    const memberIdLosses = new Map(); // Use a Map: { memberId => totalLoss }

    losers.forEach(loser => {
        const individualNames = loser.name.split(' + ').map(name => name.trim());
        if (individualNames.length === 0) return; // Skip if name was empty/whitespace

        const lossPerPlayer = loser.score / individualNames.length; // Divide the seat's loss among players in it

        individualNames.forEach(name => {
            const memberId = memberIdMap[name]; // Get Member ID for this individual name
            if (memberId) {
                const currentLoss = memberIdLosses.get(memberId) || 0;
                // Accumulate the negative score (loss) for this Member ID
                memberIdLosses.set(memberId, currentLoss + lossPerPlayer);
            } else {
                console.error(`Could not find Settle Up Member ID for player name: ${name} in seat ${loser.seat}`);
                // Decide how to handle missing IDs - skip this player's contribution? Throw error?
            }
        });
    });


    if (memberIdLosses.size === 0) {
        // This could happen if all losers couldn't be mapped to Member IDs
        throw new Error(`Could not map any losers to Settle Up Member IDs with aggregated losses.`);
    }

    // --- Create recipientItems from aggregated losses ---
    const recipientItems = [];
    let totalAggregatedWeight = 0;
    for (const [memberId, totalLoss] of memberIdLosses.entries()) {
         const weight = Math.abs(totalLoss); // Weight is the absolute value of the total loss for this memberId
         recipientItems.push({
            memberId: memberId,
            weight: String(weight.toFixed(2)) // Use absolute value of summed loss as weight
         });
         totalAggregatedWeight += weight;
    }

     // Optional check: Ensure total weight matches total amount after aggregation
     if (Math.abs(totalAggregatedWeight - totalAmount) > 0.01) {
         console.warn(`Aggregated weight (${totalAggregatedWeight.toFixed(2)}) does not match total amount (${totalAmount.toFixed(2)}). Check mapping/calculation.`);
         // This might happen due to rounding or if some losers couldn't be mapped.
     }

    // Construct Settle Up Payload
    const payload = {
      category: '🏆',
      currencyCode: SETTLE_UP_CURRENCY_CODE,
      dateTime: Date.now(),
      purpose: `Mahjong Game Settlement (Game ${gameId || 'N/A'})`,
      type: 'expense',
      whoPaid: [
        {
          memberId: primaryPayerMemberId,
          weight: '1', // Single primary payer conceptually "covers" the expense
        },
      ],
      items: [
        {
          amount: String(totalAmount.toFixed(2)),
          forWhom: recipientItems, // Use the aggregated recipient items
        },
      ],
    };

    // Make the API Call to Settle Up
    const url = `${SETTLE_UP_API_URL}/transactions/${SETTLE_UP_GROUP_ID}.json`;
    console.log(`Posting aggregated expense to Settle Up: ${url}`);
    // console.log("Payload:", JSON.stringify(payload, null, 2)); // For debugging

    const response = await axios.post(url, payload, {
      params: { auth: firebaseIdToken },
      headers: { 'Content-Type': 'application/json' },
    });

    console.log('Settle Up API Response:', response.data);
    return res.status(200).json({ success: true, transactionId: response.data.name });

  } catch (error) {
    console.error('Error processing Settle Up expense:', error);
    let errorMessage = 'Failed to add expense to Settle Up.';
    if (error.response) {
      console.error('Settle Up Status:', error.response.status);
      console.error('Settle Up Data:', error.response.data);
      errorMessage = `Settle Up API Error: ${error.response.data?.error || error.message}`;
    } else {
      console.error('Error Message:', error.message);
       errorMessage = error.message;
    }
    // Avoid exposing detailed internal errors unless necessary
    if (errorMessage.includes("Could not map") || errorMessage.includes("mapping")) {
        errorMessage = "Configuration error: Could not map all players to Settle Up IDs.";
    }
    return res.status(500).json({ error: errorMessage });
  }
}