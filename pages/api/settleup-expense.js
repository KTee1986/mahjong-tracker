// pages/api/settleup-expense.js

import {
    loginSettleUpBackend,
    createSettleUpExpense
} from '../../lib/settleup-api';

// Helper function to get current timestamp
const getCurrentTimestamp = () => new Date().getTime();
// Helper function for float precision
const roundToTwoDecimals = (num) => Math.round((num + Number.EPSILON) * 100) / 100;


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
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
    const backendEmail = process.env.SETTLEUP_BACKEND_EMAIL; // Get email for potential error logging

    if (!groupId) {
        console.error("Environment variable SETTLEUP_GROUP_ID is not set.");
        return res.status(500).json({ error: 'SettleUp group ID configuration missing on server.' });
    }
     // Check if email is configured (needed for login)
     if (!backendEmail) {
         console.error("Environment variable SETTLEUP_BACKEND_EMAIL is not set.");
         return res.status(500).json({ error: 'SettleUp backend email configuration missing on server.' });
     }
    console.log(`SettleUp Expense API: Using target group ID from env: ${groupId}`);

    let token;

    try {
        // --- Step 1: Log in using backend credentials ---
        console.log("SettleUp Expense API: Logging in with backend credentials...");
        const loginResult = await loginSettleUpBackend(); // Uses env vars internally
        token = loginResult.token;
        console.log("SettleUp Expense API: Backend login successful.");

        // --- Step 2: Aggregate scores by SettleUp Member ID ---
        console.log("SettleUp Expense API: Aggregating scores by SettleUp Member ID...");
        const aggregatedScores = {}; // Store { settleUpMemberId: totalScore }
        const mappingErrors = [];

        for (const seat in players) {
            const seatPlayers = players[seat];
            const seatScore = scores[seat];

            if (!Array.isArray(seatPlayers)) {
                console.warn(`Invalid player data for seat ${seat}, expected array.`);
                continue;
            }

            for (const playerObj of seatPlayers) {
                const memberId = playerObj?.settleUpMemberId;
                const playerName = playerObj?.name || '(Unknown Name)';

                if (!memberId) {
                    mappingErrors.push(`Missing SettleUp Member ID for player "${playerName}" in seat ${seat}.`);
                    continue;
                }

                if (aggregatedScores.hasOwnProperty(memberId)) {
                    aggregatedScores[memberId] += seatScore;
                } else {
                    aggregatedScores[memberId] = seatScore;
                }
                 aggregatedScores[memberId] = roundToTwoDecimals(aggregatedScores[memberId]);
            }
        }

        if (mappingErrors.length > 0) {
            console.error("SettleUp Expense API: Player ID mapping errors:", mappingErrors);
            return res.status(400).json({ error: `Data mapping failed: ${mappingErrors.join(' ')}` });
        }
        console.log("SettleUp Expense API: Aggregated scores by Member ID:", aggregatedScores);

        // --- Step 3: Construct the SettleUp Expense Payload ---
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

        for (const memberId in aggregatedScores) {
            const totalScoreForMember = aggregatedScores[memberId];
            const roundedScore = roundToTwoDecimals(totalScoreForMember);

            if (roundedScore > 0) {
                totalPositive += roundedScore;
                creditors.push({ memberId: memberId, amount: roundedScore });
            } else if (roundedScore < 0) {
                totalNegative += roundedScore;
                debtors.push({ memberId: memberId, amount: roundedScore });
            }
        }
         totalPositive = roundToTwoDecimals(totalPositive);
         totalNegative = roundToTwoDecimals(totalNegative);

        if (Math.abs(totalPositive + totalNegative) > 0.01) {
             console.error(`Internal calculation error: Aggregated scores do not sum to zero (${totalPositive + totalNegative}). Check rounding or input scores.`);
             throw new Error(`Internal calculation error: Aggregated scores do not sum to zero (${roundToTwoDecimals(totalPositive + totalNegative)}). Cannot create balanced expense.`);
        }

        // Define Payer(s) and Participants (ASSUMPTION - TEST THIS with SettleUp API)
        if (creditors.length > 0) {
             expensePayload.whoPaid.push({ memberId: creditors[0].memberId, amount: totalPositive });
             for (const memberId in aggregatedScores) {
                 const finalScore = roundToTwoDecimals(aggregatedScores[memberId]);
                 if (Math.abs(finalScore) > 0.01) {
                     expensePayload.participants.push({
                         memberId: memberId,
                         spent: finalScore // Still assuming 'spent' reflects the final aggregated score
                     });
                 }
             }
        } else {
            if (debtors.length > 0) {
                 console.warn("SettleUp Expense API: Only debtors found after aggregation, cannot create expense with the current payer model.");
                 return res.status(200).json({ message: "Game recorded to sheet, but SettleUp expense skipped (no creditors after aggregation)." });
            } else {
                 console.log("SettleUp Expense API: All aggregated scores are zero, skipping SettleUp expense creation.");
                 return res.status(200).json({ message: "Game recorded to sheet, SettleUp expense skipped (all aggregated scores zero)." });
            }
        }

        if (expensePayload.participants.length === 0 && expensePayload.whoPaid.length > 0) {
             console.warn("SettleUp Expense API: Expense has a payer but no participants after filtering zero scores. Skipping creation.");
             return res.status(200).json({ message: "Game recorded to sheet, SettleUp expense skipped (no non-zero participants)." });
        }

        // --- Step 4: Log the payload and Create the Expense ---
        console.log("SettleUp Expense API: Payload to be sent:", JSON.stringify(expensePayload, null, 2)); // Pretty print JSON

        console.log("SettleUp Expense API: Calling createSettleUpExpense...");
        const creationResult = await createSettleUpExpense(groupId, token, expensePayload);

        // --- Step 5: Return Success Response ---
        console.log("SettleUp Expense API: Expense creation successful.");
        return res.status(200).json({
            message: "SettleUp expense created successfully.",
            settleUpTransactionId: creationResult?.name
        });

    } catch (error) {
        // *** MODIFIED: Added backendEmail to the error log ***
        console.error(`SettleUp Expense API Error (User: ${backendEmail || 'Not Configured'}):`, error.message);
        // *** END MODIFIED ***

        let statusCode = 500;
        // Determine status code based on error message
        if (error.message.includes("Invalid backend Settle Up email or password") || error.message.includes("Authentication error") || error.message.includes("Backend SettleUp credentials missing")) {
             statusCode = 500; // Indicate server config/auth issue
        } else if (error.message.includes("Could not fetch") || error.message.includes("not found")) {
             statusCode = 404;
        } else if (error.message.includes("Failed to create Settle Up expense")) {
             statusCode = 502; // Error communicating with SettleUp
        } else if (error.message.includes("Data mapping failed")) {
             statusCode = 400;
        } else if (error.message.includes("calculation error")) {
             statusCode = 500;
        } else if (error.message.includes("configuration missing")) {
            statusCode = 500; // Explicitly handle config errors caught earlier
        }

        return res.status(statusCode).json({ error: error.message || "An internal server error occurred during SettleUp expense creation." });
    }
}
