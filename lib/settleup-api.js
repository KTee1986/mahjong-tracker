// lib/settleup-api.js

// --- Firebase v9 Modular Imports ---
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
// Realtime Database SDK is not strictly needed if only using REST API via axios
import axios from 'axios'; // Using axios for REST calls

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL, // Needed for REST URL
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- Initialize Firebase App (v9 style) ---
let firebaseApp;
try {
    if (!getApps().length) {
        console.log("Initializing Firebase app (v9)...");
        if (!firebaseConfig.apiKey || !firebaseConfig.databaseURL) {
             console.error("Firebase config missing apiKey or databaseURL. Check environment variables.");
             throw new Error("Firebase configuration is incomplete.");
        }
        firebaseApp = initializeApp(firebaseConfig);
        console.log("Firebase app initialized (v9).");
    } else {
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
} catch (e) {
    console.error("Failed to get Firebase Auth instance (v9):", e.message);
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
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        if (!user) throw new Error("User object not found after sign-in.");

        const token = await user.getIdToken();
        console.log("Settle Up login successful (v9) for UID:", user.uid);
        return { uid: user.uid, token };

    } catch (error) {
        console.error("Settle Up Login Error (v9):", error.code, error.message);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
             throw new Error("Invalid Settle Up email or password.");
        } else if (error.code === 'auth/invalid-email') {
            throw new Error("Invalid email format provided.");
        }
        throw new Error(`Settle Up authentication failed (v9): ${error.message}`);
    } finally {
         // Sign out the specific auth instance used for this login.
         if (auth) {
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
 * @param {string} uid - The user's Settle Up ID.
 * @param {string} token - The Firebase auth token.
 * @returns {Promise<object|null>} - Resolves with an object where keys are group IDs, or null on error/no groups.
 * @throws {Error} - Throws error if the request fails fundamentally (e.g., config).
 */
export async function getUserGroupIds(uid, token) {
    if (!firebaseConfig.databaseURL) {
        throw new Error("Firebase databaseURL is not configured.");
    }
    const url = `${firebaseConfig.databaseURL}/userGroups/${uid}.json?auth=${token}`;
    console.log("Fetching user group IDs via REST:", url.split('?')[0]);
    try {
        const response = await axios.get(url);
        console.log("Successfully fetched group IDs structure via REST:", response.data ? Object.keys(response.data) : 'None');
        return response.data; // e.g., { "groupId1": true, ... } or null
    } catch (error) {
        const status = error.response?.status;
        console.error("Error fetching user group IDs via REST:", status, error.response?.data || error.message);
        if (status === 401 || status === 403) {
            throw new Error("Authentication error fetching user groups via REST.");
        }
        if (status === 404) {
             console.warn(`User groups path not found via REST for UID ${uid}.`);
             return null; // Treat as no groups found
        }
        throw new Error(`Failed to fetch user groups via REST.`);
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
        throw new Error("Firebase databaseURL is not configured.");
    }
    const url = `${firebaseConfig.databaseURL}/groups/${groupId}.json?auth=${token}`;
    console.log("Fetching details via REST for group:", groupId);
    try {
        const response = await axios.get(url);
         console.log(`Successfully fetched details via REST for group ${groupId}:`, response.data?.name);
        return response.data; // Group details object or null if path doesn't exist
    } catch (error) {
        const status = error.response?.status;
        console.error(`Error fetching details via REST for group ${groupId}:`, status, error.response?.data || error.message);
         if (status === 401 || status === 403) {
            console.error(`Authentication error fetching details via REST for group ${groupId}.`);
            // Returning null indicates failure for this specific group's details
            return null;
        }
         if (status === 404) {
             console.warn(`Group details not found via REST for group ID ${groupId}.`);
             return null; // Group might not exist
        }
        // For other errors, also return null to indicate failure for this group
        console.error(`Non-auth/404 error fetching details via REST for group ${groupId}.`);
        return null;
    }
}

/**
 * Fetches members for a specific Settle Up group via REST API.
 * @param {string} groupId - The ID of the group.
 * @param {string} token - The Firebase auth token.
 * @returns {Promise<object|null>} - Resolves with an object where keys are member IDs and values are member details, or null on error.
 * @throws {Error} - Throws error if the request fails fundamentally (e.g., config).
 */
export async function getGroupMembers(groupId, token) {
    if (!firebaseConfig.databaseURL) {
        throw new Error("Firebase databaseURL is not configured.");
    }
    const url = `${firebaseConfig.databaseURL}/members/${groupId}.json?auth=${token}`;
    console.log("Fetching members via REST for group:", groupId);
    try {
        const response = await axios.get(url);
        console.log(`Successfully fetched members structure via REST for group ${groupId}:`, response.data ? Object.keys(response.data) : 'None');
        return response.data; // e.g., { "memberId1": { name: "...", active: true }, ... } or null
    } catch (error) {
        const status = error.response?.status;
        console.error(`Error fetching members via REST for group ${groupId}:`, status, error.response?.data || error.message);
        if (status === 401 || status === 403) {
            console.error(`Authentication error fetching members via REST for group ${groupId}.`);
            // Returning null indicates failure for this specific group's members
            return null;
        }
        if (status === 404) {
             console.warn(`Members path not found via REST for group ID ${groupId}.`);
             return null; // Group might exist but have no members path yet
        }
        // For other errors, return null
        console.error(`Non-auth/404 error fetching members via REST for group ${groupId}.`);
        return null;
    }
}
