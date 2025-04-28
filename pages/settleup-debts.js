// pages/settleup-debts.js
import { useState, useEffect } from "react";
import Layout from "../components/Layout"; // Assuming you have a Layout component
import { useRouter } from "next/router";

export default function SettleUpDebts() {
  const router = useRouter(); // Optional, for app auth check

  // State for API interaction
  const [isLoading, setIsLoading] = useState(true); // Start loading
  const [error, setError] = useState("");
  const [debts, setDebts] = useState([]); // Store the processed debts array

  // Auto-fetch data on component mount
  useEffect(() => {
    // Optional: Add authentication check for your own application if needed first
    // const loggedIn = sessionStorage.getItem("isLoggedIn");
    // if (loggedIn !== "true") {
    //   router.replace("/login");
    //   return; // Stop execution if not logged in
    // }

    const fetchDebts = async () => {
      setIsLoading(true);
      setError("");
      setDebts([]); // Clear previous debts

      try {
        // Call the new backend endpoint
        const res = await fetch('/api/get-settleup-debts', {
          method: 'POST', // Match the backend handler method
          headers: {
            'Content-Type': 'application/json',
          },
          // No body needed
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `Error: ${res.status} ${res.statusText}`);
        }

        // Validate response structure
        if (!data || !Array.isArray(data.debts)) {
            console.error("Unexpected response format. Expected { debts: [...] }", data);
            throw new Error("Received unexpected data format from the server.");
        }

        setDebts(data.debts); // Store the fetched & processed debts

      } catch (err) {
        console.error("Fetch debts error:", err);
        setError(err.message || "Failed to fetch Settle Up debts. Check console.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDebts(); // Fetch data when component mounts

  }, []); // Empty dependency array runs once on mount

  // Render the debts table or messages
  const renderContent = () => {
    if (isLoading) {
      return <div className="text-center p-4"><p className="text-indigo-600">Loading debts...</p></div>;
    }
    if (error) {
      return <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md shadow-sm"><p><span className="font-bold">Error:</span> {error}</p></div>;
    }
    if (debts.length === 0) {
      return <div className="mt-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded-md shadow-sm"><p>No debts found in the configured Settle Up group.</p></div>;
    }

    // Display debts in a table
    return (
      <div className="overflow-x-auto mt-6">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-300 shadow-sm rounded-lg">
          <thead className="bg-gray-100">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Who Owes (From)
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Who is Owed (To)
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {debts.map((debt, index) => (
              // Using index as key is acceptable if list is static after fetch, otherwise generate unique ID
              <tr key={`${debt.fromId}-${debt.toId}-${index}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                  {debt.fromName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                  {debt.toName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right font-semibold">
                  {debt.amount.toFixed(2)} {debt.currency}
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
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Settle Up Debts</h1>
      <p className="text-sm text-gray-600 mb-6">
        Showing current debts for the pre-configured Settle Up group.
      </p>

      {renderContent()}

    </Layout>
  );
}
