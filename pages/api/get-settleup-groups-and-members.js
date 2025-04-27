// pages/api/get-settleup-groups-and-members.js

import {
    loginSettleUp,
    getUserGroupIds,
    getGroupDetails,
    getGroupMembers
} from '../../lib/settleup-api'; // Import all necessary functions

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    let uid;
    let token;

    try {
        // --- Step 1: Log in ---
        console.log("API Route: Attempting login...");
        const loginResult = await loginSettleUp(email, password);
        uid = loginResult.uid;
        token = loginResult.token;
        console.log("API Route: Login successful.");

        // --- Step 2: Get User Group IDs ---
        console.log("API Route: Fetching group IDs...");
        const groupIdsObject = await getUserGroupIds(uid, token);

        // Handle case where user has no groups
        if (!groupIdsObject) {
            console.log(`API Route: User ${uid} has no groups.`);
            return res.status(200).json({ groupsWithMembers: [] }); // Return empty array
        }

        const groupIds = Object.keys(groupIdsObject);
        console.log(`API Route: Found group IDs: ${groupIds.join(', ')}`);

        // --- Step 3: Fetch Details and Members for each Group Concurrently ---
        console.log("API Route: Fetching details and members for each group...");
        const groupDataPromises = groupIds.map(async (id) => {
            try {
                // Fetch details and members in parallel for this group ID
                const [details, membersObject] = await Promise.all([
                    getGroupDetails(id, token),
                    getGroupMembers(id, token)
                ]);

                // Process members data if fetch was successful
                let membersArray = [];
                let fetchError = false;

                if (membersObject === null) {
                    // Indicate if members fetch failed specifically
                    console.warn(`API Route: Failed to fetch members for group ${id}.`);
                    fetchError = true; // Mark error if members couldn't be fetched
                } else {
                     // Convert members object to array
                    membersArray = Object.entries(membersObject).map(([memberId, memberData]) => ({
                        memberId: memberId,
                        name: memberData?.name || '(No Name)', // Handle potential missing name
                        active: memberData?.active === true // Ensure boolean true/false
                    }));
                }

                // Check if details fetch failed
                if (details === null) {
                    console.warn(`API Route: Failed to fetch details for group ${id}.`);
                    fetchError = true; // Also mark error if details failed
                }

                return {
                    id: id,
                    name: details?.name || '(No Name / Fetch Failed)', // Use fetched name or fallback
                    members: membersArray, // Include members array (might be empty if fetch failed)
                    fetchError: fetchError // Flag if details OR members fetch failed
                };
            } catch (groupError) {
                // Catch unexpected errors during Promise.all for a specific group
                console.error(`API Route: Unexpected error fetching data for group ${id}:`, groupError);
                return {
                    id: id,
                    name: '(Error Fetching Data)',
                    members: [],
                    fetchError: true // Mark error clearly
                };
            }
        });

        // Wait for all group data fetches to complete
        const groupsWithMembers = await Promise.all(groupDataPromises);

        console.log("API Route: Successfully prepared combined group and member data.");
        // --- Step 4: Return Combined Data ---
        return res.status(200).json({ groupsWithMembers });

    } catch (error) {
        // Catch errors from login, getUserGroupIds, or unexpected issues
        console.error("API Route Error:", error.message);

        // Return specific error statuses based on the error message
        if (error.message.includes("Invalid Settle Up email or password")) {
            return res.status(401).json({ error: error.message });
        }
        if (error.message.includes("Authentication error") || error.message.includes("authentication failed")) {
             return res.status(403).json({ error: "Settle Up authentication or authorization failed." });
        }
        if (error.message.includes("Failed to initialize Firebase") || error.message.includes("Firebase Auth service not available")) {
             return res.status(500).json({ error: "Internal server error: Firebase service initialization failed." });
        }
         if (error.message.includes("Firebase configuration is incomplete")) {
             return res.status(500).json({ error: "Internal server error: Firebase configuration missing." });
        }
        // Generic server error for other issues
        return res.status(500).json({ error: "An internal server error occurred." });
    }
}
