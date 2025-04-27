// pages/api/get-settleup-groups-and-members.js

import {
    loginSettleUpBackend,
    getUserGroupIds,
    getGroupDetails,
    getGroupMembers,
    getGroupPermissions // Import the new function
} from '../../lib/settleup-api';

// Helper function to map permission level number to text
const mapPermissionLevel = (level) => {
    switch (level) {
        case 30: return 'Owner';
        case 20: return 'Read-Write';
        case 10: return 'Read-Only';
        default: return 'Unknown'; // Or 'Member' as a default fallback
    }
};

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

        // Step 3: Fetch Details, Members, and Permissions for each Group Concurrently
        console.log("API Route (Backend Auth): Fetching details, members, and permissions for each group...");
        const groupDataPromises = groupIds.map(async (id) => {
            try {
                // Fetch all three data points in parallel
                const [details, membersObject, permissionsObject] = await Promise.all([
                    getGroupDetails(id, token),
                    getGroupMembers(id, token),
                    getGroupPermissions(id, token) // Fetch permissions
                ]);

                let membersArray = [];
                let fetchError = false;

                // Check if fetching members failed
                if (membersObject === null) {
                    console.warn(`API Route (Backend Auth): Failed to fetch members for group ${id}.`);
                    fetchError = true;
                    // Attempt to continue without members if details/permissions fetched? Or mark error?
                    // Let's mark error and return empty members array for this group.
                } else {
                    // Process members and add permission level
                    membersArray = Object.entries(membersObject).map(([memberId, memberData]) => {
                        // *** ASSUMPTION: memberId from /members/ is the SAME as UID key in /permissions/ ***
                        const permissionData = permissionsObject ? permissionsObject[memberId] : null; // Find permission using memberId as key
                        const permissionLevel = permissionData?.level; // Get the level number

                        return {
                            memberId: memberId,
                            name: memberData?.name || '(No Name)',
                            active: memberData?.active === true,
                            // Add permission level description
                            permission: mapPermissionLevel(permissionLevel) // Map number to text
                            // Optionally include the raw level: permissionLevel: permissionLevel ?? null
                        };
                    });
                }

                // Check if fetching details failed
                if (details === null) {
                    console.warn(`API Route (Backend Auth): Failed to fetch details for group ${id}.`);
                    fetchError = true; // Mark error if details failed
                }
                 // Check if fetching permissions failed (optional, might not be critical for display)
                 if (permissionsObject === null) {
                    console.warn(`API Route (Backend Auth): Failed to fetch permissions for group ${id}. Permission levels might be missing.`);
                    // Decide if this constitutes a full fetchError or just missing data
                    // fetchError = true;
                 }


                return {
                    id: id,
                    name: details?.name || '(No Name / Fetch Failed)',
                    members: membersArray, // Array now includes permission text
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

        console.log("API Route (Backend Auth): Successfully prepared combined group and member data with permissions.");
        // Step 4: Return Combined Data
        return res.status(200).json({ groupsWithMembers });

    } catch (error) {
        console.error("API Route (Backend Auth) Error:", error.message);
        let statusCode = 500;
        // ... (error handling as before) ...
        if (error.message.includes("Invalid backend Settle Up email or password") || error.message.includes("Backend SettleUp credentials missing")) {
            statusCode = 500;
        } else if (error.message.includes("Authentication error")) {
             statusCode = 403;
        } else if (error.message.includes("Failed to initialize Firebase") || error.message.includes("Firebase Auth service not available")) {
             statusCode = 500;
        } else if (error.message.includes("Firebase configuration is incomplete")) {
             statusCode = 500;
        } else if (error.message.includes("not found") || error.message.includes("Could not fetch")) {
            statusCode = 404;
        }
        return res.status(statusCode).json({ error: error.message || "An internal server error occurred." });
    }
}
