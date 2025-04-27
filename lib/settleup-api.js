// lib/settleup-api.js

// --- Firebase v9 Modular Imports ---
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
// Note: The Realtime Database SDK might not be strictly needed if only using REST API via axios
// If you *do* need the RTDB SDK directly later, import { getDatabase, ref, get } from 'firebase/database';
import axios from 'axios'; // Keep using axios for REST calls

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL, // Still needed for REST URL
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- Initialize Firebase App (v9 style) ---
let firebaseApp;
try {
    if (!getApps().length) {
        console.log("Initializing Firebase app (v9)...");
        // Validate config before initializing
        if (!firebaseConfig.apiKey || !firebaseConfig.databaseURL) {
             console.error("Firebase config missing apiKey or databaseURL. Check environment variables.");
             throw new Error("Firebase configuration is incomplete.");
        }
        firebaseApp = initializeApp(firebaseConfig);
        console.log("Firebase app initialized (v9).");
    } else {
        // console.log("Firebase app already initialized. Getting existing instance (v9).");
        firebaseApp = getApp(); // Get the default app instance
    }
} catch (e) {
    console.error("Error during Firebase v9 initialization:", e.message);
    throw new Error(`Failed to initialize Firebase: ${e.message}`);
}

// --- Get Auth instance ---
let auth;
try {
    auth = getAuth(firebaseApp);
    // console.log("Firebase Auth instance obtained (v9).");
} catch (e) {
    console.error("Failed to get Firebase Auth instance (v9):", e.message);
    // If Auth fails, the login function won't work.
    throw new Error(`Firebase Auth service not available: ${e.message}`);
}


/**
 * Logs into Settle Up using Firebase Authentication (v9).
 * @param {string} email - The user's Settle Up email.
 * @param {string} password - The user's Settle Up password.
 * @returns {Promise<{uid: string, token: string}>} - Resolves with user ID and auth token.
 * @throws {Error} - Throws an error if login fails or Firebase auth is unavailable.
 */
export async function loginSettleUp(email, password) {
    console.log("Attempting Settle Up login (v9) for:", email);
    if (!auth) {
        throw new Error("Firebase Auth instance is not available.");
    }

    let userCredential;
    try {
        // Use the auth instance obtained earlier
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (user) {
            const token = await user.getIdToken(); // Get the Firebase ID token
            console.log("Settle Up login successful (v9) for UID:", user.uid);
            return { uid: user.uid, token };
        } else {
            // Should not happen if signInWithEmailAndPassword resolves, but good practice
            throw new Error("Firebase Authentication failed (v9): User object not found after sign-in.");
        }
    } catch (error) {
        console.error("Settle Up Login Error (v9):", error.code, error.message);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
             throw new Error("Invalid Settle Up email or password.");
        } else if (error.code === 'auth/invalid-email') {
            throw new Error("Invalid email format provided.");
        }
        throw new Error(`Settle Up authentication failed (v9): ${error.message}`);
    } finally {
         // IMPORTANT: Sign out the specific auth instance used for this login.
         // This is crucial on the backend when using user credentials.
         if (auth) { // Check if auth was successfully obtained
             try {
                 await signOut(auth);
                 console.log("Signed out backend Firebase auth instance (v9) after token retrieval.");
             } catch (signOutError) {
                 console.error("Error signing out Firebase auth instance (v9):", signOutError);
             }
         }
    }
}

/**
 * Fetches the IDs of groups associated with a given Settle Up user ID via REST API.
 * @param {string} uid - The user's Settle Up ID (from loginSettleUp).
 * @param {string} token - The Firebase auth token (from loginSettleUp).
 * @returns {Promise<object|null>} - Resolves with an object where keys are group IDs, or null on error/no groups.
 * @throws {Error} - Throws error if the request fails fundamentally (e.g., config).
 */
export async function getUserGroupIds(uid, token) {
    // Use the databaseURL from config for the REST endpoint
    if (!firebaseConfig.databaseURL) {
        console.error("Firebase databaseURL is not configured in environment variables.");
        throw new Error("Firebase databaseURL is not configured.");
    }
    // Construct the REST API URL
    const url = `${firebaseConfig.databaseURL}/userGroups/${uid}.json?auth=${token}`;
    console.log("Fetching user group IDs via REST:", url.split('?')[0]);
    try {
        const response = await axios.get(url);
        console.log("Successfully fetched group IDs structure via REST:", response.data ? Object.keys(response.data) : 'None');
        return response.data; // Returns an object like { "groupId1": true, "groupId2": true } or null
    } catch (error) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        console.error("Error fetching user group IDs via REST:", status, errorData || error.message);
        if (status === 401 || status === 403) {
            throw new Error("Authentication error fetching user groups via REST. Token might be invalid or expired.");
        }
        if (status === 404) {
             console.warn(`User groups path not found via REST for UID ${uid}. Assuming no groups.`);
             return null;
        }
        throw new Error(`Failed to fetch user groups via REST from Settle Up backend.`);
    }
}

/**
 * Fetches details (like the name) for a specific Settle Up group via REST API.
 * @param {string} groupId - The ID of the group.
 * @param {string} token - The Firebase auth token.
 * @returns {Promise<object|null>} - Resolves with the group details object or null if not found/error.
 * @throws {Error} - Throws error if the request fails fundamentally (e.g., config).
 */
export async function getGroupDetails(groupId, token) {
    if (!firebaseConfig.databaseURL) {
        console.error("Firebase databaseURL is not configured in environment variables.");
        throw new Error("Firebase databaseURL is not configured.");
    }
    // Construct the REST API URL
    const url = `${firebaseConfig.databaseURL}/groups/${groupId}.json?auth=${token}`;
    console.log("Fetching details via REST for group:", groupId);
    try {
        const response = await axios.get(url);
         console.log(`Successfully fetched details via REST for group ${groupId}:`, response.data?.name);
        return response.data; // Returns group details object or null if group doesn't exist at path
    } catch (error) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        console.error(`Error fetching details via REST for group ${groupId}:`, status, errorData || error.message);
         if (status === 401 || status === 403) {
            console.error(`Authentication error fetching details via REST for group ${groupId}.`);
            return null;
        }
         if (status === 404) {
             console.warn(`Group details not found via REST for group ID ${groupId}.`);
             return null;
        }
        console.error(`Non-auth/404 error fetching details via REST for group ${groupId}. Returning null.`);
        return null;
    }
}

// Note: No need for module.exports when using ES Modules (import/export)
