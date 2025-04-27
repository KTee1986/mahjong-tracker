// pages/api/settleup-expense.js

import {
    loginSettleUpBackend,
    createSettleUpExpense
    // Removed getGroupMembers, findMemberIdByName imports
} from '../../lib/settleup-api';

// Helper function to get current timestamp
const getCurrentTimestamp = () => new Date().getTime();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    // --- MODIFIED: Expect structured players data ---
    const { gameId, scores, players } = req.body; // players is now { East: [{ name, settleUpMemberId }, ...], ... }

    // Basic validation
    if (!gameId || !scores || typeof scores !== 'object' || !players || typeof players !== 'object') {
        return res.status(400).json({ error: 'Missing or invalid game data (gameId, scores, players) in request body.' });
    }
    if (Object.keys(scores).length === 0 || Object.keys(players).length === 0) {
         return res.status(400).json({ error: 'Scores and players objects cannot be empty.' });
     }
    // --- END MODIFIED ---

    // Get target group ID from environment
    const groupId = process.env.SETTLEUP_GROUP_ID;
    if (!groupId) {
        console.error("Environment variable SETTLEUP_GROUP_ID is not set.");
        return res.status(500).json({ error: 'SettleUp group ID configuration missing on server.' });
    }
    console.log(`SettleUp Expense API: Using target group ID from env: ${groupId}`);

    let token;

    try {
        // --- Step 1: Log in using backend credentials ---
        console.log("SettleUp Expense API: Logging in with backend credentials...");
        const loginResult = await loginSettleUpBackend();
        token = loginResult.token; // Still need token for createSettleUpExpense
        console.log("SettleUp Expense API: Backend login successful.");

        // --- Step 2: REMOVED - No need to fetch group members ---

        // --- Step 3: Map player IDs directly from input ---
        console.log("SettleUp Expense API: Extracting member IDs and scores...");
        const involvedMemberIds = {}; // Store { memberId: score }
        const mappingErrors = []; // Track potential issues

        // Iterate through the seats in the players object received from frontend
        for (const seat in players) {
            const seatPlayers = players[seat]; // Array of { name, settleUpMemberId }
            const seatScore = scores[seat]; // Score for this seat

            if (!Array.isArray(seatPlayers)) {
                console.warn(`Invalid player data for seat ${seat}, expected array.`);
                continue; // Skip this seat if data is malformed
            }

            // Iterate through player objects in the seat
            for (const playerObj of seatPlayers) {
                const memberId = playerObj?.settleUpMemberId;
                const playerName = playerObj?.name || '(Unknown Name)'; // For logging

                if (!memberId) {
                    // This indicates an issue with the data sent from frontend or fetched by frontend
                    mappingErrors.push(`Missing SettleUp Member ID for player "${playerName}" in seat ${seat}.`);
                } else {
                    // Assign the seat's score to this member ID.
                    // If multiple players are in a seat, they currently share the score.
                    // Adjust logic here if SettleUp requires individual amounts per member ID.
                    if (involvedMemberIds.hasOwnProperty(memberId)) {
                        // This shouldn't happen if frontend logic is correct (player only in one seat)
                        console.warn(`Member ID ${memberId} (${playerName}) found in multiple seats. Score might be overwritten.`);
                    }
                    involvedMemberIds[memberId] = seatScore;
                }
            }
        }

        // If any essential data was missing
        if (mappingErrors.length > 0) {
            console.error("SettleUp Expense API: Player ID mapping errors:", mappingErrors);
            // Return 400 Bad Request because the input data from frontend seems incomplete
            return res.status(400).json({ error: `Data mapping failed: ${mappingErrors.join(' ')}` });
        }
        console.log("SettleUp Expense API: Member ID extraction successful:", involvedMemberIds);

        // --- Step 4: Construct the SettleUp Expense Payload ---
        // (Logic remains the same as before, using involvedMemberIds map)
        console.log("SettleUp Expense API: Constructing expense payload...");
        const expensePayload = {
            purpose: `Game Score Entry (ID: ${gameId})`,
            date: getCurrentTimestamp(),
            currency: "CAD", // Adjust if needed
            whoPaid: [],
            participants: [],
            type: "EXPENSE",
        };

        let totalPositive = 0;
        let totalNegative = 0;
        const creditors = [];
        const debtors = [];

        for (const memberId in involvedMemberIds) {
            const score = involvedMemberIds[memberId];
            if (score > 0) {
                totalPositive += score;
                creditors.push({ memberId: memberId, amount: score });
            } else if (score < 0) {
                totalNegative += score;
                debtors.push({ memberId: memberId, amount: score });
            }
        }

        if (Math.abs(totalPositive + totalNegative) > 0.01) {
             throw new Error(`Internal calculation error: Scores do not sum to zero (${totalPositive + totalNegative}). Cannot create balanced expense.`);
        }

        // Define Payer(s) and Participants (ASSUMPTION - TEST THIS with SettleUp API)
        if (creditors.length > 0) {
             expensePayload.whoPaid.push({ memberId: creditors[0].memberId, amount: totalPositive });
             for (const memberId in involvedMemberIds) {
                 expensePayload.participants.push({
                     memberId: memberId,
                     spent: involvedMemberIds[memberId] // Still assuming 'spent' reflects the score directly
                 });
             }
        } else {
            if (debtors.length > 0) {
                 console.warn("SettleUp Expense API: Only debtors found, cannot create expense with the current payer model.");
                 return res.status(200).json({ message: "Game recorded to sheet, but SettleUp expense skipped (no creditors)." });
            } else {
                 console.log("SettleUp Expense API: All scores are zero, skipping SettleUp expense creation.");
                 return res.status(200).json({ message: "Game recorded to sheet, SettleUp expense skipped (all scores zero)." });
            }
        }


        // --- Step 5: Create the Expense in Settle Up ---
        console.log("SettleUp Expense API: Calling createSettleUpExpense...");
        const creationResult = await createSettleUpExpense(groupId, token, expensePayload); // Use groupId from env

        // --- Step 6: Return Success Response ---
        console.log("SettleUp Expense API: Expense creation successful.");
        return res.status(200).json({
            message: "SettleUp expense created successfully.",
            settleUpTransactionId: creationResult?.name
        });

    } catch (error) {
        console.error("SettleUp Expense API Error:", error.message);
        let statusCode = 500;
        if (error.message.includes("Invalid backend Settle Up email or password") || error.message.includes("Authentication error")) {
            statusCode = 500;
        } else if (error.message.includes("Could not fetch") || error.message.includes("not found")) {
            statusCode = 404; // Could indicate wrong group ID config
        } else if (error.message.includes("Failed to create Settle Up expense")) {
             statusCode = 502;
        } else if (error.message.includes("Data mapping failed")) {
             statusCode = 400; // Error in data sent from frontend
        }
        return res.status(statusCode).json({ error: error.message || "An internal server error occurred during SettleUp expense creation." });
    }
}
