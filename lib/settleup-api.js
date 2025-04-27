// lib/settleup-api.js

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import axios from 'axios';

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
             throw new Error("Firebase configuration is incomplete (apiKey or databaseURL missing).");
        }
        firebaseApp = initializeApp(firebaseConfig);
        console.log("Firebase app initialized (v9).");
    } else {
        firebaseApp = getApp();
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
 * Logs into Settle Up using backend credentials stored in environment variables.
 * @returns {Promise<{uid: string, token: string}>} - Resolves with user ID and auth token.
 * @throws {Error} - Throws an error if login fails or credentials are missing.
 */
export async function loginSettleUpBackend() {
    const email = process.env.SETTLEUP_BACKEND_EMAIL;
    const password = process.env.SETTLEUP_BACKEND_PASSWORD;

    if (!email || !password) {
        console.error("SettleUp backend credentials (SETTLEUP_BACKEND_EMAIL, SETTLEUP_BACKEND_PASSWORD) not found in environment variables.");
        throw new Error("Backend SettleUp credentials missing.");
    }

    console.log("Attempting Settle Up login using backend credentials for:", email);
    if (!auth) {
        throw new Error("Firebase Auth instance is not available.");
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        if (!user) throw new Error("User object not found after sign-in.");

        const token = await user.getIdToken(); // Get the Firebase ID token for API calls
        console.log("Settle Up backend login successful for UID:", user.uid);
        // IMPORTANT: Return the token needed for subsequent API calls
        return { uid: user.uid, token };

    } catch (error) {
        console.error("Settle Up Backend Login Error (v9):", error.code, error.message);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
             throw new Error("Invalid backend Settle Up email or password configured.");
        }
        throw new Error(`Settle Up backend authentication failed: ${error.message}`);
    } finally {
        // Sign out immediately after getting the token to avoid session conflicts
        if (auth) {
             try {
                 await signOut(auth);
                 // console.log("Signed out backend Firebase auth instance (v9) after token retrieval.");
             } catch (signOutError) {
                 console.error("Error signing out Firebase auth instance (v9) after backend login:", signOutError);
             }
         }
    }
}

/**
 * Fetches the IDs of groups associated with a given Settle Up user ID via REST API.
 * (Used by findGroupIdByName)
 * @param {string} uid - The user's Settle Up ID.
 * @param {string} token - The Firebase auth token.
 * @returns {Promise<object|null>} - Resolves with an object where keys are group IDs, or null.
 */
export async function getUserGroupIds(uid, token) {
    if (!firebaseConfig.databaseURL) throw new Error("Firebase databaseURL is not configured.");
    const url = `${firebaseConfig.databaseURL}/userGroups/${uid}.json?auth=${token}`;
    console.log("Fetching user group IDs via REST:", url.split('?')[0]);
    try {
        const response = await axios.get(url);
        return response.data; // e.g., { "groupId1": true, ... } or null
    } catch (error) {
        const status = error.response?.status;
        console.error("Error fetching user group IDs via REST:", status, error.response?.data || error.message);
        if (status === 401 || status === 403) throw new Error("Authentication error fetching user groups via REST.");
        if (status === 404) return null; // Not found is valid (no groups)
        throw new Error(`Failed to fetch user groups via REST.`);
    }
}

/**
 * Fetches details (like the name) for a specific Settle Up group via REST API.
 * (Used by findGroupIdByName)
 * @param {string} groupId - The ID of the group.
 * @param {string} token - The Firebase auth token.
 * @returns {Promise<object|null>} - Resolves with the group details object or null.
 */
export async function getGroupDetails(groupId, token) {
    if (!firebaseConfig.databaseURL) throw new Error("Firebase databaseURL is not configured.");
    const url = `${firebaseConfig.databaseURL}/groups/${groupId}.json?auth=${token}`;
    // console.log("Fetching details via REST for group:", groupId); // Less verbose logging
    try {
        const response = await axios.get(url);
        return response.data; // Group details object or null
    } catch (error) {
        const status = error.response?.status;
        console.error(`Error fetching details via REST for group ${groupId}:`, status, error.response?.data || error.message);
        if (status === 401 || status === 403 || status === 404) return null; // Treat auth/not found as details unavailable
        return null; // Treat other errors as details unavailable for robustness
    }
}

