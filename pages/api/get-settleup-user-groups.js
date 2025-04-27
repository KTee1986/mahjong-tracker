// pages/api/get-settleup-user-groups.js

// --- Use require to import the helper functions ---
let loginSettleUp, getUserGroupIds, getGroupDetails;
try {
    const settleUpApi = require('../../lib/settleup-api');
    loginSettleUp = settleUpApi.loginSettleUp;
    getUserGroupIds = settleUpApi.getUserGroupIds;
    getGroupDetails = settleUpApi.getGroupDetails;
    if (!loginSettleUp || !getUserGroupIds || !getGroupDetails) {
        throw new Error("One or more functions missing from settleup-api module.");
    }
} catch (e) {
    console.error("FATAL: Failed to require settleup-api module.", e);
    // If the helper module itself fails to load, the API route cannot function.
    // Send a 500 error immediately.
    // Note: This specific response might not be reachable if the process exits during require.
    module.exports = async (req, res) => {
        res.status(500).json({ error: "Internal server error: Failed to load core API library." });
    };
    // Re-throw the error to ensure the process logs it clearly if possible
    throw e;
}


// Define the main handler function using module.exports for consistency with require
module.exports = async (req, res) => {
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
            getGroupDetails(id, token) // Error handling is now inside getGroupDetails
        );

        const groupDetailsResults = await Promise.all(groupDetailsPromises);

        // --- Step 4: Format the response ---
        const groups = groupDetailsResults
            .map((details, index) => {
                // Filter out null results (groups that failed to fetch or had no name)
                if (details && details.name) {
                    return {
                        id: groupIds[index],
                        name: details.name,
                    };
                }
                // Log if details were fetched but name was missing
                if (details && !details.name) {
                     console.warn(`Group ${groupIds[index]} fetched but missing 'name' property.`);
                }
                return null; // Exclude groups that failed, had no details, or no name
            })
            .filter(group => group !== null);

        console.log("Successfully prepared groups data for response:", groups);
        return res.status(200).json({ groups });

    } catch (error) {
        console.error("API Error in /api/get-settleup-user-groups:", error.message);

        if (error.message.includes("Invalid Settle Up email or password")) {
            return res.status(401).json({ error: error.message });
        }
        if (error.message.includes("Authentication error") || error.message.includes("authentication failed")) {
             return res.status(403).json({ error: "Settle Up authentication or authorization failed." });
        }
        if (error.message.includes("Failed to initialize Firebase") || error.message.includes("Firebase SDK was not loaded")) {
             return res.status(500).json({ error: "Internal server error: Firebase initialization failed." });
        }
         if (error.message.includes("Firebase configuration is incomplete")) {
             return res.status(500).json({ error: "Internal server error: Firebase configuration missing." });
        }
        // Generic server error
        return res.status(500).json({ error: "An internal server error occurred while fetching groups." });
    }
};
