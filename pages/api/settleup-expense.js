// pages/api/settleup-expense.js

import {
    loginSettleUpBackend,
    getGroupMembers,        // Still need this
    findMemberIdByName,     // Still need this
    createSettleUpExpense   // Still need this
    // Removed findGroupIdByName import
} from '../../lib/settleup-api';

// Helper function to get current timestamp in milliseconds
const getCurrentTimestamp = () => new Date().getTime();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    // --- Get data from frontend request body ---
    const { gameId, scores, players } = req.body;

    // Basic validation of incoming data
    if (!gameId || !scores || typeof scores !== 'object' || !players || typeof players !== 'object') {
        return res.status(400).json({ error: 'Missing or invalid game data (gameId, scores, players) in request body.' });
    }
     if (Object.keys(scores).length === 0 || Object.keys(players).length === 0) {
         return res.status(400).json({ error: 'Scores and players objects cannot be empty.' });
     }

    // --- Get target group ID from environment ---
    const groupId = process.env.SETTLEUP_GROUP_ID; // Use the Group ID directly
    if (!groupId) {
        console.error("Environment variable SETTLEUP_GROUP_ID is not set.");
        return res.status(500).json({ error: 'SettleUp group ID configuration missing on server.' });
    }
    console.log(`SettleUp Expense API: Using target group ID from env: ${groupId}`);

    let token;
    let groupMembersObject;

    try {
        // --- Step 1: Log in using backend credentials ---
        console.log("SettleUp Expense API: Logging in with backend credentials...");
        // UID is not strictly needed here anymore as we have the group ID
        const loginResult = await loginSettleUpBackend();
        token = loginResult.token;
        console.log("SettleUp Expense API: Backend login successful.");

        // --- Step 2: Get all members of the target group (using the provided ID) ---
        console.log(`SettleUp Expense API: Fetching members for group ${groupId}...`);
        groupMembersObject = await getGroupMembers(groupId, token); // Use groupId from env var
        if (!groupMembersObject) {
             // Throw error if members can't be fetched for the configured group ID
             throw new Error(`Could not fetch members for configured group ID ${groupId}. Check ID, permissions or group existence.`);
        }
        console.log(`SettleUp Expense API: Fetched ${Object.keys(groupMembersObject).length} members.`);

        // --- Step 3: Map player names from game data to SettleUp Member IDs ---
        console.log("SettleUp Expense API: Mapping player names to member IDs...");
        const involvedMemberIds = {}; // Store { memberId: score }
        const playerErrors = [];

        for (const seat in players) {
            const playerNameString = players[seat];
            const seatScore = scores[seat];
            const playerNames = playerNameString.split('+').map(name => name.trim()).filter(name => name);

            if (playerNames.length === 0) continue;

            for (const playerName of playerNames) {
                 const memberId = findMemberIdByName(groupMembersObject, playerName);
                 if (!memberId) {
                     // Reference the configured group ID in the error message
                     playerErrors.push(`Player "${playerName}" not found in configured SettleUp group (ID: ${groupId}).`);
                 } else {
                     involvedMemberIds[memberId] = seatScore;
                 }
            }
        }

        if (playerErrors.length > 0) {
            console.error("SettleUp Expense API: Player mapping errors:", playerErrors);
            return res.status(400).json({ error: `Player mapping failed: ${playerErrors.join(' ')}` });
        }
        console.log("SettleUp Expense API: Player mapping successful:", involvedMemberIds);

        // --- Step 4: Construct the SettleUp Expense Payload ---
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
                     spent: involvedMemberIds[memberId] // Assuming 'spent' reflects the score directly
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
        // Pass the groupId from the environment variable
        const creationResult = await createSettleUpExpense(groupId, token, expensePayload);

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
        } else if (error.message.includes("Could not fetch members") || error.message.includes("not found")) {
            // Could indicate wrong group ID configured or permissions issue
            statusCode = 404; // Or 500 if it's a config error
        } else if (error.message.includes("Failed to create Settle Up expense")) {
             statusCode = 502;
        }
        return res.status(statusCode).json({ error: error.message || "An internal server error occurred during SettleUp expense creation." });
    }
}
