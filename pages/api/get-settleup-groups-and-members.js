// pages/api/get-settleup-groups-and-members.js

import {
    loginSettleUpBackend,
    getUserGroupIds,
    getGroupDetails,
    getGroupMembers
    // Removed getGroupPermissions import
} from '../../lib/settleup-api';

// Removed mapPermissionLevel helper function

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    let uid;
    let token;

    try {
        // Step 1: Log in using backend credentials
        console.log("API Route (Backend Auth): Attempting login...");
        const loginResult = await loginSettleUpBackend();
        uid = loginResult.uid;
        token = loginResult.token;
        console.log("API Route (Backend Auth): Login successful.");

        // Step 2: Get User Group IDs
        console.log("API Route (Backend Auth): Fetching group IDs...");
        const groupIdsObject = await getUserGroupIds(uid, token);

        if (!groupIdsObject) {
            console.log(`API Route (Backend Auth): User ${uid} has no groups.`);
            return res.status(200).json({ groupsWithMembers: [] });
        }

        const groupIds = Object.keys(groupIdsObject);
        console.log(`API Route (Backend Auth): Found group IDs: ${groupIds.join(', ')}`);

        // Step 3: Fetch Details and Members for each Group Concurrently
        // *** REMOVED getGroupPermissions from Promise.all ***
        console.log("API Route (Backend Auth): Fetching details and members for each group...");
        const groupDataPromises = groupIds.map(async (id) => {
            try {
                // Fetch only details and members
                const [details, membersObject] = await Promise.all([
                    getGroupDetails(id, token),
                    getGroupMembers(id, token)
                    // Removed getGroupPermissions call
                ]);

                let membersArray = [];
                let fetchError = false;

                if (membersObject === null) {
                    console.warn(`API Route (Backend Auth): Failed to fetch members for group ${id}.`);
                    fetchError = true;
                } else {
                    // *** REVERTED: Simplified member object creation ***
                    membersArray = Object.entries(membersObject).map(([memberId, memberData]) => ({
                        memberId: memberId,
                        name: memberData?.name || '(No Name)',
                        active: memberData?.active === true
                        // Removed permission field
                    }));
                    // *** END REVERTED ***
                }

                if (details === null) {
                    console.warn(`API Route (Backend Auth): Failed to fetch details for group ${id}.`);
                    fetchError = true;
                }
                // Removed check/warning for permissionsObject === null

                return {
                    id: id,
                    name: details?.name || '(No Name / Fetch Failed)',
                    members: membersArray, // Array no longer includes permission
                    fetchError: fetchError
                };
            } catch (groupError) {
                console.error(`API Route (Backend Auth): Unexpected error fetching data for group ${id}:`, groupError);
                return {
                    id: id,
                    name: '(Error Fetching Data)',
                    members: [],
                    fetchError: true
                };
            }
        });

        const groupsWithMembers = await Promise.all(groupDataPromises);

        console.log("API Route (Backend Auth): Successfully prepared combined group and member data.");
        // Step 4: Return Combined Data
        return res.status(200).json({ groupsWithMembers });

    } catch (error) {
        console.error("API Route (Backend Auth) Error:", error.message);
        let statusCode = 500;
        // ... (error handling as before) ...
        if (error.message.includes("Invalid backend Settle Up email or password") || error.message.includes("Backend SettleUp credentials missing")) { statusCode = 500; }
        else if (error.message.includes("Authentication error")) { statusCode = 403; }
        else if (error.message.includes("Failed to initialize Firebase") || error.message.includes("Firebase Auth service not available")) { statusCode = 500; }
        else if (error.message.includes("Firebase configuration is incomplete")) { statusCode = 500; }
        else if (error.message.includes("not found") || error.message.includes("Could not fetch")) { statusCode = 404; }
        return res.status(statusCode).json({ error: error.message || "An internal server error occurred." });
    }
}
