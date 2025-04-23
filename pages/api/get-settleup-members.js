// pages/api/get-settleup-members.js
import axios from 'axios';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';

// --- IMPORTANT: Firebase Client SDK Configuration ---
// Load these from environment variables for security
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, // Ensure this is the Web API Key
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  // databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL, // Optional, but good practice
  // storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, // Optional
  // messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, // Optional
  // appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID, // Optional
};

// Initialize Firebase Client App (runs on serverless function here)
// Avoid re-initializing if already done (e.g., in other API routes)
let firebaseApp;
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApps()[0];
}
const auth = getAuth(firebaseApp);

// --- Settle Up Configuration ---
const SETTLE_UP_API_URL = process.env.NEXT_PUBLIC_SETTLE_UP_ENV === 'production'
  ? 'https://settle-up-live.firebaseio.com'
  : 'https://settle-up-sandbox.firebaseio.com';


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { groupId, email, password } = req.body;

  if (!groupId || !email || !password) {
    return res.status(400).json({ error: 'Group ID, Email, and Password are required.' });
  }

  let idToken = null;

  try {
    // --- SECURITY WARNING ---
    // Logging in with user credentials on the backend is insecure.
    // This is implemented based on the request but is not recommended for production.
    console.log(`Attempting Firebase sign-in for user: ${email}`);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log(`Firebase sign-in successful for user: ${user.uid}`);

    idToken = await user.getIdToken();
    console.log("Obtained Firebase ID Token.");

    // --- Sign out immediately after getting the token (optional but good practice here) ---
    // Since this API route is stateless, we don't need the user to stay logged in
    // on the server-side auth instance after we have the token.
    await signOut(auth);
    console.log("Firebase user signed out on server-side auth instance.");
    // --- End Security Warning Block ---


    // --- Call Settle Up API ---
    const membersApiUrl = `${SETTLE_UP_API_URL}/groups/${groupId}.json?auth=${idToken}`;
    console.log(`Fetching members from: ${membersApiUrl}`);

    const settleUpResponse = await axios.get(membersApiUrl);

    const membersData = settleUpResponse.data;

    if (!membersData || typeof membersData !== 'object') {
        // Handle cases where the group exists but has no members, or API returns unexpected format
        console.log(`No members data received or invalid format for group ${groupId}. Response:`, membersData);
        return res.status(200).json({ members: [] }); // Return empty array if no members
    }

    // Format the response: Convert { memberId: { details } } to [ { memberId, name } ]
    const formattedMembers = Object.entries(membersData).map(([memberId, details]) => ({
      memberId: memberId,
      name: details?.name || null, // Include name if available
      // Include other details if needed: active: details?.active, photoUrl: details?.photoUrl etc.
    }));

    console.log(`Successfully fetched ${formattedMembers.length} members for group ${groupId}.`);
    res.status(200).json({ members: formattedMembers });

  } catch (error) {
    console.error('Error fetching Settle Up members:');
    let status = 500;
    let message = 'An internal server error occurred.';

    if (error.code && error.code.startsWith('auth/')) {
        // Firebase Authentication Error
        console.error('Firebase Auth Error Code:', error.code);
        console.error('Firebase Auth Error Message:', error.message);
        status = 401; // Unauthorized
        message = `Firebase Authentication failed: ${error.code}`;
         // Provide more user-friendly messages for common errors
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-email' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            message = 'Invalid email or password provided.';
        } else if (error.code === 'auth/too-many-requests') {
             message = 'Access temporarily disabled due to too many failed login attempts.';
        } else {
             message = 'Authentication failed. Please check credentials.';
        }

    } else if (error.response) {
      // Error from Settle Up API (Axios error)
      console.error('Settle Up API Status:', error.response.status);
      console.error('Settle Up API Data:', error.response.data);
      status = error.response.status;
      message = `Settle Up API Error (${status}): ${error.response.data?.error || 'Failed to retrieve members.'}`;
       if (status === 401 || status === 403) {
           message = 'Authentication failed with Settle Up or permission denied for this group.';
       } else if (status === 404) {
            message = 'Settle Up Group not found or invalid Group ID.';
       }

    } else {
      // Other errors (network, setup, etc.)
      console.error('Generic Error:', error.message);
       message = error.message || 'Failed to process request.';
    }

     // Ensure ID token user is signed out in case of errors after login but before explicit signout
    if (auth.currentUser && idToken) { // Check if login might have succeeded before error
        try { await signOut(auth); console.log("Cleaned up Firebase session on error."); } catch (e) {}
    }


    res.status(status).json({ error: message });
  }
}