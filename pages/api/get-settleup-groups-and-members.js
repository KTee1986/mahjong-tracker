// pages/api/get-settleup-groups-and-members.js

import {
    loginSettleUpBackend,
    getUserGroupIds,
    getGroupDetails,
    getGroupMembers,
    getGroupPermissions
} from '../../lib/settleup-api';

// Helper function to map permission level number to text
const mapPermissionLevel = (level) => {
    switch (level) {
        case 30: return 'Owner';
        case 20: return 'Read-Write';
        case 10: return 'Read-Only';
        default: return 'Unknown';
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
        // Step 1: Log in
        console.log("API Route (Backend Auth): Attempting login...");
        const loginResult = await loginSettleUpBackend();
        uid = loginResult.uid;
        token = loginResult.token;
        console.log("API Route (Backend Auth): Login successful.");

        // Step 2: Get Group IDs
        console.log("API Route (Backend Auth): Fetching group IDs...");
        const groupIdsObject = await getUserGroupIds(uid, token);
        if (!groupIdsObject) {
            console.log(`API Route (Backend Auth): User ${uid} has no groups.`);
            return res.status(200).json({ groupsWithMembers: [] });
        }
        const groupIds = Object.keys(groupIdsObject);
        console.log(`API Route (Backend Auth): Found group IDs: ${groupIds.join(', ')}`);

        // Step 3: Fetch Details, Members, and Permissions
        console.log("API Route (Backend Auth): Fetching details, members, and permissions...");
        const groupDataPromises = groupIds.map(async (id) => {
            try {
                const [details, membersObject, permissionsObject] = await Promise.all([
                    getGroupDetails(id, token),
                    getGroupMembers(id, token),
                    getGroupPermissions(id, token)
                ]);

                let membersArray = [];
                let fetchError = false;

                if (membersObject === null) {
                    console.warn(`API Route (Backend Auth): Failed to fetch members for group ${id}.`);
                    fetchError = true;
                } else {
                    // *** MODIFIED: Use firebaseUid (or correct field name) for lookup ***
                    membersArray = Object.entries(membersObject).map(([memberId, memberData]) => {
                        // --- Adjust this line based on your actual data structure ---
                        const userFirebaseUid = memberData?.firebaseUid; // <-- ASSUMING this field exists in memberData
                        // --- End Adjustment ---

                        let permissionLevel = undefined; // Default if UID is missing or not found in permissions
                        let permissionText = 'Unknown'; // Default text

                        if (userFirebaseUid && permissionsObject) {
                            // Use the fetched Firebase UID to look up the permission
                            const permissionData = permissionsObject[userFirebaseUid];
                            permissionLevel = permissionData?.level;
                            permissionText = mapPermissionLevel(permissionLevel);
                            // Log if UID was found but no permission level (might indicate data issue)
                            // if (permissionData && typeof permissionLevel === 'undefined') {
                            //     console.warn(`Permission data found for UID ${userFirebaseUid} in group ${id}, but 'level' property is missing.`);
                            // }
                        } else if (!userFirebaseUid) {
                             console.warn(`Firebase UID field ('firebaseUid') missing for member ${memberData?.name || memberId} in group ${id}. Cannot map permission.`);
                             permissionText = 'N/A (No UID)';
                        } else {
                             // permissionsObject might be null if fetch failed
                             permissionText = 'N/A (Perms Fetch Failed)';
                        }


                        return {
                            memberId: memberId,
                            name: memberData?.name || '(No Name)',
                            active: memberData?.active === true,
                            permission: permissionText // Use the mapped text
                        };
                    });
                    // *** END MODIFIED ***
                }

                if (details === null) {
                    console.warn(`API Route (Backend Auth): Failed to fetch details for group ${id}.`);
                    fetchError = true;
                }
                 if (permissionsObject === null) {
                    console.warn(`API Route (Backend Auth): Failed to fetch permissions for group ${id}. Permission levels might be missing.`);
                    // Note: We still try to build the members array above, permissions will just be N/A
                 }

                return {
                    id: id,
                    name: details?.name || '(No Name / Fetch Failed)',
                    members: membersArray,
                    fetchError: fetchError
                };
            } catch (groupError) {
                console.error(`API Route (Backend Auth): Unexpected error fetching data for group ${id}:`, groupError);
                return { id: id, name: '(Error Fetching Data)', members: [], fetchError: true };
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
        if (error.message.includes("Invalid backend Settle Up email or password") || error.message.includes("Backend SettleUp credentials missing")) { statusCode = 500; }
        else if (error.message.includes("Authentication error")) { statusCode = 403; }
        else if (error.message.includes("Failed to initialize Firebase") || error.message.includes("Firebase Auth service not available")) { statusCode = 500; }
        else if (error.message.includes("Firebase configuration is incomplete")) { statusCode = 500; }
        else if (error.message.includes("not found") || error.message.includes("Could not fetch")) { statusCode = 404; }
        return res.status(statusCode).json({ error: error.message || "An internal server error occurred." });
    }
}
