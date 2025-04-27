// pages/api/get-settleup-user-groups.js

// --- Use import for the helper functions (ES Module style) ---
import { loginSettleUp, getUserGroupIds, getGroupDetails } from '../../lib/settleup-api';

// Define the main handler function using standard export default
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
        // Uses the v9 modular functions imported from the lib
        const loginResult = await loginSettleUp(email, password);
        uid = loginResult.uid;
        token = loginResult.token;

        // --- Step 2: Get the IDs of the groups the user belongs to ---
        const groupIdsObject = await getUserGroupIds(uid, token);

        if (!groupIdsObject) {
            console.log(`User ${uid} belongs to no groups or path not found.`);
            return res.status(200).json({ groups: [] });
        }

        const groupIds = Object.keys(groupIdsObject);
        console.log(`User ${uid} is associated with group IDs:`, groupIds);

        // --- Step 3: Fetch details (specifically the name) for each group ---
        const groupDetailsPromises = groupIds.map(id =>
            getGroupDetails(id, token) // Error handling is inside getGroupDetails
        );

        const groupDetailsResults = await Promise.all(groupDetailsPromises);

        // --- Step 4: Format the response ---
        const groups = groupDetailsResults
            .map((details, index) => {
                // Filter out null results (groups that failed, had no details, or no name)
                if (details && details.name) {
                    return {
                        id: groupIds[index],
                        name: details.name,
                    };
                }
                if (details && !details.name) {
                     console.warn(`Group ${groupIds[index]} fetched but missing 'name' property.`);
                }
                return null;
            })
            .filter(group => group !== null);

        console.log("Successfully prepared groups data for response:", groups);
        return res.status(200).json({ groups });

    } catch (error) {
        console.error("API Error in /api/get-settleup-user-groups:", error.message);

        // Handle specific errors thrown from the lib functions
        if (error.message.includes("Invalid Settle Up email or password")) {
            return res.status(401).json({ error: error.message });
        }
        if (error.message.includes("Authentication error") || error.message.includes("authentication failed")) {
             return res.status(403).json({ error: "Settle Up authentication or authorization failed." });
        }
         // Handle initialization errors
        if (error.message.includes("Failed to initialize Firebase") || error.message.includes("Firebase Auth service not available")) {
             return res.status(500).json({ error: "Internal server error: Firebase service initialization failed." });
        }
         if (error.message.includes("Firebase configuration is incomplete")) {
             return res.status(500).json({ error: "Internal server error: Firebase configuration missing." });
        }
        // Generic server error for other issues (e.g., REST API fetch failures)
        return res.status(500).json({ error: "An internal server error occurred while fetching groups." });
    }
}
