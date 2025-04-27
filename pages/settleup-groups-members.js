// pages/settleup-groups-members.js (or any name you prefer)
import { useState } from "react";
import Layout from "../components/Layout"; // Assuming you have a Layout component

export default function SettleUpGroupsAndMembers() {
  // State for user inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // State for API interaction
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // State to store the fetched data (groups with their members)
  // Structure: [{ id: 'groupId', name: 'GroupName', members: [{ memberId: 'mId', name: 'MemberName', active: true/false }], fetchError: boolean }, ...]
  const [groupData, setGroupData] = useState(null);

  /**
   * Handles the form submission to fetch groups and their members.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setGroupData(null); // Reset previous results

    // Basic input validation
    if (!email || !password) {
      setError("Please fill in Email and Password.");
      setIsLoading(false);
      return;
    }

    try {
      // Call the new backend endpoint
      const res = await fetch('/api/get-settleup-groups-and-members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      // Handle non-OK responses (e.g., 401, 403, 500)
      if (!res.ok) {
        throw new Error(data.error || `Error: ${res.status} ${res.statusText}`);
      }

      // Validate the structure of the successful response
      if (!data || !Array.isArray(data.groupsWithMembers)) {
          console.error("Unexpected response format. Expected { groupsWithMembers: [...] }", data);
          throw new Error("Received unexpected data format from the server.");
      }

      // Store the fetched data
      setGroupData(data.groupsWithMembers);

    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to fetch data. Check console.");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Renders the table for members of a single group.
   * @param {Array} members - Array of member objects for the group.
   */
  const renderMemberTable = (members) => {
    if (!members || members.length === 0) {
      return <p className="italic text-sm text-gray-500 px-4">No members found for this group.</p>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Member Name
              </th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Member ID
              </th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Active
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map((member) => (
              <tr key={member.memberId}>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  {member.name}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  <code className="text-xs bg-gray-100 px-1 rounded">{member.memberId}</code>
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {member.active ? 'Yes' : 'No'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Main component rendering
  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Settle Up Groups & Members</h1>
      <p className="text-sm text-gray-600 mb-6">
        Enter your Settle Up credentials to fetch all your groups and their members.
      </p>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md mb-8 bg-white p-6 rounded-lg shadow">
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
             className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
             placeholder="user@example.com"
             autoComplete="email"
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
             className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
             placeholder="Password"
             autoComplete="current-password"
           />
         </div>
         <div>
           <button
             type="submit"
             disabled={isLoading}
             className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {isLoading ? "Fetching Data..." : "Fetch Groups and Members"}
           </button>
         </div>
      </form>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center p-4">
          <p className="text-indigo-600">Loading data...</p>
          {/* Optional: Add a spinner */}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md shadow-sm">
          <p><span className="font-bold">Error:</span> {error}</p>
        </div>
      )}

      {/* Results Display */}
      {groupData && !isLoading && (
        <div className="mt-6 space-y-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Results:</h2>
          {groupData.length > 0 ? (
            groupData.map((group) => (
              <div key={group.id} className="bg-white p-4 rounded-lg shadow border border-gray-200">
                <h3 className="text-lg font-semibold mb-3 text-indigo-700">
                  Group: {group.name} <code className="text-xs font-mono bg-gray-100 px-1 rounded">{group.id}</code>
                </h3>
                {group.fetchError ? (
                   <p className="italic text-sm text-red-600 px-4">Could not fetch full details or members for this group.</p>
                ) : (
                   renderMemberTable(group.members)
                )}
              </div>
            ))
          ) : (
            <p className="italic text-gray-500">No groups found for this user.</p>
          )}
        </div>
      )}
    </Layout>
  );
}
