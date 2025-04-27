// lib/settleup-api.js
import firebase from 'firebase/app'; // Core Firebase SDK (required)
import 'firebase/auth';         // For Authentication
import 'firebase/database';     // For Realtime Database

import axios from 'axios';

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
    if (!firebase) {
        // This case indicates a fundamental problem with the import itself.
        console.error("FATAL: Firebase SDK failed to import.");
        throw new Error("Firebase SDK failed to import.");
    }

    if (firebase.apps.length === 0) {
        console.log("Initializing Firebase app...");
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase app initialized.");
    } else {
        // console.log("Firebase app already initialized. Using existing instance.");
        firebase.app(); // if already initialized, use that instance
    }
} catch (e) {
    console.error("Error during Firebase initialization:", e);
    // Depending on your error handling strategy, you might want to re-throw
    // or handle this in a way that prevents the API from proceeding without Firebase.
    throw new Error("Failed to initialize Firebase.");
}


/**
 * Logs into Settle Up using Firebase Authentication with provided credentials.
 * IMPORTANT SECURITY NOTE: Passing user credentials directly is not recommended.
 * Consider using a backend service account or dedicated API key.
 *
 * @param {string} email - The user's Settle Up email.
 * @param {string} password - The user's Settle Up password.
 * @returns {Promise<{uid: string, token: string}>} - Resolves with user ID and auth token.
 * @throws {Error} - Throws an error if login fails.
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
            // This case is less likely with await but good practice
            throw new Error("Firebase Authentication failed: User object not found after sign-in.");
        }
    } catch (error) {
        console.error("Settle Up Login Error:", error.code, error.message);
        // Provide a more user-friendly error message
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
             throw new Error("Invalid Settle Up email or password.");
        } else if (error.code === 'auth/invalid-email') {
            throw new Error("Invalid email format provided.");
        }
        // Throw a generic error for other cases
        throw new Error(`Settle Up authentication failed: ${error.message}`);
    } finally {
         // IMPORTANT: Sign out immediately after getting the token if you are using
         // the *user's* credentials on the shared backend Firebase instance.
         if (auth) {
            try {
                await auth.signOut();
                console.log("Signed out backend Firebase instance after token retrieval.");
            } catch (signOutError) {
                console.error("Error signing out Firebase instance:", signOutError);
                // Decide if this error is critical. Usually, it's not, but log it.
            }
         }
    }
}

/**
 * Fetches the IDs of groups associated with a given Settle Up user ID.
 *
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
    console.log("Fetching user group IDs from:", url.split('?')[0]); // Avoid logging tokens
    try {
        const response = await axios.get(url);
        console.log("Successfully fetched group IDs structure:", response.data ? Object.keys(response.data) : 'None');
        return response.data; // Returns an object like { "groupId1": true, "groupId2": true } or null
    } catch (error) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        console.error("Error fetching user group IDs:", status, errorData || error.message);
        if (status === 401 || status === 403) {
            throw new Error("Authentication error fetching user groups. Token might be invalid or expired.");
        }
        // Distinguish between "not found" (which might be valid if user has no groups yet) vs. other errors
        if (status === 404) {
             console.warn(`User groups path not found for UID ${uid}. Assuming no groups.`);
             return null; // Or return {} depending on how you want to handle users with no groups yet
        }
        // For other errors (network, server issues), throw a generic message
        throw new Error(`Failed to fetch user groups from Settle Up backend.`);
    }
}

/**
 * Fetches details (like the name) for a specific Settle Up group.
 *
 * @param {string} groupId - The ID of the group.
 * @param {string} token - The Firebase auth token.
 * @returns {Promise<object|null>} - Resolves with the group details object (e.g., { name: "GroupName", ... }) or null if not found/error.
 * @throws {Error} - Throws error if the request fails fundamentally (e.g., config issue).
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
        return response.data; // Returns group details object or null if group doesn't exist at path
    } catch (error) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        console.error(`Error fetching details for group ${groupId}:`, status, errorData || error.message);
         if (status === 401 || status === 403) {
            // Indicate auth issue specifically for this group fetch
            console.error(`Authentication error fetching details for group ${groupId}.`);
            return null; // Treat as "details not available" for this group
        }
         if (status === 404) {
             console.warn(`Group details not found for group ID ${groupId}.`);
             return null; // Group might not exist or path is wrong
        }
        // For other errors, treat as "details not available" for this group
        console.error(`Non-auth/404 error fetching details for group ${groupId}. Returning null.`);
        return null;
    }
}
