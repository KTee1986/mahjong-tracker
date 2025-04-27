// pages/settleup-groups.js // Consider renaming the file if appropriate
import { useState } from "react";
import Layout from "../components/Layout"; // Assuming you have a Layout component

// Renamed component from SettleUpMembers to SettleUpGroups
export default function SettleUpGroups() {
  // Removed groupId state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [groups, setGroups] = useState(null); // Renamed from 'members' to store the results (groups)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setGroups(null); // Reset groups

    // Removed groupId check
    if (!email || !password) {
        setError("Please fill in Email and Password.");
        setIsLoading(false);
        return;
    }

    try {
      // *** IMPORTANT: Changed API endpoint ***
      // You need to create this backend API route.
      // It should authenticate using email/password, then fetch and return the user's groups.
      const res = await fetch('/api/get-settleup-user-groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Removed groupId from the body
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Error: ${res.status}`);
      }

      // *** IMPORTANT: Expecting backend to return { groups: [...] } ***
      // Ensure your new API endpoint returns data in this structure.
      if (!data || !Array.isArray(data.groups)) {
          console.error("Unexpected response format. Expected { groups: [...] }", data);
          throw new Error("Received unexpected data format from server.");
      }
      setGroups(data.groups); // Store the fetched groups array

    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to fetch groups. Check console.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      {/* Updated title */}
      <h1 className="text-xl font-bold mb-4">Fetch Your Settle Up Groups</h1>
       {/* Updated description */}
      <p className="text-sm text-yellow-600 mb-4">
        Enter the Email/Password associated with your Settle Up account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        {/* Removed Group ID input field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-black">
            Settle Up User Email:
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
            placeholder="user@example.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-black">
            Settle Up User Password:
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
            placeholder="Password"
            autoComplete="current-password"
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {/* Updated button text */}
            {isLoading ? "Fetching..." : "Fetch Groups"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <p>Error: {error}</p>
        </div>
      )}

      {/* Updated results section */}
      {groups && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Groups Found:</h2>
          {groups.length > 0 ? (
            <ul className="list-disc list-inside bg-gray-50 p-4 rounded border">
              {/* Updated map function to iterate over groups */}
              {groups.map((group) => (
                // Use group.id as key, assuming your backend provides it
                <li key={group.id || group.name} className="mb-1">
                  <span className="font-medium">{group.name || '(No Name)'}</span>
                  {/* Display group ID if available */}
                  {group.id && (
                    <>: <code className="text-sm bg-gray-200 px-1 rounded">{group.id}</code></>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="italic">No groups found for this user (or API returned empty data).</p>
          )}
        </div>
      )}
    </Layout>
  );
}