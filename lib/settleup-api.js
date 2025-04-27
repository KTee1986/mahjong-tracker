// lib/settleup-api.js
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database'; // Import database module
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
// Initialize only if it hasn't been initialized yet
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // if already initialized, use that instance
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
    try {
        // Sign in using the provided email and password
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        if (user) {
            const token = await user.getIdToken(); // Get the Firebase ID token
            console.log("Settle Up login successful for UID:", user.uid);
            return { uid: user.uid, token };
        } else {
            throw new Error("Firebase Authentication failed: User object not found.");
        }
    } catch (error) {
        console.error("Settle Up Login Error:", error.code, error.message);
        // Provide a more user-friendly error message
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
             throw new Error("Invalid Settle Up email or password.");
        } else if (error.code === 'auth/invalid-email') {
            throw new Error("Invalid email format provided.");
        }
        // Throw a generic error for other cases
        throw new Error(`Settle Up authentication failed: ${error.message}`);
    } finally {
         // IMPORTANT: Sign out immediately after getting the token if you are using
         // the *user's* credentials on the shared backend Firebase instance.
         // This prevents session conflicts if multiple users hit the API concurrently.
         // If using dedicated backend credentials, this sign-out might not be necessary,
         // depending on your Firebase setup and session management.
         await firebase.auth().signOut();
         console.log("Signed out backend Firebase instance after token retrieval.");
    }
}

/**
 * Fetches the IDs of groups associated with a given Settle Up user ID.
 *
 * @param {string} uid - The user's Settle Up ID (from loginSettleUp).
 * @param {string} token - The Firebase auth token (from loginSettleUp).
 * @returns {Promise<object|null>} - Resolves with an object where keys are group IDs, or null on error.
 * @throws {Error} - Throws error if the request fails.
 */
export async function getUserGroupIds(uid, token) {
    if (!firebaseConfig.databaseURL) {
        throw new Error("Firebase databaseURL is not configured.");
    }
    const url = `${firebaseConfig.databaseURL}/userGroups/${uid}.json?auth=${token}`;
    console.log("Fetching user group IDs from:", url); // Avoid logging tokens in production
    try {
        const response = await axios.get(url);
        console.log("Successfully fetched group IDs:", response.data ? Object.keys(response.data) : 'None');
        return response.data; // Returns an object like { "groupId1": true, "groupId2": true } or null
    } catch (error) {
        console.error("Error fetching user group IDs:", error.response?.status, error.response?.data || error.message);
        if (error.response?.status === 401 || error.response?.status === 403) {
            throw new Error("Authentication failed fetching user groups. Token might be invalid or expired.");
        }
        throw new Error(`Failed to fetch user groups: ${error.message}`);
    }
}

/**
 * Fetches details (like the name) for a specific Settle Up group.
 *
 * @param {string} groupId - The ID of the group.
 * @param {string} token - The Firebase auth token.
 * @returns {Promise<object|null>} - Resolves with the group details object (e.g., { name: "GroupName", ... }) or null.
 * @throws {Error} - Throws error if the request fails.
 */
export async function getGroupDetails(groupId, token) {
    if (!firebaseConfig.databaseURL) {
        throw new Error("Firebase databaseURL is not configured.");
    }
    const url = `${firebaseConfig.databaseURL}/groups/${groupId}.json?auth=${token}`;
    console.log("Fetching details for group:", groupId);
    try {
        const response = await axios.get(url);
         console.log(`Successfully fetched details for group ${groupId}:`, response.data?.name);
        return response.data; // Returns group details object or null
    } catch (error) {
        console.error(`Error fetching details for group ${groupId}:`, error.response?.status, error.response?.data || error.message);
         if (error.response?.status === 401 || error.response?.status === 403) {
            throw new Error(`Authentication failed fetching details for group ${groupId}.`);
        }
        throw new Error(`Failed to fetch details for group ${groupId}: ${error.message}`);
    }
}
