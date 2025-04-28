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
 * Fetches debts for a specific Settle Up group via REST API.
 * @param {string} groupId - The ID of the group.
 * @param {string} token - The Firebase auth token.
 * @returns {Promise<Array|null>} - Resolves with an array of debt objects or null on error.
 * Expected debt object: { fromMemberId, toMemberId, amount, currencyCode }
 */
export async function getGroupDebts(groupId, token) {
    if (!firebaseConfig.databaseURL) throw new Error("Firebase databaseURL is not configured.");
    // *** ASSUMPTION: Endpoint for debts ***
    const url = `${firebaseConfig.databaseURL}/debts/${groupId}.json?auth=${token}`;
    console.log("Fetching debts via REST for group:", groupId);
    try {
        const response = await axios.get(url);
        // Debts endpoint might return null if no debts, or an object, or an array.
        // Let's assume it returns an array or null/undefined. If it's an object, needs conversion.
        const debtsData = response.data;
        if (!debtsData) {
            console.log(`No debts found or debts path empty for group ${groupId}.`);
            return []; // Return empty array for consistency
        }
        // If debtsData is an object (keyed by debt ID?), convert to array
        if (typeof debtsData === 'object' && !Array.isArray(debtsData)) {
            console.warn(`Debts data for group ${groupId} is an object, converting to array.`);
            return Object.values(debtsData);
        }
        // If it's already an array (or something else unexpected), return as is or handle error
        if (!Array.isArray(debtsData)) {
             console.error(`Unexpected data type for debts for group ${groupId}:`, typeof debtsData);
             return []; // Return empty array on unexpected type
        }
        console.log(`Successfully fetched ${debtsData.length} debt records for group ${groupId}.`);
        return debtsData;
    } catch (error) {
        const status = error.response?.status;
        console.error(`Error fetching debts via REST for group ${groupId}:`, status, error.response?.data || error.message);
        if (status === 401 || status === 403) {
            throw new Error(`Authentication error fetching debts for group ${groupId}.`);
        }
        if (status === 404) {
             console.warn(`Debts path not found via REST for group ID ${groupId}.`);
             return []; // Return empty array if path doesn't exist
        }
        console.error(`Non-auth/404 error fetching debts via REST for group ${groupId}.`);
        return null; // Indicate fetch failure
    }
}


// --- Other existing functions (createSettleUpExpense, getUserGroupIds, getGroupDetails, findMemberIdByName) ---
// --- remain here as needed by other parts of the application ---
/**
 * Finds a member's ID within a group members object by their exact name.
 */
export function findMemberIdByName(groupMembersObject, targetMemberName) {
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
