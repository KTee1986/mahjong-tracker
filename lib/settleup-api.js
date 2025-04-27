// lib/settleup-api.js

// --- Use require for Firebase imports ---
// Attempt to require the necessary Firebase modules
let firebase;
let axios;
try {
    firebase = require('firebase/app');
    require('firebase/auth');
    require('firebase/database');
    axios = require('axios'); // Also require axios for consistency if preferred
    console.log("Firebase SDK modules required successfully.");
} catch (e) {
    console.error("FATAL: Failed to require Firebase SDK or axios. Ensure 'firebase' and 'axios' are installed.", e);
    // Throw an error or handle it appropriately so the app knows Firebase isn't available
    throw new Error("Core dependencies (Firebase/Axios) failed to load.");
}


// --- Firebase Configuration ---
// Reads configuration from environment variables
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- Initialize Firebase App ---
// Check if firebase object exists and initialize only if it hasn't been initialized yet
try {
    // Check if the core firebase object was successfully required
    if (!firebase) {
        throw new Error("Firebase SDK was not loaded.");
    }

    if (firebase.apps.length === 0) {
        // Validate config before initializing
        if (!firebaseConfig.apiKey || !firebaseConfig.databaseURL) {
             console.error("Firebase config missing apiKey or databaseURL. Check environment variables.");
             throw new Error("Firebase configuration is incomplete.");
        }
        console.log("Initializing Firebase app...");
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase app initialized.");
    } else {
        // console.log("Firebase app already initialized. Using existing instance.");
        firebase.app(); // if already initialized, use that instance
    }
} catch (e) {
    console.error("Error during Firebase initialization:", e.message);
    // Propagate the error to prevent the API from proceeding without Firebase
    throw new Error(`Failed to initialize Firebase: ${e.message}`);
}


/**
 * Logs into Settle Up using Firebase Authentication with provided credentials.
 * @param {string} email - The user's Settle Up email.
 * @param {string} password - The user's Settle Up password.
 * @returns {Promise<{uid: string, token: string}>} - Resolves with user ID and auth token.
 * @throws {Error} - Throws an error if login fails or Firebase auth is unavailable.
 */
export async function loginSettleUp(email, password) {
    console.log("Attempting Settle Up login for:", email); // Be careful logging emails
    let auth;
    try {
        // Get the auth instance *after* ensuring initialization
        auth = firebase.auth();
    } catch (initError) {
        console.error("Failed to get Firebase auth instance:", initError);
        throw new Error("Firebase auth service not available.");
    }

    try {
        // Sign in using the provided email and password
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        if (user) {
            const token = await user.getIdToken(); // Get the Firebase ID token
            console.log("Settle Up login successful for UID:", user.uid);
            return { uid: user.uid, token };
        } else {
            throw new Error("Firebase Authentication failed: User object not found after sign-in.");
        }
    } catch (error) {
        console.error("Settle Up Login Error:", error.code, error.message);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
             throw new Error("Invalid Settle Up email or password.");
        } else if (error.code === 'auth/invalid-email') {
            throw new Error("Invalid email format provided.");
        }
        throw new Error(`Settle Up authentication failed: ${error.message}`);
    } finally {
         if (auth) {
            try {
                await auth.signOut();
                console.log("Signed out backend Firebase instance after token retrieval.");
            } catch (signOutError) {
                console.error("Error signing out Firebase instance:", signOutError);
            }
         }
    }
}

/**
 * Fetches the IDs of groups associated with a given Settle Up user ID.
 * @param {string} uid - The user's Settle Up ID (from loginSettleUp).
 * @param {string} token - The Firebase auth token (from loginSettleUp).
 * @returns {Promise<object|null>} - Resolves with an object where keys are group IDs, or null on error/no groups.
 * @throws {Error} - Throws error if the request fails fundamentally.
 */
export async function getUserGroupIds(uid, token) {
    if (!firebaseConfig.databaseURL) {
        console.error("Firebase databaseURL is not configured in environment variables.");
        throw new Error("Firebase databaseURL is not configured.");
    }
    const url = `${firebaseConfig.databaseURL}/userGroups/${uid}.json?auth=${token}`;
    console.log("Fetching user group IDs from:", url.split('?')[0]);
    try {
        const response = await axios.get(url);
        console.log("Successfully fetched group IDs structure:", response.data ? Object.keys(response.data) : 'None');
        return response.data;
    } catch (error) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        console.error("Error fetching user group IDs:", status, errorData || error.message);
        if (status === 401 || status === 403) {
            throw new Error("Authentication error fetching user groups. Token might be invalid or expired.");
        }
        if (status === 404) {
             console.warn(`User groups path not found for UID ${uid}. Assuming no groups.`);
             return null;
        }
        throw new Error(`Failed to fetch user groups from Settle Up backend.`);
    }
}

/**
 * Fetches details (like the name) for a specific Settle Up group.
 * @param {string} groupId - The ID of the group.
 * @param {string} token - The Firebase auth token.
 * @returns {Promise<object|null>} - Resolves with the group details object or null if not found/error.
 * @throws {Error} - Throws error if the request fails fundamentally.
 */
export async function getGroupDetails(groupId, token) {
    if (!firebaseConfig.databaseURL) {
        console.error("Firebase databaseURL is not configured in environment variables.");
        throw new Error("Firebase databaseURL is not configured.");
    }
    const url = `${firebaseConfig.databaseURL}/groups/${groupId}.json?auth=${token}`;
    console.log("Fetching details for group:", groupId);
    try {
        const response = await axios.get(url);
         console.log(`Successfully fetched details for group ${groupId}:`, response.data?.name);
        return response.data;
    } catch (error) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        console.error(`Error fetching details for group ${groupId}:`, status, errorData || error.message);
         if (status === 401 || status === 403) {
            console.error(`Authentication error fetching details for group ${groupId}.`);
            return null;
        }
         if (status === 404) {
             console.warn(`Group details not found for group ID ${groupId}.`);
             return null;
        }
        console.error(`Non-auth/404 error fetching details for group ${groupId}. Returning null.`);
        return null;
    }
}

// --- Export functions using module.exports ---
// Ensure functions are exported correctly when using require
module.exports = {
    loginSettleUp,
    getUserGroupIds,
    getGroupDetails,
};
