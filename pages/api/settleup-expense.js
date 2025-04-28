// pages/api/settleup-expense.js

import {
    loginSettleUpBackend,
    createSettleUpExpense
} from '../../lib/settleup-api';

// Helper function to get current timestamp
const getCurrentTimestamp = () => new Date().getTime();

// *** MODIFIED: Helper function for float precision ***
// Defaults to 20 decimal places for weights, can be overridden for currency
const roundToPrecision = (num, precision = 20) => {
    // Using exponential notation to handle potential precision limits with large numbers of decimals
    if (isNaN(num) || !isFinite(num)) return 0; // Handle invalid inputs
    const factor = Math.pow(10, precision);
    // Add a smaller epsilon to mitigate floating point issues before rounding
    const epsilon = Number.EPSILON * Math.abs(num);
    return Math.round((num + epsilon) * factor) / factor;
}
// *** END MODIFIED ***


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

        // --- Step 2: Aggregate scores by SettleUp Member ID ---
        console.log("SettleUp Expense API: Aggregating scores by SettleUp Member ID...");
        const aggregatedScores = {}; // Store { settleUpMemberId: totalScore }
        const mappingErrors = [];

        for (const seat in players) {
            const seatPlayers = players[seat];
            const seatScore = scores[seat];
            if (!Array.isArray(seatPlayers)) continue;

            for (const playerObj of seatPlayers) {
                const memberId = playerObj?.settleUpMemberId;
                const playerName = playerObj?.name || '(Unknown Name)';
                if (!memberId) {
                    mappingErrors.push(`Missing SettleUp Member ID for player "${playerName}" in seat ${seat}.`);
                    continue;
                }
                // Summing with potentially higher precision internally
                const currentAggScore = aggregatedScores[memberId] || 0;
                // Avoid direct rounding here, sum first
                aggregatedScores[memberId] = currentAggScore + seatScore;
            }
        }

        // Round final aggregated scores after summing, using standard currency precision for comparison logic
        for (const memberId in aggregatedScores) {
             aggregatedScores[memberId] = roundToPrecision(aggregatedScores[memberId], 4); // Round to 4 for intermediate checks
        }


        if (mappingErrors.length > 0) {
            console.error("SettleUp Expense API: Player ID mapping errors:", mappingErrors);
            return res.status(400).json({ error: `Data mapping failed: ${mappingErrors.join(' ')}` });
        }
        console.log("SettleUp Expense API: Aggregated scores by Member ID (rounded):", aggregatedScores);

        // --- Step 3: Construct the SettleUp Expense Payload (High Precision Weights) ---
        console.log("SettleUp Expense API: Constructing expense payload (High Precision Weights)...");

        let totalPositive = 0;
        let totalNegative = 0;
        const creditors = []; // Array of { memberId: string, score: number }
        const debtors = [];   // Array of { memberId: string, score: number } (score is negative)

        for (const memberId in aggregatedScores) {
            const score = aggregatedScores[memberId]; // Use the 4-decimal rounded score for logic
            if (Math.abs(score) > 0.001) { // Use tolerance for zero check
                 if (score > 0) {
                     totalPositive += score;
                     creditors.push({ memberId: memberId, score: score });
                 } else {
                     totalNegative += score;
                     debtors.push({ memberId: memberId, score: score }); // Keep score negative
                 }
            }
        }
        // Round final totals to standard currency precision for validation and item amount
        totalPositive = roundToPrecision(totalPositive, 2);
        totalNegative = roundToPrecision(totalNegative, 2);

        // Validation: Check if totals balance (use tolerance appropriate for currency)
        if (Math.abs(totalPositive + totalNegative) > 0.01) {
             console.error(`Internal calculation error: Aggregated scores do not sum to zero (${totalPositive + totalNegative}).`);
             throw new Error(`Internal calculation error: Aggregated scores do not sum to zero (${roundToPrecision(totalPositive + totalNegative, 2)}). Cannot create balanced expense.`);
        }

        // Handle cases with no activity or only one side
        if (creditors.length === 0 && debtors.length === 0) {
             console.log("SettleUp Expense API: All aggregated scores are zero, skipping SettleUp expense creation.");
             return res.status(200).json({ message: "Game recorded to sheet, SettleUp expense skipped (all aggregated scores zero)." });
        }
        if (creditors.length === 0 || debtors.length === 0) {
             console.warn("SettleUp Expense API: Only creditors or only debtors found. Cannot calculate weights properly for a single expense. Skipping SettleUp sync.");
             return res.status(200).json({ message: "Game recorded to sheet, but SettleUp expense skipped (cannot represent one-sided balance)." });
        }

        // --- Build the Payload ---
        const expensePayload = {
            purpose: `Game Score Entry (ID: ${gameId})`,
            dateTime: getCurrentTimestamp(),
            currencyCode: "CAD", // Adjust if needed
            type: "expense",
            category: "🎲",
            fixedExchangeRate: false,
            exchangeRates: {},
            receiptUrl: null,

            // *** MODIFIED: Calculate weights with high precision ***
            whoPaid: creditors.map(creditor => ({
                memberId: creditor.memberId,
                // Weight calculation using high precision (default 20)
                weight: String(roundToPrecision(creditor.score / totalPositive))
            })),
            // *** END MODIFIED ***

            items: [
                {
                    // Amount is the total positive value (total paid), rounded to currency precision
                    amount: String(totalPositive),

                    // *** MODIFIED: Calculate weights with high precision ***
                    forWhom: debtors.map(debtor => ({
                        memberId: debtor.memberId,
                        // Weight calculation using high precision (default 20)
                        weight: String(roundToPrecision(Math.abs(debtor.score) / totalPositive))
                    }))
                    // *** END MODIFIED ***
                }
            ]
        };

        // Ensure item has participants (debtors)
        if (expensePayload.items[0].forWhom.length === 0) {
             console.warn("SettleUp Expense API: No debtors identified for the expense item. Skipping creation.");
             return res.status(200).json({ message: "Game recorded to sheet, SettleUp expense skipped (no debtors)." });
        }
         // Ensure there are payers (creditors)
         if (expensePayload.whoPaid.length === 0) {
             console.warn("SettleUp Expense API: No payers identified (creditors list empty). Skipping creation.");
             return res.status(200).json({ message: "Game recorded to sheet, SettleUp expense skipped (no creditors)." });
         }

        // --- Step 4: Log the payload and Create the Expense ---
        console.log("SettleUp Expense API: Payload to be sent:", JSON.stringify(expensePayload, null, 2));

        console.log("SettleUp Expense API: Calling createSettleUpExpense...");
        const creationResult = await createSettleUpExpense(groupId, token, expensePayload);

        // --- Step 5: Return Success Response ---
        console.log("SettleUp Expense API: Expense creation successful.");
        return res.status(200).json({
            message: "SettleUp expense created successfully.",
            settleUpTransactionId: creationResult?.name
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
