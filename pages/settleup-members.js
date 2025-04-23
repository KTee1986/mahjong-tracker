// pages/settleup-members.js
import { useState } from "react";
import Layout from "../components/Layout"; // Assuming you have a Layout component

export default function SettleUpMembers() {
  const [groupId, setGroupId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [members, setMembers] = useState(null); // To store the results
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMembers(null);

    if (!groupId || !email || !password) {
        setError("Please fill in Group ID, Email, and Password.");
        setIsLoading(false);
        return;
    }

    try {
      const res = await fetch('/api/get-settleup-members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupId, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Error: ${res.status}`);
      }

      setMembers(data.members); // Expecting { members: [...] } from backend

    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to fetch members. Check console.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Fetch Settle Up Group Members</h1>
      <p className="text-sm text-yellow-600 mb-4">
        Enter the Settle Up Group ID and the Email/Password associated with an account that has access to that group.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label htmlFor="groupId" className="block text-sm font-medium text-gray-700">
            Settle Up Group ID:
          </label>
          <input
            type="text"
            id="groupId"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Enter Group ID"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Settle Up User Email:
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="user@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Settle Up User Password:
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Password"
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isLoading ? "Fetching..." : "Fetch Members"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <p>Error: {error}</p>
        </div>
      )}

      {members && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Members Found:</h2>
          {members.length > 0 ? (
            <ul className="list-disc list-inside bg-gray-50 p-4 rounded border">
              {members.map((member) => (
                <li key={member.memberId} className="mb-1">
                  <span className="font-medium">{member.name || '(No Name)'}</span>:{" "}
                  <code className="text-sm bg-gray-200 px-1 rounded">{member.memberId}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="italic">No members found in this group (or API returned empty data).</p>
          )}
        </div>
      )}
    </Layout>
  );
}