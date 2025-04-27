// lib/settleup-api.js

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import axios from 'axios';

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- Initialize Firebase App ---
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

        const token = await user.getIdToken();
        console.log("Settle Up backend login successful for UID:", user.uid);
        return { uid: user.uid, token }; // Return UID and Token

    } catch (error) {
        console.error("Settle Up Backend Login Error (v9):", error.code, error.message);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
             throw new Error("Invalid backend Settle Up email or password configured.");
        }
        throw new Error(`Settle Up backend authentication failed: ${error.message}`);
    } finally {
        if (auth) {
             try {
                 await signOut(auth);
             } catch (signOutError) {
                 console.error("Error signing out Firebase auth instance (v9) after backend login:", signOutError);
             }
         }
    }
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
        return response.data;
    } catch (error) {
        const status = error.response?.status;
        console.error(`Error fetching members via REST for group ${groupId}:`, status, error.response?.data || error.message);
        if (status === 401 || status === 403) {
            throw new Error(`Authentication error fetching members for group ${groupId}.`);
        }
        if (status === 404) {
             console.warn(`Members path not found via REST for group ID ${groupId}.`);
             return null;
        }
        console.error(`Non-auth/404 error fetching members via REST for group ${groupId}.`);
        return null;
    }
}

/**
 * Finds a member's ID within a group members object by their exact name.
 * @param {object} groupMembersObject - The object returned by getGroupMembers.
 * @param {string} targetMemberName - The exact name of the member to find.
 * @returns {string|null} - The member ID if found, otherwise null.
 */
export function findMemberIdByName(groupMembersObject, targetMemberName) {
    // This function might still be needed by the settleup-expense API route
    if (!groupMembersObject) return null;
    for (const memberId in groupMembersObject) {
        if (groupMembersObject[memberId]?.name === targetMemberName) {
            return memberId;
        }
    }
    return null;
}


/**
 * Creates a new expense transaction in Settle Up via REST API.
 * @param {string} groupId - The ID of the group to add the transaction to.
 * @param {string} token - The Firebase auth token.
 * @param {object} expenseData - The payload for the new transaction.
 * @returns {Promise<object>} - The response data from Settle Up API on success.
 */
export async function createSettleUpExpense(groupId, token, expenseData) {
    if (!firebaseConfig.databaseURL) throw new Error("Firebase databaseURL is not configured.");
    const url = `${firebaseConfig.databaseURL}/transactions/${groupId}.json?auth=${token}`;
    console.log(`Creating Settle Up expense in group ${groupId}...`);
    try {
        const response = await axios.post(url, expenseData);
        console.log("Settle Up expense created successfully:", response.data);
        return response.data;
    } catch (error) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        console.error(`Error creating Settle Up expense in group ${groupId}:`, status, errorData || error.message);
        if (status === 401 || status === 403) {
            throw new Error(`Authentication error creating Settle Up expense.`);
        }
        const settleUpError = typeof errorData === 'object' ? JSON.stringify(errorData) : errorData;
        throw new Error(`Failed to create Settle Up expense: ${status} - ${settleUpError || error.message}`);
    }
}

/**
 * Fetches the IDs of groups associated with a given Settle Up user ID via REST API.
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
        return response.data;
    } catch (error) {
        const status = error.response?.status;
        console.error("Error fetching user group IDs via REST:", status, error.response?.data || error.message);
        if (status === 401 || status === 403) throw new Error("Authentication error fetching user groups via REST.");
        if (status === 404) return null;
        throw new Error(`Failed to fetch user groups via REST.`);
    }
}

/**
 * Fetches details (like the name) for a specific Settle Up group via REST API.
 * @param {string} groupId - The ID of the group.
 * @param {string} token - The Firebase auth token.
 * @returns {Promise<object|null>} - Resolves with the group details object or null.
 */
export async function getGroupDetails(groupId, token) {
    if (!firebaseConfig.databaseURL) throw new Error("Firebase databaseURL is not configured.");
    const url = `${firebaseConfig.databaseURL}/groups/${groupId}.json?auth=${token}`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        const status = error.response?.status;
        console.error(`Error fetching details via REST for group ${groupId}:`, status, error.response?.data || error.message);
        if (status === 401 || status === 403 || status === 404) return null;
        return null;
    }
}

// *** REMOVED getGroupPermissions function ***
