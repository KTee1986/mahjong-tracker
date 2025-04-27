// pages/api/get-settleup-user-groups.js
import { loginSettleUp, getUserGroupIds, getGroupDetails } from '../../lib/settleup-api';

export default async function handler(req, res) {
    // Ensure this is a POST request
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    let uid;
    let token;

    try {
        // --- Step 1: Log in to Settle Up ---
        // IMPORTANT: Using user-provided credentials here. See security note in settleup-api.js.
        const loginResult = await loginSettleUp(email, password);
        uid = loginResult.uid;
        token = loginResult.token;

        // --- Step 2: Get the IDs of the groups the user belongs to ---
        const groupIdsObject = await getUserGroupIds(uid, token);

        if (!groupIdsObject) {
            // User might be valid but belong to no groups
            console.log(`User ${uid} belongs to no groups.`);
            return res.status(200).json({ groups: [] }); // Return empty array
        }

        const groupIds = Object.keys(groupIdsObject);
        console.log(`User ${uid} is associated with group IDs:`, groupIds);

        // --- Step 3: Fetch details (specifically the name) for each group ---
        const groupDetailsPromises = groupIds.map(id =>
            getGroupDetails(id, token).catch(err => {
                // Log error fetching details for a specific group but don't fail the whole request
                console.error(`Failed to fetch details for group ${id}: ${err.message}`);
                return null; // Return null for groups that couldn't be fetched
            })
        );

        const groupDetailsResults = await Promise.all(groupDetailsPromises);

        // --- Step 4: Format the response ---
        const groups = groupDetailsResults
            .map((details, index) => {
                // Filter out null results (groups that failed to fetch)
                // and ensure details object and name exist
                if (details && details.name) {
                    return {
                        id: groupIds[index], // Get the ID from the original list
                        name: details.name,
                        // Add other details if needed and available
                    };
                }
                return null; // Exclude this group if details are missing/failed
            })
            .filter(group => group !== null); // Remove null entries

        console.log("Successfully prepared groups data for response:", groups);
        return res.status(200).json({ groups }); // Send the array of groups

    } catch (error) {
        // Handle errors from login, fetching group IDs, or other unexpected issues
        console.error("API Error in /api/get-settleup-user-groups:", error.message);

        // Check for specific error messages to return appropriate status codes
        if (error.message.includes("Invalid Settle Up email or password")) {
            return res.status(401).json({ error: error.message }); // Unauthorized
        }
        if (error.message.includes("Authentication failed")) {
            return res.status(403).json({ error: error.message }); // Forbidden / Auth Issue
        }
        // Generic server error for other cases
        return res.status(500).json({ error: "An internal server error occurred." });
    }
}
