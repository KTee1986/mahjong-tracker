// pages/settleup-groups-members.js (Using Backend Authentication)
import { useState, useEffect } from "react";
import Layout from "../components/Layout"; // Assuming you have a Layout component
import { useRouter } from "next/router";

export default function SettleUpGroupsAndMembers() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [groupData, setGroupData] = useState(null); // Expects members to have { memberId, name, active, isAdmin }

  // Optional: Add authentication check for your own application if needed
  // useEffect(() => { ... }, [router]);

  const handleFetchData = async () => {
    setIsLoading(true);
    setError("");
    setMessage("");
    setGroupData(null);

    try {
      const res = await fetch('/api/get-settleup-groups-and-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `Error: ${res.status} ${res.statusText}`);
      if (!data || !Array.isArray(data.groupsWithMembers)) throw new Error("Received unexpected data format from the server.");

      setGroupData(data.groupsWithMembers);
      setMessage(data.groupsWithMembers.length === 0 ? "No Settle Up groups found for the configured backend account." : "Data fetched successfully.");

    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to fetch data. Check console.");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Renders the table for members of a single group.
   * @param {Array} members - Array of member objects including isAdmin.
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
              {/* *** ADDED: Permission Column Header *** */}
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Permission
              </th>
              {/* *** END ADDED *** */}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map((member) => (
              <tr key={member.memberId}>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  {member.name || '(No Name)'}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  <code className="text-xs bg-gray-100 px-1 rounded">{member.memberId}</code>
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {/* Display Yes/No based on boolean */}
                  {member.active ? 'Yes' : 'No'}
                </td>
                {/* *** ADDED: Permission Column Data *** */}
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {/* Display Admin/Member based on boolean isAdmin field */}
                  {member.isAdmin ? (
                    <span className="font-semibold text-red-600">Admin</span>
                  ) : (
                    'Member'
                  )}
                  {/* If using a 'role' field instead: {member.role} */}
                </td>
                {/* *** END ADDED *** */}
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
        Click the button below to fetch group and member data using the pre-configured backend Settle Up account.
      </p>

      {/* Button to trigger fetch */}
      <div className="mb-8 max-w-md">
        <button
          onClick={handleFetchData}
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Fetching Data..." : "Fetch Settle Up Data"}
        </button>
      </div>

      {/* Loading State */}
      {isLoading && ( <div className="text-center p-4"><p className="text-indigo-600">Loading data...</p></div> )}

      {/* Error Display */}
      {error && ( <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md shadow-sm"><p><span className="font-bold">Error:</span> {error}</p></div> )}

      {/* Success/Info Message Display */}
      {message && !error && ( <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md shadow-sm"><p>{message}</p></div> )}

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
                   renderMemberTable(group.members) // This function now renders the extra column
                )}
              </div>
            ))
          ) : (
            !message && <p className="italic text-gray-500">No group data loaded.</p>
          )}
        </div>
      )}
    </Layout>
  );
}
