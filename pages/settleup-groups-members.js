// pages/settleup-groups-members.js (Auto-Fetch with Backend Authentication)
import { useState, useEffect } from "react"; // useEffect is needed for auto-fetch
import Layout from "../components/Layout"; // Assuming you have a Layout component
import { useRouter } from "next/router";

export default function SettleUpGroupsAndMembers() {
  const router = useRouter(); // Initialize router (optional, for app auth)

  // State for API interaction
  const [isLoading, setIsLoading] = useState(true); // Start in loading state
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // State to store the fetched data
  const [groupData, setGroupData] = useState(null);

  // --- Auto-fetch data on component mount ---
  useEffect(() => {
    // Optional: Add authentication check for your own application if needed first
    // const loggedIn = sessionStorage.getItem("isLoggedIn");
    // if (loggedIn !== "true") {
    //   router.replace("/login");
    //   return; // Stop execution if not logged in
    // }

    const fetchData = async () => {
      setIsLoading(true); // Ensure loading state is true
      setError("");
      setMessage("");
      setGroupData(null);

      try {
        // Call the backend endpoint. No body needed.
        const res = await fetch('/api/get-settleup-groups-and-members', {
          method: 'POST', // Still POST to trigger the serverless function easily
          headers: {
            'Content-Type': 'application/json',
          },
          // No body - backend uses environment variables
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `Error: ${res.status} ${res.statusText}`);
        }

        if (!data || !Array.isArray(data.groupsWithMembers)) {
            console.error("Unexpected response format. Expected { groupsWithMembers: [...] }", data);
            throw new Error("Received unexpected data format from the server.");
        }

        setGroupData(data.groupsWithMembers);
        if (data.groupsWithMembers.length === 0) {
          setMessage("No Settle Up groups found for the configured backend account.");
        }
        // No explicit success message needed here, data display implies success

      } catch (err) {
        console.error("Fetch error:", err);
        setError(err.message || "Failed to fetch data. Check console.");
      } finally {
        setIsLoading(false); // Set loading to false after fetch attempt
      }
    };

    fetchData(); // Call the async function to fetch data

    // Empty dependency array means this effect runs only once when the component mounts
  }, []); // Removed router from dependency array unless needed for app auth check

  /**
   * Renders the table for members of a single group.
   * @param {Array} members - Array of member objects { memberId, name, active }.
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
                  {member.name || '(No Name)'}
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
        Displaying group and member data for the pre-configured backend Settle Up account.
      </p>

      {/* Removed the button */}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center p-4">
          <p className="text-indigo-600">Loading data...</p>
        </div>
      )}

      {/* Error Display */}
      {!isLoading && error && ( // Only show error if not loading
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md shadow-sm">
          <p><span className="font-bold">Error:</span> {error}</p>
        </div>
      )}

       {/* Info Message Display (e.g., no groups found) */}
      {!isLoading && message && !error && ( // Only show message if not loading and no error
        <div className="mt-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded-md shadow-sm">
          <p>{message}</p>
        </div>
      )}

      {/* Results Display */}
      {!isLoading && groupData && !error && ( // Only show results if not loading, data exists, and no error
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
            // This case is now handled by the message state above
            null
          )}
        </div>
      )}
    </Layout>
  );
}
