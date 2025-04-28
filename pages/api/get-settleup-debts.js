// pages/api/get-settleup-debts.js

import {
    loginSettleUpBackend,
    getGroupMembers,
    getGroupDebts
} from '../../lib/settleup-api';

// Helper function for rounding currency
const roundCurrency = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

export default async function handler(req, res) {
    if (req.method !== 'POST') { // Using POST to easily trigger without query params
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    // Get target group ID and backend email from environment
    const groupId = process.env.SETTLEUP_GROUP_ID;
    const backendEmail = process.env.SETTLEUP_BACKEND_EMAIL; // For logging errors

    if (!groupId) {
        console.error("Environment variable SETTLEUP_GROUP_ID is not set.");
        return res.status(500).json({ error: 'SettleUp group ID configuration missing on server.' });
    }
    if (!backendEmail) {
        console.error("Environment variable SETTLEUP_BACKEND_EMAIL is not set.");
        return res.status(500).json({ error: 'SettleUp backend email configuration missing on server.' });
    }
    console.log(`SettleUp Debts API: Using target group ID from env: ${groupId}`);

    let token;

    try {
        // --- Step 1: Log in using backend credentials ---
        console.log("SettleUp Debts API: Logging in with backend credentials...");
        const loginResult = await loginSettleUpBackend();
        token = loginResult.token;
        console.log("SettleUp Debts API: Backend login successful.");

        // --- Step 2: Fetch Members and Debts Concurrently ---
        console.log(`SettleUp Debts API: Fetching members and debts for group ${groupId}...`);
        const [membersObject, debtsArray] = await Promise.all([
            getGroupMembers(groupId, token),
            getGroupDebts(groupId, token) // Expects array or null/[]
        ]);

        // Handle potential errors during fetch
        if (membersObject === null) {
            throw new Error(`Could not fetch members for group ${groupId}. Cannot process debts.`);
        }
        if (debtsArray === null) {
            throw new Error(`Could not fetch debts for group ${groupId}.`);
        }

        console.log(`SettleUp Debts API: Fetched ${Object.keys(membersObject).length} members and ${debtsArray.length} debt records.`);
        // Log fetched data for debugging if needed
        // console.log("Fetched Members:", JSON.stringify(membersObject, null, 2));
        // console.log("Fetched Debts:", JSON.stringify(debtsArray, null, 2));


        // --- Step 3: Process Debts and Map Member Names ---
        const processedDebts = debtsArray.map(debt => {
            // *** MODIFIED: Use 'debt.from' and 'debt.to' for lookup ***
            const fromMemberId = debt.from; // Use the correct key from the debt payload
            const toMemberId = debt.to;     // Use the correct key from the debt payload

            const fromMember = membersObject[fromMemberId]; // Look up using the ID from debt.from
            const toMember = membersObject[toMemberId];     // Look up using the ID from debt.to
            // *** END MODIFIED ***

            // Handle cases where member might not be found
            const fromName = fromMember?.name || `Unknown (${fromMemberId})`;
            const toName = toMember?.name || `Unknown (${toMemberId})`;

            // Validate amount
            const amount = parseFloat(debt.amount);
            if (isNaN(amount)) {
                console.warn(`Invalid amount found in debt record:`, debt);
                return null; // Skip this invalid record
            }

            return {
                fromId: fromMemberId, // Keep consistent internal key
                fromName: fromName,
                toId: toMemberId,     // Keep consistent internal key
                toName: toName,
                amount: roundCurrency(amount),
                currency: debt.currencyCode || 'N/A' // Use currencyCode if available
            };
        }).filter(debt => debt !== null); // Remove any invalid records skipped above

        console.log("SettleUp Debts API: Processed debts successfully.");
        // Log processed data for debugging if needed
        // console.log("Processed Debts:", JSON.stringify(processedDebts, null, 2));

        // --- Step 4: Return Processed Data ---
        return res.status(200).json({ debts: processedDebts });

    } catch (error) {
        console.error(`SettleUp Debts API Error (User: ${backendEmail || 'Not Configured'}):`, error.message);
        let statusCode = 500;
        // ... (more specific error handling based on message) ...
        if (error.message.includes("Invalid backend Settle Up email or password") || error.message.includes("Authentication error") || error.message.includes("Backend SettleUp credentials missing")) { statusCode = 500; }
        else if (error.message.includes("Could not fetch") || error.message.includes("not found")) { statusCode = 404; }
        else if (error.message.includes("configuration missing")) { statusCode = 500; }
        return res.status(statusCode).json({ error: error.message || "An internal server error occurred while fetching SettleUp debts." });
    }
}
