import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function Stats() {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Added loading state
  const [error, setError] = useState(null); // Added error state

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    fetch("/api/sheet")
      .then((res) => {
        if (!res.ok) {
           // Handle HTTP errors
           return res.text().then(text => {
             console.error("API Error Response Text:", text);
             throw new Error(`API request failed: ${res.status} ${res.statusText}`);
           }).catch(() => {
             throw new Error(`API request failed: ${res.status} ${res.statusText}`);
           });
        }
        return res.json();
      })
      .then((responseData) => {
        // Ensure response structure is correct
        if (!responseData || !Array.isArray(responseData.data)) {
          console.error("API response missing 'data' array:", responseData);
          throw new Error("Invalid data structure received from API.");
        }

        const rawData = responseData.data;
        const stats = {};

        // Start processing from the second row (index 1) to skip header
        rawData.slice(1).forEach(row => {
          // Basic row validation (check if it's an array and has enough elements)
          // Adjust the expected length (e.g., 14) based on your sheet structure if needed
          if (!Array.isArray(row) || row.length < 14) {
              console.warn("Skipping invalid row structure in stats calculation:", row);
              return; // Skip this row if it's not valid
          }

          const seats = ["East", "South", "West", "North"];
          seats.forEach((seat, i) => {
            const playerCellIndex = 2 + i * 2;
            const scoreCellIndex = 3 + i * 2;

            const playerCell = row[playerCellIndex];
            // Use Number() carefully, provide default 0 if score cell is missing/undefined
            const score = Number(row[scoreCellIndex] ?? 0); // Use nullish coalescing

            if (!playerCell) return; // Skip if player name is empty

            const playerNames = playerCell.split("+").map(name => name.trim()).filter(Boolean);
            
            // Avoid division by zero if playerNames array is empty after filtering
            if (playerNames.length === 0) return; 
            
            const splitScore = score / playerNames.length;

            playerNames.forEach(player => {
              if (!stats[player]) {
                stats[player] = {
                  player,
                  totalGames: 0,
                  totalScore: 0,
                  positiveGames: 0,
                  highest: -Infinity,
                  lowest: Infinity,
                };
              }
              const s = stats[player];
              s.totalGames += 1;
              s.totalScore += splitScore;
              if (splitScore > 0) s.positiveGames += 1;
              // Ensure score is a number before comparing
              if (!isNaN(splitScore)) {
                  s.highest = Math.max(s.highest, splitScore);
                  s.lowest = Math.min(s.lowest, splitScore);
              }
            });
          });
        });

        // Map stats object to an array of table rows
        const table = Object.values(stats).map(s => {
            // Avoid division by zero for winRate and average if totalGames is 0
            const winRateValue = s.totalGames > 0 ? (s.positiveGames / s.totalGames) * 100 : 0;
            const averageValue = s.totalGames > 0 ? s.totalScore / s.totalGames : 0;
            // Handle cases where highest/lowest remained Infinity/-Infinity
            const highestValue = s.highest === -Infinity ? 0 : s.highest;
            const lowestValue = s.lowest === Infinity ? 0 : s.lowest;

            return {
                player: s.player,
                games: s.totalGames,
                // Store the numeric value for sorting, format later if needed or store both
                winRateNum: winRateValue, 
                winRate: winRateValue.toFixed(1) + '%',
                average: averageValue.toFixed(2),
                highest: highestValue.toFixed(2),
                lowest: lowestValue.toFixed(2),
            };
        });

        // *** ADDED SORTING LOGIC HERE ***
        // Sort by the numeric win rate in descending order
        table.sort((a, b) => b.winRateNum - a.winRateNum);

        setRows(table); // Update state with the sorted table data
      })
      .catch((error) => {
        console.error("Failed to fetch or process stats:", error);
        setError(error.message || "Failed to load stats.");
        setRows([]); // Clear rows on error
      })
      .finally(() => {
         setIsLoading(false); // Stop loading
      });

  }, []); // Runs once on component mount

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Stats</h1>

      {isLoading && <p className="text-center my-4">Loading stats...</p>}
      {error && <p className="text-center my-4 text-red-500">Error: {error}</p>}

      {!isLoading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border-collapse border border-gray-700">
            <thead>
              <tr className="bg-gray-800 text-white sticky top-0">
                <th className="border border-gray-700 p-2">Player</th>
                <th className="border border-gray-700 p-2">Games</th>
                <th className="border border-gray-700 p-2">Win Rate</th>
                <th className="border border-gray-700 p-2">Avg Score</th>
                <th className="border border-gray-700 p-2">Highest</th>
                <th className="border border-gray-700 p-2">Lowest</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                 rows.map((row) => (
                   <tr key={row.player} className="hover:bg-gray-700">
                     <td className="border border-gray-700 p-2">{row.player}</td>
                     <td className="border border-gray-700 p-2 text-center">{row.games}</td>
                     {/* Display the formatted winRate string */}
                     <td className="border border-gray-700 p-2 text-center">{row.winRate}</td> 
                     <td className="border border-gray-700 p-2 text-center">{row.average}</td>
                     <td className="border border-gray-700 p-2 text-center">{row.highest}</td>
                     <td className="border border-gray-700 p-2 text-center">{row.lowest}</td>
                   </tr>
                 ))
              ) : (
                  <tr>
                    <td colSpan="6" className="text-center p-4">No stats data available.</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}