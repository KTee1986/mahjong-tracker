// pages/api/settleup-expense.js

import {
    loginSettleUpBackend,
    createSettleUpExpense
} from '../../lib/settleup-api';

// Helper function to get current timestamp
const getCurrentTimestamp = () => new Date().getTime();
// Helper function for float precision
const roundToPrecision = (num, precision = 20) => {
    if (isNaN(num) || !isFinite(num)) return 0;
    const factor = Math.pow(10, precision);
    const epsilon = Number.EPSILON * Math.abs(num);
    return Math.round((num + epsilon) * factor) / factor;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    // Check if SettleUp Sync is Enabled
    const isSettleUpSyncEnabled = process.env.ENABLE_SETTLEUP_SYNC === 'true';
    if (!isSettleUpSyncEnabled) {
        console.log("SettleUp Expense API: Sync is disabled via environment variable.");
        return res.status(200).json({ message: "SettleUp sync is disabled by configuration." });
    }

    // Expect structured players data: { East: [{ name, settleUpMemberId }, ...], ... }
    const { gameId, scores, players } = req.body;

    // Basic validation
    if (!gameId || !scores || typeof scores !== 'object' || !players || typeof players !== 'object') {
        return res.status(400).json({ error: 'Missing or invalid game data (gameId, scores, players) in request body.' });
    }
     if (Object.keys(scores).length === 0 || Object.keys(players).length === 0) {
         return res.status(400).json({ error: 'Scores and players objects cannot be empty.' });
     }

    // Get target group ID and backend email from environment
    const groupId = process.env.SETTLEUP_GROUP_ID;
    const backendEmail = process.env.SETTLEUP_BACKEND_EMAIL;

    if (!groupId) {
        console.error("Environment variable SETTLEUP_GROUP_ID is not set.");
        return res.status(500).json({ error: 'SettleUp group ID configuration missing on server.' });
    }
     if (!backendEmail) {
         console.error("Environment variable SETTLEUP_BACKEND_EMAIL is not set.");
         return res.status(500).json({ error: 'SettleUp backend email configuration missing on server.' });
     }
    console.log(`SettleUp Expense API: Using target group ID from env: ${groupId}`);

    let token;

    try {
        // --- Step 1: Log in using backend credentials ---
        console.log("SettleUp Expense API: Logging in with backend credentials...");
        const loginResult = await loginSettleUpBackend();
        token = loginResult.token;
        console.log("SettleUp Expense API: Backend login successful.");

        // --- Step 2: Aggregate scores by SettleUp Member ID (with partner split) ---
        console.log("SettleUp Expense API: Aggregating scores by SettleUp Member ID (with partner split)...");
        const aggregatedScores = {}; // Store { settleUpMemberId: totalScore }
        const mappingErrors = [];

        // Iterate through each seat to calculate individual contributions
        for (const seat in players) {
            const seatPlayers = players[seat]; // Array of { name, settleUpMemberId }
            const seatScore = scores[seat];    // Score for the entire seat

            if (!Array.isArray(seatPlayers) || seatPlayers.length === 0) {
                // Skip empty seats or seats with invalid data
                continue;
            }

            // Determine the number of players sharing the seat's score
            const numPlayersInSeat = seatPlayers.length;
            // Calculate the score per player in this seat
            const scorePerPlayer = seatScore / numPlayersInSeat;

            // Iterate through the player objects in the seat
            for (const playerObj of seatPlayers) {
                const memberId = playerObj?.settleUpMemberId;
                const playerName = playerObj?.name || '(Unknown Name)';

                if (!memberId) {
                    mappingErrors.push(`Missing SettleUp Member ID for player "${playerName}" in seat ${seat}.`);
                    // Don't stop aggregation for other players, just note the error
                    continue;
                }

                // Add this player's share of the seat score to their total
                const currentAggScore = aggregatedScores[memberId] || 0;
                aggregatedScores[memberId] = currentAggScore + scorePerPlayer;
                // Avoid rounding within the loop to maintain precision
            }
        }

        // Round final aggregated scores after all summing is done
        for (const memberId in aggregatedScores) {
             // Round to a reasonable precision for logic checks (e.g., 4 decimals)
             aggregatedScores[memberId] = roundToPrecision(aggregatedScores[memberId], 4);
        }

        // Check for mapping errors encountered during the loop
        if (mappingErrors.length > 0) {
            console.error("SettleUp Expense API: Player ID mapping errors:", mappingErrors);
            return res.status(400).json({ error: `Data mapping failed: ${mappingErrors.join(' ')}` });
        }
        console.log("SettleUp Expense API: Aggregated scores by Member ID (after split & rounding):", aggregatedScores);


        // --- Step 3: Construct the SettleUp Expense Payload (Calculated Weights) ---
        console.log("SettleUp Expense API: Constructing expense payload (Calculated Weights)...");

        let totalPositive = 0;
        let totalNegative = 0;
        const creditors = []; // Array of { memberId: string, score: number }
        const debtors = [];   // Array of { memberId: string, score: number } (score is negative)

        for (const memberId in aggregatedScores) {
            const score = aggregatedScores[memberId]; // Use the rounded score
            if (Math.abs(score) > 0.001) { // Use tolerance for zero check
                 if (score > 0) {
                     totalPositive += score;
                     creditors.push({ memberId: memberId, score: score });
                 } else {
                     totalNegative += score;
                     debtors.push({ memberId: memberId, score: score });
                 }
            }
        }
        // Round final totals to standard currency precision
        totalPositive = roundToPrecision(totalPositive, 2);
        totalNegative = roundToPrecision(totalNegative, 2);

        // Validation: Check if totals balance
        if (Math.abs(totalPositive + totalNegative) > 0.01) {
             console.error(`Internal calculation error: Aggregated scores do not sum to zero (${totalPositive + totalNegative}).`);
             throw new Error(`Internal calculation error: Aggregated scores do not sum to zero (${roundToPrecision(totalPositive + totalNegative, 2)}). Cannot create balanced expense.`);
        }

        // Handle cases with no activity or only one side
        if (creditors.length === 0 && debtors.length === 0) {
             console.log("SettleUp Expense API: All aggregated scores are zero, skipping SettleUp expense creation.");
             // Let logic proceed, payload check later will skip API call
        } else if (creditors.length === 0 || debtors.length === 0) {
             console.warn("SettleUp Expense API: Only creditors or only debtors found. Cannot calculate weights properly for a single expense. Skipping SettleUp sync.");
             // Let logic proceed, payload check later will skip API call
        }

        // --- Build the Payload ---
        let expensePayload = null;
        // Only build payload if there are both creditors and debtors AND totalPositive is > 0
        if (creditors.length > 0 && debtors.length > 0 && totalPositive > 0) {
             expensePayload = {
                 purpose: `Game Score Entry (ID: ${gameId})`,
                 dateTime: getCurrentTimestamp(),
                 currencyCode: "CAD", // Adjust if needed
                 type: "expense",
                 category: "🎲",
                 fixedExchangeRate: false,
                 exchangeRates: {},
                 receiptUrl: null,

                 // Calculate weights with high precision based on aggregated scores
                 whoPaid: creditors.map(creditor => ({
                     memberId: creditor.memberId,
                     weight: String(roundToPrecision(creditor.score / totalPositive)) // Default 20 decimals
                 })),

                 items: [
                     {
                         // Amount is the total positive value, rounded to currency precision
                         amount: String(totalPositive),

                         // Calculate weights with high precision based on aggregated scores
                         forWhom: debtors.map(debtor => ({
                             memberId: debtor.memberId,
                             weight: String(roundToPrecision(Math.abs(debtor.score) / totalPositive)) // Default 20 decimals
                         }))
                     }
                 ]
             };
        }


        // --- Step 4: Create the Expense in Settle Up (Conditional) ---
        let creationResult = null;
        let settleUpMessage = "SettleUp sync skipped (no balanced transaction needed)."; // Default message

        if (expensePayload) { // Only proceed if a valid payload was built
            // Basic check if payload seems valid
            if (expensePayload.items[0].forWhom.length === 0 || expensePayload.whoPaid.length === 0) {
                 console.warn("SettleUp Expense API: Payload generated but missing payers or participants. Skipping creation.");
                 settleUpMessage = "SettleUp sync skipped (missing payers or participants).";
            } else {
                 console.log("SettleUp Expense API: Payload to be sent:", JSON.stringify(expensePayload, null, 2));
                 console.log("SettleUp Expense API: Calling createSettleUpExpense...");
                 creationResult = await createSettleUpExpense(groupId, token, expensePayload);
                 settleUpMessage = "SettleUp expense created successfully."; // Update message on success
                 console.log("SettleUp Expense API: Expense creation successful.");
            }
        } else {
            console.log("SettleUp Expense API: Skipping SettleUp expense creation as payload conditions not met (e.g., only creditors/debtors, or all zero).");
        }


        // --- Step 5: Return Success Response ---
        return res.status(200).json({
            message: settleUpMessage, // Return appropriate message
            settleUpTransactionId: creationResult?.name // Will be null if skipped
        });

    } catch (error) {
        console.error(`SettleUp Expense API Error (User: ${backendEmail || 'Not Configured'}):`, error.message);
        let statusCode = 500;
        // ... (error handling as before) ...
        if (error.message.includes("Invalid backend Settle Up email or password") || error.message.includes("Authentication error") || error.message.includes("Backend SettleUp credentials missing")) { statusCode = 500; }
        else if (error.message.includes("Could not fetch") || error.message.includes("not found")) { statusCode = 404; }
        else if (error.message.includes("Failed to create Settle Up expense")) { statusCode = 502; }
        else if (error.message.includes("Data mapping failed")) { statusCode = 400; }
        else if (error.message.includes("calculation error")) { statusCode = 500; }
        else if (error.message.includes("configuration missing")) { statusCode = 500; }
        return res.status(statusCode).json({ error: error.message || "An internal server error occurred during SettleUp expense creation." });
    }
}