/**
 * Finds a SettleUp Group ID by its exact name for the logged-in user.
 * @param {string} targetGroupName - The exact name of the group to find.
 * @param {string} uid - The UID of the logged-in user.
 * @param {string} token - The auth token for the logged-in user.
 * @returns {Promise<string|null>} - The Group ID if found, otherwise null.
 * @throws {Error} - If fetching user groups fails.
 */
export async function findGroupIdByName(targetGroupName, uid, token) {
    console.log(`Searching for group ID by name: "${targetGroupName}"`);
    const groupIdsObject = await getUserGroupIds(uid, token); // Can throw error

    if (!groupIdsObject) {
        console.log("No groups found for the user.");
        return null;
    }

    const groupIds = Object.keys(groupIdsObject);
    for (const groupId of groupIds) {
        const details = await getGroupDetails(groupId, token);
        // Case-sensitive comparison for exact match as required by user
        if (details && details.name === targetGroupName) {
            console.log(`Found group ID: ${groupId} for name "${targetGroupName}"`);
            return groupId;
        }
    }

    console.log(`Group with name "${targetGroupName}" not found for user ${uid}.`);
    return null;
}


/**
 * Fetches members for a specific Settle Up group via REST API.
 * @param {string} groupId - The ID of the group.
 * @param {string} token - The Firebase auth token.
 * @returns {Promise<object|null>} - Resolves with an object where keys are member IDs, or null on error.
 */
export async function getGroupMembers(groupId, token) {
    if (!firebaseConfig.databaseURL) throw new Error("Firebase databaseURL is not configured.");
    const url = `${firebaseConfig.databaseURL}/members/${groupId}.json?auth=${token}`;
    console.log("Fetching members via REST for group:", groupId);
    try {
        const response = await axios.get(url);
        return response.data; // e.g., { "memberId1": { name: "...", active: true }, ... } or null
    } catch (error) {
        const status = error.response?.status;
        console.error(`Error fetching members via REST for group ${groupId}:`, status, error.response?.data || error.message);
        if (status === 401 || status === 403 || status === 404) return null; // Treat auth/not found as members unavailable
        return null; // Treat other errors as members unavailable
    }
}

/**
 * Finds a member's ID within a group members object by their exact name.
 * @param {object} groupMembersObject - The object returned by getGroupMembers.
 * @param {string} targetMemberName - The exact name of the member to find.
 * @returns {string|null} - The member ID if found, otherwise null.
 */
export function findMemberIdByName(groupMembersObject, targetMemberName) {
    if (!groupMembersObject) return null;
    for (const memberId in groupMembersObject) {
        // Case-sensitive comparison
        if (groupMembersObject[memberId]?.name === targetMemberName) {
            return memberId;
        }
    }
    return null; // Not found
}


/**
 * Creates a new expense transaction in Settle Up via REST API.
 * @param {string} groupId - The ID of the group to add the transaction to.
 * @param {string} token - The Firebase auth token.
 * @param {object} expenseData - The payload for the new transaction (structure depends on Settle Up API).
 * @returns {Promise<object>} - The response data from Settle Up API on success.
 * @throws {Error} - If the API request fails.
 */
export async function createSettleUpExpense(groupId, token, expenseData) {
    if (!firebaseConfig.databaseURL) throw new Error("Firebase databaseURL is not configured.");
    // Endpoint for creating transactions (adjust if Settle Up API differs)
    const url = `${firebaseConfig.databaseURL}/transactions/${groupId}.json?auth=${token}`;
    console.log(`Creating Settle Up expense in group ${groupId}...`);

    try {
        const response = await axios.post(url, expenseData);
        console.log("Settle Up expense created successfully:", response.data);
        return response.data; // Should contain the ID of the new transaction, e.g., { name: "-N..." }
    } catch (error) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        console.error(`Error creating Settle Up expense in group ${groupId}:`, status, errorData || error.message);
        if (status === 401 || status === 403) {
            throw new Error(`Authentication error creating Settle Up expense.`);
        }
        // Provide more specific error message if possible
        const settleUpError = typeof errorData === 'object' ? JSON.stringify(errorData) : errorData;
        throw new Error(`Failed to create Settle Up expense: ${status} - ${settleUpError || error.message}`);
    }
}
