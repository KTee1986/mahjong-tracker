import Layout from "../components/Layout";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PlayerInsights() {
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedYear, setSelectedYear] = useState("All");
  const [availableYears, setAvailableYears] = useState([]);
  const [insights, setInsights] = useState(null);
  const [partnerChartData, setPartnerChartData] = useState([]);
  const [monthlyAverageScores, setMonthlyAverageScores] = useState([]);

  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        const allPlayers = new Set();
        const years = new Set();
        const monthlyScores = {};

        const playerData = {};

        data.slice(1).forEach((row) => {
          const timestamp = row[1];
          const year = timestamp.substring(0, 4);
          const month = timestamp.substring(5, 7);
          const monthYear = timestamp.substring(0, 7);
          years.add(year);

          const seatPairs = [
            { players: row[2], score: Number(row[3] || 0) },
            { players: row[4], score: Number(row[5] || 0) },
            { players: row[6], score: Number(row[7] || 0) },
            { players: row[8], score: Number(row[9] || 0) },
          ];

          const allNamesInGame = new Set();
          seatPairs.forEach((seat) => {
            if (!seat.players) return;
            const names = seat.players.split("+").map((p) => p.trim()).filter(Boolean);
            names.forEach(name => allNamesInGame.add(name));
          });

          seatPairs.forEach((seat) => {
            if (!seat.players) return;
            const names = seat.players.split("+").map((p) => p.trim()).filter(Boolean);
            const splitScore = seat.score / names.length;

            names.forEach((name) => {
              allPlayers.add(name);
              if (!playerData[name]) {
                playerData[name] = {
                  monthlyScores: {},
                  partnerScores: {},
                  partnerCounts: {},
                  gameScores: {},
                  gameCounts: {},
                };
              }

              if (!playerData[name].monthlyScores[monthYear]) {
                playerData[name].monthlyScores[monthYear] = 0;
              }
              if (selectedYear === "All" || selectedYear === year) {
                playerData[name].monthlyScores[monthYear] += splitScore;

                if (!monthlyScores[month]) {
                  monthlyScores[month] = { totalScore: 0, count: 0 };
                }
                monthlyScores[month].totalScore += splitScore;
                monthlyScores[month].count += 1;
              }

              names.forEach((partner) => {
                if (partner !== name) {
                  if (!playerData[name].partnerScores[partner]) {
                    playerData[name].partnerScores[partner] = 0;
                    playerData[name].partnerCounts[partner] = 0;
                  }
                  if (selectedYear === "All" || selectedYear === year) {
                    playerData[name].partnerScores[partner] += splitScore;
                    playerData[name].partnerCounts[partner] += 1;
                  }
                }
              });

              allNamesInGame.forEach(otherPlayer => {
                if (otherPlayer !== name) {
                  if (!playerData[name].gameScores[otherPlayer]) {
                    playerData[name].gameScores[otherPlayer] = 0;
                    playerData[name].gameCounts[otherPlayer] = 0;
                  }
                  if (selectedYear === "All" || selectedYear === year) {
                    playerData[name].gameScores[otherPlayer] += splitScore;
                    playerData[name].gameCounts[otherPlayer] += 1;
                  }
                }
              });
            });
          });
		 });

        setPlayers(Array.from(allPlayers).sort());
        setAvailableYears(["All", ...Array.from(years).sort((a, b) => parseInt(b) - parseInt(a))]);
        if (selectedPlayer) {
          calculateInsights(playerData, selectedPlayer);
        }

        const monthlyAverages = Object.keys(monthlyScores)
          .sort()
          .map(month => ({
            month: months[parseInt(month) - 1],
            averageScore: parseFloat((monthlyScores[month].totalScore / monthlyScores[month].count).toFixed(2)), // Ensure number
          }));

        console.log("Monthly Averages Data:", JSON.stringify(monthlyAverages, null, 2)); // Log the data
        setMonthlyAverageScores(monthlyAverages);
      });
  }, [selectedYear, selectedPlayer]);

  const calculateInsights = (data, player) => {
    if (!data[player]) {
      setInsights(null);
      setPartnerChartData([]);
      setMonthlyAverageScores([]); // Clear monthly chart data
      return;
    }

    const { monthlyScores: playerDataMonthlyScores, partnerScores, partnerCounts, gameScores, gameCounts } = data[player]; // Renamed

    const monthlyScores = {}; // Reset monthlyScores for the current player

    // Luckiest/Blackest Month
    let luckiestMonth = "";
    let blackestMonth = "";
    let maxScore = -Infinity;
    let minScore = Infinity;
    let luckiestScore = 0;
    let blackestScore = 0;

    for (const month in playerDataMonthlyScores) { // Use playerDataMonthlyScores
      const score = playerDataMonthlyScores[month];
      if (score > maxScore) {
        maxScore = score;
        luckiestMonth = month;
        luckiestScore = score;
      }
      if (score < minScore) {
        minScore = score;
        blackestMonth = month;
        blackestScore = score;
      }

      monthlyScores[month] = { totalScore: score, count: 1 }; // Populate monthlyScores
    }

    // Best/Worst Partner
    let bestPartner = "";
    let worstPartner = "";
    let bestAvgPartner = -Infinity;
    let worstAvgPartner = Infinity;

    for (const partner in partnerScores) {
      const avg = partnerScores[partner] / partnerCounts[partner];
      if (avg > bestAvgPartner) {
        bestAvgPartner = avg;
        bestPartner = partner;
      }
      if (avg < worstAvgPartner) {
        worstAvgPartner = avg;
        worstPartner = partner;
      }
    }

    // Most/Least Frequent Partner
    let mostFrequentPartner = "";
    let leastFrequentPartner = "";
    let maxCountPartner = 0;
    let minCountPartner = Infinity;

    for (const partner in partnerCounts) {
      const count = partnerCounts[partner];
      if (count > maxCountPartner) {
        maxCountPartner = count;
        mostFrequentPartner = partner;
      }
      if (count < minCountPartner) {
        minCountPartner = count;
        leastFrequentPartner = partner;
      }
    }

    // Best/Worst Game Player
    let bestGamePlayer = "";
    let worstGamePlayer = "";
    let bestAvgGame = -Infinity;
    let worstAvgGame = Infinity;

    for (const otherPlayer in gameScores) {
      const avg = gameScores[otherPlayer] / gameCounts[otherPlayer];
      if (avg > bestAvgGame) {
        bestAvgGame = avg;
        bestGamePlayer = otherPlayer;
      }
      if (avg < worstAvgGame) {
        worstAvgGame = avg;
        worstGamePlayer = otherPlayer;
      }
    }

    setInsights({
      luckiestMonth: luckiestMonth ? `${luckiestMonth} (${luckiestScore.toFixed(2)})` : "N/A",
      blackestMonth: blackestMonth ? `${blackestMonth} (${blackestScore.toFixed(2)})` : "N/A",
      bestPartner: bestPartner ? `${bestPartner} (${(partnerScores[bestPartner] / partnerCounts[bestPartner]).toFixed(2)})` : "N/A",
      worstPartner: worstPartner ? `${worstPartner} (${(partnerScores[worstPartner] / partnerCounts[worstPartner]).toFixed(2)})` : "N/A",
      mostFrequentPartner,
      leastFrequentPartner,
      bestGamePlayer: bestGamePlayer ? `${bestGamePlayer} (${bestAvgGame.toFixed(2)})` : "N/A",
      worstGamePlayer: worstGamePlayer ? `${worstGamePlayer} (${worstAvgGame.toFixed(2)})` : "N/A",
    });

    const chartData = Object.keys(partnerScores).map(partner => ({
      name: partner,
      averageScore: (partnerScores[partner] / partnerCounts[partner]).toFixed(2),
    }));
    setPartnerChartData(chartData);

    // Prepare data for the monthly average score chart (for the selected player)
    const monthlyAverages = Object.keys(monthlyScores)
      .sort()
      .map(month => ({
        month: months[parseInt(month) - 1],
        averageScore: parseFloat((monthlyScores[month].totalScore / monthlyScores[month].count).toFixed(2)),
      }));

    console.log("Monthly Averages Data (in calculateInsights):", JSON.stringify(monthlyAverages, null, 2)); // Log data
    setMonthlyAverageScores(monthlyAverages);
  };

  const handlePlayerChange = (e) => {
    setSelectedPlayer(e.target.value);
  };

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Player Insights</h1>

      <div className="mb-4">
        <label htmlFor="player-select" className="mr-2">Select Player:</label>
        <select
          id="player-select"
          value={selectedPlayer}
          onChange={handlePlayerChange}
          className="border rounded py-1 px-2 text-black mr-4"
        >
          <option value="">-- Select a Player --</option>
          {players.map((player, index) => (
            <option key={index} value={player}>{player}</option>
          ))}
        </select>

        <label htmlFor="year-select" className="mr-2">Filter by Year:</label>
        <select
          id="year-select"
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="border rounded py-1 px-2 text-black"
        >
          {availableYears.map((year, index) => (
            <option key={index} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {selectedPlayer && insights ? (
        <div className="mt-8 overflow-x-auto">
          <h2 className="text-lg font-semibold mb-2">Insights for {selectedPlayer}</h2>
          <table className="min-w-full table-auto border-collapse border border-gray-700">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="border border-gray-700 p-2 w-1/2">Metric</th>
                <th className="border border-gray-700 p-2 w-1/2">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-700 p-2">Luckiest Month/Year</td>
                <td className="border border-gray-700 p-2">{insights.luckiestMonth || "N/A"}</td>
              </tr>
              <tr>
                <td className="border border-gray-700 p-2">Blackest Month/Year</td>
                <td className="border border-gray-700 p-2">{insights.blackestMonth || "N/A"}</td>
              </tr>
              <tr>
                <td className="border border-gray-700 p-2">Best Player to Partner With</td>
                <td className="border border-gray-700 p-2">{insights.bestPartner || "N/A"}</td>
              </tr>
              <tr>
                <td className="border border-gray-700 p-2">Worst Player to Partner With</td>
                <td className="border border-gray-700 p-2">{insights.worstPartner || "N/A"}</td>
              </tr>
              <tr>
                <td className="border border-gray-700 p-2">Most Frequently Paired With</td>
                <td className="border border-gray-700 p-2">{insights.mostFrequentPartner || "N/A"}</td>
              </tr>
              <tr>
                <td className="border border-gray-700 p-2">Least Frequently Paired With</td>
                <td className="border border-gray-700 p-2">{insights.leastFrequentPartner || "N/A"}</td>
              </tr>
              <tr>
                <td className="border border-gray-700 p-2">Performs Best when this player is presented in the same game</td>
                <td className="border border-gray-700 p-2">{insights.bestGamePlayer || "N/A"}</td>
              </tr>
              <tr>
                <td className="border border-gray-700 p-2">Performs Worst when this player is presented in the same game</td>
                <td className="border border-gray-700 p-2">{insights.worstGamePlayer || "N/A"}</td>
              </tr>
            </tbody>
          </table>

          {/* Partner Average Score Bar Chart */}
          {partnerChartData.length > 0 && (
            <div className="mt-8">
              <h3 className="text-md font-semibold mb-2">Average Score When Partnered With</h3>
              <BarChart width={500} height={300} data={partnerChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="averageScore" fill="#8884d8" />
              </BarChart>
            </div>
          )}

          {/* Monthly Average Score Bar Chart */}
          {monthlyAverageScores.length > 0 && (
            <div className="mt-8">
              <h3 className="text-md font-semibold mb-2">Average Score per Month</h3>
              <BarChart width={700} height={400} data={monthlyAverageScores}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="averageScore" fill="#82ca9d" />
              </BarChart>
            </div>
          )}
        </div>
      ) : selectedPlayer ? (
        <p>Loading insights...</p>
      ) : (
        <p>Please select a player to view insights.</p>
      )}
    </Layout>
  )
}import Layout from "../components/Layout";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Define months array for mapping month numbers to names
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PlayerInsights() {
  // State for player selection and year filtering
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedYear, setSelectedYear] = useState("All");
  const [availableYears, setAvailableYears] = useState([]);

  // State for calculated data
  const [insights, setInsights] = useState(null); // Player-specific text insights
  const [partnerChartData, setPartnerChartData] = useState([]); // Player-specific partner chart data
  const [overallMonthlyAverageScores, setOverallMonthlyAverageScores] = useState([]); // Overall monthly chart data

  // State for data management
  const [allGameData, setAllGameData] = useState([]); // Stores raw data from API
  const [processedPlayerData, setProcessedPlayerData] = useState({}); // Stores player data processed based on selected year

  // Effect to fetch data initially on component mount
  useEffect(() => {
    fetch("/api/sheet") // Replace with your actual API endpoint
      .then((res) => {
          if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
       })
      .then(({ data }) => {
        // Basic validation of received data structure
        if (data && Array.isArray(data) && data.length > 1) {
          const years = new Set();
          const uniquePlayers = new Set();
          // Store raw data (skip header row, assumed to be index 0)
          const rawData = data.slice(1);
          setAllGameData(rawData);

          // Populate available years and unique player names from the raw data
          rawData.forEach(row => {
            // Ensure row exists and timestamp (column 1) is present
            if (row && row[1]) {
              const timestamp = String(row[1]); // Ensure timestamp is a string
              // Extract year (assuming YYYY format at the start)
              if (timestamp.length >= 4) {
                  const year = timestamp.substring(0, 4);
                  // Basic check if extracted year looks valid (e.g., 4 digits)
                  if (/^\d{4}$/.test(year)) {
                      years.add(year);
                  }
              }

              // Add players from all potential seat columns (2, 4, 6, 8)
              [row[2], row[4], row[6], row[8]].forEach(playersCell => {
                 if (playersCell) { // Check if cell has content
                    String(playersCell).split("+").map(p => p.trim()).filter(Boolean).forEach(name => uniquePlayers.add(name));
                 }
              });
            }
          });
          setPlayers(Array.from(uniquePlayers).sort()); // Set sorted unique player names
          // Set available years, sorted descending, with "All" option
          setAvailableYears(["All", ...Array.from(years).sort((a, b) => parseInt(b) - parseInt(a))]);
        } else {
          console.warn("Fetched data is empty or not in expected format:", data);
          setAllGameData([]); // Handle empty or invalid data
          setPlayers([]);
          setAvailableYears(["All"]);
        }
      })
      .catch(error => {
         console.error("Error fetching sheet data:", error);
         // Handle fetch error state if needed (e.g., display error message)
         setAllGameData([]);
         setPlayers([]);
         setAvailableYears(["All"]);
      });
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect to process data when game data or selected year changes
  useEffect(() => {
    console.log("Processing effect triggered. Selected Year:", selectedYear, "Data length:", allGameData.length); // Log: Start processing

    if (allGameData.length === 0) {
      console.log("No game data (allGameData) to process."); // Log: No data
      setProcessedPlayerData({}); // Clear processed data
      setOverallMonthlyAverageScores([]); // Clear chart data
      return; // Exit if no data
    }

    // Initialize objects to hold aggregated data for this processing run
    const monthlyScoresAggregated = {}; // For overall averages { "01": { totalScore: x, count: y }, ... }
    const playerData = {}; // For player-specific insights { playerName: { monthlyScores: ..., partnerScores: ... } }

    // Iterate through each row of the fetched game data
    allGameData.forEach((row, index) => {
       // Add basic row validation
       if (!row || typeof row !== 'object' || !row[1]) {
           console.warn(`Skipping invalid row at index ${index}:`, row); // Log: Invalid row
           return; // Skip to next row if essential data is missing
       }

      const timestamp = String(row[1]); // Ensure timestamp is a string

      // Add timestamp validation / logging - requires at least YYYY-MM format
      if (!timestamp || timestamp.length < 7) {
          console.warn(`Invalid or too short timestamp in row ${index}: '${timestamp}'. Cannot extract month.`); // Log: Invalid timestamp
          return; // Skip row if timestamp is unusable for monthly aggregation
      }
      const year = timestamp.substring(0, 4);
      const month = timestamp.substring(5, 7); // Extract month as "01", "02", etc.
      const monthYear = timestamp.substring(0, 7); // Extract "YYYY-MM" for player stats

      // Basic validation for extracted year and month
      if (!/^\d{4}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month)) {
          console.warn(`Invalid year ('${year}') or month ('${month}') parsed from timestamp '${timestamp}' in row ${index}.`);
          return; // Skip if parsing failed
      }


      // Log timestamp details for the first few rows for debugging
      if(index < 5) {
        console.log(`Row ${index}: Timestamp='${timestamp}', Year='${year}', Month='${month}', MonthYear='${monthYear}'`);
      }


      // Determine if the current row matches the selected year filter
      const isYearMatch = selectedYear === "All" || selectedYear === year;

      // Define the player pairs and their scores from the row
      const seatPairs = [
        { players: row[2], score: Number(row[3] || 0) }, // Seat 1: Cols C, D
        { players: row[4], score: Number(row[5] || 0) }, // Seat 2: Cols E, F
        { players: row[6], score: Number(row[7] || 0) }, // Seat 3: Cols G, H
        { players: row[8], score: Number(row[9] || 0) }, // Seat 4: Cols I, J
      ];

      // Get all unique player names involved in this specific game row
      const allNamesInGame = new Set();
      seatPairs.forEach((seat) => {
        if (seat.players) { // Check if players cell is not empty
            const names = String(seat.players).split("+").map((p) => p.trim()).filter(Boolean);
            names.forEach(name => allNamesInGame.add(name));
        }
      });

      // Process each pair in the row
      seatPairs.forEach((seat) => {
        if (!seat.players) return; // Skip if no players listed for this seat

        const playersString = String(seat.players); // Ensure string
        const names = playersString.split("+").map((p) => p.trim()).filter(Boolean);

        if (names.length === 0) return; // Skip if parsing names failed or seat was empty after trim

        const splitScore = seat.score / names.length; // Calculate score per player in the pair

        // Log score calculation details for first few rows if year matches
        if(index < 5 && isYearMatch) {
            console.log(`Row ${index}, Seat '${playersString}': Score=${seat.score}, Names=${names.length}, SplitScore=${splitScore}`);
        }

        // Check if splitScore calculation resulted in NaN
        if (isNaN(splitScore)) {
            console.warn(`NaN detected for splitScore in row ${index}, Seat '${playersString}'. Score: ${seat.score}, Names Count: ${names.length}`); // Log NaN
        }


        // --- Aggregate for OVERALL Monthly Average Chart ---
        // Add data only if the year matches the filter AND the score is a valid number
        if (isYearMatch && !isNaN(splitScore)) {
          // Initialize aggregation object for the month if it doesn't exist
          if (!monthlyScoresAggregated[month]) {
            monthlyScoresAggregated[month] = { totalScore: 0, count: 0 };
          }
          // Add the total score for this pair (splitScore * number of players) to the month's total
          monthlyScoresAggregated[month].totalScore += (splitScore * names.length); // Use total pair score contribution
          // Increment the count by the number of players involved in this pair for averaging
          monthlyScoresAggregated[month].count += names.length; // Count each player instance
        }
        // --- END Overall Aggregation ---


        // --- Aggregate for PLAYER specific insights ---
        // Process each player within the current pair
        names.forEach((name) => {
          // Initialize player data object if this player is encountered for the first time
          if (!playerData[name]) {
            playerData[name] = {
              monthlyScores: {}, // Keyed by monthYear "YYYY-MM"
              partnerScores: {}, // Total score achieved with specific partners
              partnerCounts: {}, // Number of times played with specific partners
              gameScores: {},    // Total score achieved when specific opponents were present
              gameCounts: {},    // Number of games played when specific opponents were present
            };
          }

          // Add data only if the year matches the filter AND the score is valid
          if (isYearMatch && !isNaN(splitScore)) {
             // Track player's score in specific month/year
             if (!playerData[name].monthlyScores[monthYear]) {
                playerData[name].monthlyScores[monthYear] = 0;
             }
             playerData[name].monthlyScores[monthYear] += splitScore;

             // Track partner stats (players paired with in the same seat)
             names.forEach((partner) => {
               if (partner !== name) { // Don't pair a player with themselves
                 if (!playerData[name].partnerScores[partner]) {
                   playerData[name].partnerScores[partner] = 0;
                   playerData[name].partnerCounts[partner] = 0;
                 }
                 playerData[name].partnerScores[partner] += splitScore; // Add this game's score contribution
                 playerData[name].partnerCounts[partner] += 1; // Increment games played with this partner
               }
             });

             // Track game stats (performance when other players are present in the same game)
             allNamesInGame.forEach(otherPlayer => {
               if (otherPlayer !== name) { // Compare against all other players in the game
                 if (!playerData[name].gameScores[otherPlayer]) {
                   playerData[name].gameScores[otherPlayer] = 0;
                   playerData[name].gameCounts[otherPlayer] = 0;
                 }
                 playerData[name].gameScores[otherPlayer] += splitScore; // Add score from this game
                 playerData[name].gameCounts[otherPlayer] += 1; // Increment games played with this opponent present
               }
             });
          }
        });
         // --- END Player Aggregation ---
      });
    }); // End of iterating through allGameData rows

    // Log the aggregated scores BEFORE calculating averages
    console.log("Aggregated Monthly Scores (Raw):", JSON.stringify(monthlyScoresAggregated, null, 2)); // Log: Raw Aggregation

    // Set the processed player data state (used by player-specific insights)
    setProcessedPlayerData(playerData);

    // Calculate and set the OVERALL monthly averages for the chart
    const monthlyAverages = Object.keys(monthlyScoresAggregated) // Get month keys ("01", "02", ...)
      .sort() // Sort months chronologically
      .map(monthKey => { // Process each month
        const monthData = monthlyScoresAggregated[monthKey];

        // Validate the aggregated data for the month
        if (!monthData || typeof monthData !== 'object' || typeof monthData.count !== 'number' || monthData.count <= 0 || typeof monthData.totalScore !== 'number') {
            console.warn(`Invalid aggregated data for month key ${monthKey}:`, monthData); // Log: Invalid month data
            return null; // Skip this month if data is invalid or count is zero
        }

        const averageScore = monthData.totalScore / monthData.count; // Calculate average
        const monthIndex = parseInt(monthKey) - 1; // Convert month key "01" -> index 0

        // Check if month index is valid (0-11)
        if (isNaN(monthIndex) || monthIndex < 0 || monthIndex >= months.length) {
            console.warn(`Invalid month key detected after parsing: ${monthKey}`); // Log: Invalid month key
            return null; // Skip this month if key was invalid
        }

        // Return the formatted object for the chart
        return {
           month: months[monthIndex], // Get month name ("Jan", "Feb", ...)
           averageScore: parseFloat(averageScore.toFixed(2)), // Format average score to 2 decimal places
        };
      })
      .filter(item => item !== null); // Filter out any null entries resulting from invalid data

    // Log the FINAL calculated averages array that will be used by the chart
    console.log("Overall Monthly Averages Data (Final for Chart):", JSON.stringify(monthlyAverages, null, 2)); // Log: Final Data

    // Update the state for the overall monthly average chart
    setOverallMonthlyAverageScores(monthlyAverages);

  }, [allGameData, selectedYear]); // Re-run this effect if the raw data or the selected year changes

  // Effect to calculate specific player insights when player selection or processed data changes
  useEffect(() => {
    // Check if a player is selected and if processed data exists for them
    if (selectedPlayer && processedPlayerData[selectedPlayer]) {
      console.log(`Calculating insights for player: ${selectedPlayer}`); // Log: Insight calculation start
      calculateInsights(processedPlayerData, selectedPlayer);
    } else {
      // Clear insights if no player is selected or player has no processed data
      setInsights(null);
      setPartnerChartData([]);
       if (selectedPlayer) {
          console.log(`No processed data found for selected player: ${selectedPlayer}`); // Log: No data for player
       }
    }
  }, [selectedPlayer, processedPlayerData]); // Re-run if selected player or the underlying processed data changes

  // Function to calculate player-specific insights (Luckiest Month, Best Partner, etc.)
  // This function DOES NOT modify the overall monthly scores state
  const calculateInsights = (data, player) => {
    const {
        monthlyScores: playerDataMonthlyScores, // Scores keyed by "YYYY-MM"
        partnerScores, partnerCounts,
        gameScores, gameCounts
    } = data[player]; // Get the specific player's processed data

    // --- Calculate Luckiest/Blackest Month (based on total score in that month/year) ---
    let luckiestMonth = ""; // Format "YYYY-MM"
    let blackestMonth = ""; // Format "YYYY-MM"
    let maxScore = -Infinity;
    let minScore = Infinity;
    let luckiestScore = 0;
    let blackestScore = 0;

    for (const monthYear in playerDataMonthlyScores) {
      const score = playerDataMonthlyScores[monthYear];
      if (score > maxScore) {
        maxScore = score;
        luckiestMonth = monthYear;
        luckiestScore = score;
      }
      if (score < minScore) {
        minScore = score;
        blackestMonth = monthYear;
        blackestScore = score;
      }
    }

    // --- Calculate Best/Worst Partner (based on average score when partnered) ---
    let bestPartner = "";
    let worstPartner = "";
    let bestAvgPartner = -Infinity;
    let worstAvgPartner = Infinity;

    for (const partner in partnerScores) {
      // Ensure partner count is valid and greater than 0 before dividing
      if (partnerCounts[partner] && partnerCounts[partner] > 0) {
          const avg = partnerScores[partner] / partnerCounts[partner];
          if (avg > bestAvgPartner) {
            bestAvgPartner = avg;
            bestPartner = partner;
          }
          if (avg < worstAvgPartner) {
            worstAvgPartner = avg;
            worstPartner = partner;
          }
      } else {
           console.warn(`Partner ${partner} has score but count is ${partnerCounts[partner]}`);
      }
    }

     // --- Calculate Most/Least Frequent Partner (based on count) ---
     let mostFrequentPartner = "";
     let leastFrequentPartner = "";
     let maxCountPartner = 0;
     let minCountPartner = Infinity;

     for (const partner in partnerCounts) {
       const count = partnerCounts[partner];
       if (count > maxCountPartner) {
         maxCountPartner = count;
         mostFrequentPartner = partner;
       }
       // Ensure least frequent partner has been played with at least once
       if (count > 0 && count < minCountPartner) {
         minCountPartner = count;
         leastFrequentPartner = partner;
       }
     }
     // Handle edge case: If player played alone or only with one partner
     if (minCountPartner === Infinity && maxCountPartner > 0) {
         leastFrequentPartner = mostFrequentPartner;
     } else if (minCountPartner === Infinity) {
         leastFrequentPartner = "N/A"; // No partners found
     }
      if (!mostFrequentPartner) mostFrequentPartner = "N/A";


     // --- Calculate Best/Worst Performance Against Player (based on avg score when other player is in game) ---
     let bestGamePlayer = ""; // Player associated with highest avg score for selectedPlayer
     let worstGamePlayer = ""; // Player associated with lowest avg score for selectedPlayer
     let bestAvgGame = -Infinity;
     let worstAvgGame = Infinity;

     for (const otherPlayer in gameScores) {
       // Ensure game count is valid and greater than 0
       if (gameCounts[otherPlayer] && gameCounts[otherPlayer] > 0) {
           const avg = gameScores[otherPlayer] / gameCounts[otherPlayer];
           if (avg > bestAvgGame) {
             bestAvgGame = avg;
             bestGamePlayer = otherPlayer;
           }
           if (avg < worstAvgGame) {
             worstAvgGame = avg;
             worstGamePlayer = otherPlayer;
           }
       } else {
            console.warn(`Opponent ${otherPlayer} has game score but count is ${gameCounts[otherPlayer]}`);
       }
     }

    // Set the state for textual insights
    setInsights({
      luckiestMonth: luckiestMonth ? `${luckiestMonth} (${luckiestScore.toFixed(2)})` : "N/A",
      blackestMonth: blackestMonth ? `${blackestMonth} (${blackestScore.toFixed(2)})` : "N/A",
      bestPartner: bestPartner ? `${bestPartner} (${bestAvgPartner.toFixed(2)})` : "N/A",
      worstPartner: worstPartner ? `${worstPartner} (${worstAvgPartner.toFixed(2)})` : "N/A",
      mostFrequentPartner: mostFrequentPartner,
      leastFrequentPartner: leastFrequentPartner,
      bestGamePlayer: bestGamePlayer ? `${bestGamePlayer} (${bestAvgGame.toFixed(2)})` : "N/A",
      worstGamePlayer: worstGamePlayer ? `${worstGamePlayer} (${worstAvgGame.toFixed(2)})` : "N/A",
    });

    // Prepare data for the partner average score chart
    const chartData = Object.keys(partnerScores).map(partner => {
        const count = partnerCounts[partner] || 0;
        const score = partnerScores[partner] || 0;
        const averageScore = count > 0 ? score / count : 0;
        return {
          name: partner, // Partner name
          averageScore: parseFloat(averageScore.toFixed(2)), // Avg score with this partner
        };
    });
    setPartnerChartData(chartData); // Set state for the partner chart

  }; // End of calculateInsights function

  // Handler for player dropdown change
  const handlePlayerChange = (e) => {
    setSelectedPlayer(e.target.value); // Update selected player state
  };

  // Handler for year dropdown change
   const handleYearChange = (e) => {
      setSelectedYear(e.target.value); // Update selected year state
      // Optional: Clear player selection when year changes to avoid showing old insights
      // setSelectedPlayer("");
      // setInsights(null);
      // setPartnerChartData([]);
   }


  // Render the component UI
  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Player Insights</h1>

      {/* Dropdowns for Player and Year Selection */}
      <div className="mb-4 flex flex-wrap gap-4">
        <div>
          <label htmlFor="player-select" className="mr-2">Select Player:</label>
          <select
            id="player-select"
            value={selectedPlayer}
            onChange={handlePlayerChange}
            className="border rounded py-1 px-2 text-black mr-4"
          >
            <option value="">-- Select a Player --</option>
            {/* Populate player options */}
            {players.map((player, index) => (
              <option key={index} value={player}>{player}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="year-select" className="mr-2">Filter by Year:</label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={handleYearChange} // Use the dedicated handler
            className="border rounded py-1 px-2 text-black"
          >
            {/* Populate year options */}
            {availableYears.map((year, index) => (
              <option key={index} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

        {/* Display Area: Shows Player Insights OR Overall Monthly Chart */}

        {/* Player Specific Insights Table (Displayed only if a player is selected and insights are calculated) */}
        {selectedPlayer && insights && (
          <div className="mt-8 overflow-x-auto">
            <h2 className="text-lg font-semibold mb-2">Insights for {selectedPlayer} ({selectedYear})</h2>
            <table className="min-w-full table-auto border-collapse border border-gray-700">
                 <thead>
                   <tr className="bg-gray-800 text-white">
                     <th className="border border-gray-700 p-2 w-1/2">Metric</th>
                     <th className="border border-gray-700 p-2 w-1/2">Value</th>
                   </tr>
                 </thead>
                 <tbody>
                   <tr>
                     <td className="border border-gray-700 p-2">Luckiest Month/Year (Total Score)</td>
                     <td className="border border-gray-700 p-2">{insights.luckiestMonth}</td>
                   </tr>
                   <tr>
                     <td className="border border-gray-700 p-2">Blackest Month/Year (Total Score)</td>
                     <td className="border border-gray-700 p-2">{insights.blackestMonth}</td>
                   </tr>
                   <tr>
                     <td className="border border-gray-700 p-2">Best Player to Partner With (Avg Score)</td>
                     <td className="border border-gray-700 p-2">{insights.bestPartner}</td>
                   </tr>
                   <tr>
                     <td className="border border-gray-700 p-2">Worst Player to Partner With (Avg Score)</td>
                     <td className="border border-gray-700 p-2">{insights.worstPartner}</td>
                   </tr>
                   <tr>
                     <td className="border border-gray-700 p-2">Most Frequently Paired With</td>
                     <td className="border border-gray-700 p-2">{insights.mostFrequentPartner}</td>
                   </tr>
                   <tr>
                     <td className="border border-gray-700 p-2">Least Frequently Paired With</td>
                     <td className="border border-gray-700 p-2">{insights.leastFrequentPartner}</td>
                   </tr>
                   <tr>
                     <td className="border border-gray-700 p-2">Highest Avg Score When This Player is in Game</td>
                     <td className="border border-gray-700 p-2">{insights.bestGamePlayer}</td>
                   </tr>
                   <tr>
                     <td className="border border-gray-700 p-2">Lowest Avg Score When This Player is in Game</td>
                     <td className="border border-gray-700 p-2">{insights.worstGamePlayer}</td>
                   </tr>
                 </tbody>
            </table>
          </div>
        )}

        {/* Player Specific Partner Chart (Displayed only if player selected and data exists) */}
        {selectedPlayer && partnerChartData.length > 0 && (
           <div className="mt-8">
             <h3 className="text-md font-semibold mb-2">Average Score When Partnered With ({selectedPlayer}, {selectedYear})</h3>
             {/* Ensure dataKey averageScore is correctly typed as number for Recharts */}
             {/* Added YAxis domain fix */}
             <BarChart width={600} height={300} data={partnerChartData.map(d => ({...d, averageScore: Number(d.averageScore)}))}>
               <CartesianGrid strokeDasharray="3 3" />
               <XAxis dataKey="name" />
               <YAxis domain={['dataMin - 3', 'dataMax + 3']} allowDataOverflow={false} />
               <Tooltip />
               <Legend />
               <Bar dataKey="averageScore" fill="#8884d8" />
             </BarChart>
           </div>
         )}
        {/* Message if player selected but no partner data */}
         {selectedPlayer && partnerChartData.length === 0 && insights && (
             <p className="mt-4">No partnership data found for {selectedPlayer} in {selectedYear}.</p>
         )}


        {/* Overall Monthly Average Score Bar Chart (Uses overall state) */}
        {/* Displayed whether or not a player is selected */}
        {overallMonthlyAverageScores.length > 0 ? (
          <div className="mt-8">
            <h3 className="text-md font-semibold mb-2">Overall Average Score per Month ({selectedYear})</h3>
            {/* Use the state variable 'overallMonthlyAverageScores' */}
            <BarChart width={700} height={400} data={overallMonthlyAverageScores}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              {/* Use auto domain or adjust if needed */}
              <YAxis domain={['auto', 'auto']} />
              <Tooltip />
              <Bar dataKey="averageScore" fill="#82ca9d" />
            </BarChart>
          </div>
        ) : (
          // Message if no monthly data is available for the selected year filter
          <p className="mt-8">No monthly average data available for the selected year ({selectedYear}).</p>
        )}

      {/* Message prompting player selection if data is loaded */}
       {!selectedPlayer && allGameData.length > 0 && (
          <p className="mt-4">Select a player to view their specific insights for the selected year ({selectedYear}).</p>
       )}
       {/* Message while data is loading or if fetching failed */}
       {allGameData.length === 0 && (
           <p className="mt-4">Loading data or no data found from the source...</p>
       )}

    </Layout>
  )
}