// pages/api/settleup-expense.js

import {
    loginSettleUpBackend, // Use the backend login function
    findGroupIdByName,
    getGroupMembers,
    findMemberIdByName,
    createSettleUpExpense
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

    // --- Get target group name from environment ---
    const targetGroupName = process.env.SETTLEUP_GROUP_NAME;
    if (!targetGroupName) {
        console.error("Environment variable SETTLEUP_GROUP_NAME is not set.");
        return res.status(500).json({ error: 'SettleUp group configuration missing on server.' });
    }

    let token;
    let uid;
    let groupId;
    let groupMembersObject;

    try {
        // --- Step 1: Log in using backend credentials ---
        console.log("SettleUp Expense API: Logging in with backend credentials...");
        const loginResult = await loginSettleUpBackend(); // No args needed
        uid = loginResult.uid;
        token = loginResult.token;
        console.log("SettleUp Expense API: Backend login successful.");

        // --- Step 2: Find the target Group ID ---
        console.log(`SettleUp Expense API: Finding group ID for "${targetGroupName}"...`);
        groupId = await findGroupIdByName(targetGroupName, uid, token);
        if (!groupId) {
            throw new Error(`SettleUp group named "${targetGroupName}" not found or not accessible by backend user.`);
        }
        console.log(`SettleUp Expense API: Found group ID: ${groupId}`);

        // --- Step 3: Get all members of the target group ---
        console.log(`SettleUp Expense API: Fetching members for group ${groupId}...`);
        groupMembersObject = await getGroupMembers(groupId, token);
        if (!groupMembersObject) {
             throw new Error(`Could not fetch members for group ${groupId}. Check permissions or group existence.`);
        }
        console.log(`SettleUp Expense API: Fetched ${Object.keys(groupMembersObject).length} members.`);

        // --- Step 4: Map player names from game data to SettleUp Member IDs ---
        console.log("SettleUp Expense API: Mapping player names to member IDs...");
        const involvedMemberIds = {}; // Store { memberId: score }
        const playerErrors = [];

        // Iterate through the players involved in the game (passed from frontend)
        for (const seat in players) {
            const playerNameString = players[seat]; // e.g., "Alice" or "Bob + Charlie"
            const seatScore = scores[seat];

            // Handle potentially multiple players per seat string (e.g., "Bob + Charlie")
            const playerNames = playerNameString.split('+').map(name => name.trim()).filter(name => name);

            if (playerNames.length === 0) continue; // Skip empty seats

            // Find member ID for each player name
            for (const playerName of playerNames) {
                 const memberId = findMemberIdByName(groupMembersObject, playerName);
                 if (!memberId) {
                     playerErrors.push(`Player "${playerName}" not found in SettleUp group "${targetGroupName}".`);
                 } else {
                     // Assign the score to this memberId.
                     // If multiple players share a seat, they share the seat's score.
                     // SettleUp might require individual splits, this logic assumes the seat score applies to all in that seat.
                     // Adjust if SettleUp needs per-player amounts when sharing a seat.
                     involvedMemberIds[memberId] = seatScore;
                 }
            }
        }

        // If any player mapping failed, stop and report error
        if (playerErrors.length > 0) {
            console.error("SettleUp Expense API: Player mapping errors:", playerErrors);
            // Return 400 Bad Request because the input data (player names) doesn't match SettleUp group
            return res.status(400).json({ error: `Player mapping failed: ${playerErrors.join(' ')}` });
        }
        console.log("SettleUp Expense API: Player mapping successful:", involvedMemberIds);

        // --- Step 5: Construct the SettleUp Expense Payload ---
        console.log("SettleUp Expense API: Constructing expense payload...");
        const expensePayload = {
            purpose: `Game Score Entry (ID: ${gameId})`, // Descriptive purpose
            date: getCurrentTimestamp(), // Use current server time
            currency: "CAD", // Assuming CAD, adjust if needed or make configurable
            whoPaid: [], // Array of { memberId: amount }
            participants: [], // Array of { memberId: spent/owes? } - Structure depends heavily on SettleUp API
            type: "EXPENSE", // Common type
            // categoryId: "OPTIONAL_CATEGORY_ID", // Optional: Set if you use categories
        };

        let totalPositive = 0;
        let totalNegative = 0;
        const creditors = []; // { memberId: amount } - Amount is positive
        const debtors = [];   // { memberId: amount } - Amount is negative

        for (const memberId in involvedMemberIds) {
            const score = involvedMemberIds[memberId];
            if (score > 0) {
                totalPositive += score;
                creditors.push({ memberId: memberId, amount: score });
            } else if (score < 0) {
                totalNegative += score;
                debtors.push({ memberId: memberId, amount: score });
            }
            // Ignore players with score 0 for the expense calculation
        }

        // Basic validation: total score should be (close to) zero
        if (Math.abs(totalPositive + totalNegative) > 0.01) {
             throw new Error(`Internal calculation error: Scores do not sum to zero (${totalPositive + totalNegative}). Cannot create balanced expense.`);
        }

        // --- Define Payer(s) and Participants based on SettleUp API structure ---
        // **This is the most complex part and depends heavily on SettleUp's exact API requirements for splits.**
        // Common Pattern 1: One person pays the total positive amount, participants define what they owe/receive.
        if (creditors.length > 0) {
             // Let the first creditor pay the total amount
             expensePayload.whoPaid.push({ memberId: creditors[0].memberId, amount: totalPositive });

             // Define how much each participant "spent" (positive score) or "owes" (negative score)
             // SettleUp might use 'spent', 'weight', 'owes' etc. Assuming 'spent' for now.
             // 'spent' usually means the benefit received. For debtors, benefit is 0. For creditors, benefit is their positive score.
             // This might need adjustment based on testing SettleUp API.
             for (const memberId in involvedMemberIds) {
                 const score = involvedMemberIds[memberId];
                 expensePayload.participants.push({
                     memberId: memberId,
                     // 'spent' is often the benefit received. Debtors received 0 benefit from this transaction's perspective.
                     // Creditors 'spent' the negative of their score (they provided value). SettleUp might invert this. TEST NEEDED.
                     // Let's try setting 'spent' to the actual score value and see how SettleUp interprets it.
                     // A positive 'spent' might mean they received value, negative 'spent' means they provided value.
                     // Alternative: Use 'owes' if SettleUp supports it directly.
                     spent: score // **ASSUMPTION - TEST THIS**
                     // weight: 1 // Alternative if using weights
                 });
             }
        } else {
            // Handle edge case: all scores are 0? Or only debtors?
            // If only debtors, this model breaks. SettleUp might need a dummy payer or different structure.
            // For now, if no creditors, we can't create the expense with this model.
            if (debtors.length > 0) {
                 console.warn("SettleUp Expense API: Only debtors found, cannot create expense with the current payer model.");
                 // Optionally return a specific message or skip SettleUp creation
                 return res.status(200).json({ message: "Game recorded to sheet, but SettleUp expense skipped (no creditors)." });
            } else {
                 console.log("SettleUp Expense API: All scores are zero, skipping SettleUp expense creation.");
                 return res.status(200).json({ message: "Game recorded to sheet, SettleUp expense skipped (all scores zero)." });
            }
        }


        // --- Step 6: Create the Expense in Settle Up ---
        console.log("SettleUp Expense API: Calling createSettleUpExpense...");
        const creationResult = await createSettleUpExpense(groupId, token, expensePayload);

        // --- Step 7: Return Success Response ---
        console.log("SettleUp Expense API: Expense creation successful.");
        return res.status(200).json({
            message: "SettleUp expense created successfully.",
            settleUpTransactionId: creationResult?.name // Return the new transaction ID if available
        });

    } catch (error) {
        // Catch errors from any step
        console.error("SettleUp Expense API Error:", error.message);
        // Determine appropriate status code
        let statusCode = 500; // Default to Internal Server Error
        if (error.message.includes("Invalid backend Settle Up email or password") || error.message.includes("Authentication error")) {
            statusCode = 500; // Config/Auth issue on backend
        } else if (error.message.includes("not found") || error.message.includes("Could not fetch")) {
            statusCode = 404; // Resource not found (group, members)
        } else if (error.message.includes("Failed to create Settle Up expense")) {
             statusCode = 502; // Bad Gateway - error communicating with SettleUp
        }

        return res.status(statusCode).json({ error: error.message || "An internal server error occurred during SettleUp expense creation." });
    }
}
