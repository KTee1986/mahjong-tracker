import Layout from "../components/Layout";
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
  // *** NEW state for PLAYER'S monthly average scores ***
  const [playerMonthlyAverageScores, setPlayerMonthlyAverageScores] = useState([]);

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
        if (data && Array.isArray(data) && data.length > 1) {
          const years = new Set();
          const uniquePlayers = new Set();
          const rawData = data.slice(1);
          setAllGameData(rawData);

          rawData.forEach(row => {
            if (row && row[1]) {
              const timestamp = String(row[1]);
              if (timestamp.length >= 4) {
                  const year = timestamp.substring(0, 4);
                  if (/^\d{4}$/.test(year)) {
                      years.add(year);
                  }
              }
              [row[2], row[4], row[6], row[8]].forEach(playersCell => {
                 if (playersCell) {
                    String(playersCell).split("+").map(p => p.trim()).filter(Boolean).forEach(name => uniquePlayers.add(name));
                 }
              });
            }
          });
          setPlayers(Array.from(uniquePlayers).sort());
          setAvailableYears(["All", ...Array.from(years).sort((a, b) => parseInt(b) - parseInt(a))]);
        } else {
          console.warn("Fetched data is empty or not in expected format:", data);
          setAllGameData([]);
          setPlayers([]);
          setAvailableYears(["All"]);
        }
      })
      .catch(error => {
         console.error("Error fetching sheet data:", error);
         setAllGameData([]);
         setPlayers([]);
         setAvailableYears(["All"]);
      });
  }, []); // Runs only once on mount

  // Effect to process data based on selected year (calculates player details)
  useEffect(() => {
    console.log("Processing effect triggered. Selected Year:", selectedYear, "Data length:", allGameData.length);

    if (allGameData.length === 0) {
      console.log("No game data (allGameData) to process.");
      setProcessedPlayerData({});
      // No need to clear playerMonthlyAverageScores here, it's cleared when player changes
      return;
    }

    // *** REMOVED overall monthly score aggregation ***

    const playerData = {}; // For player-specific insights

    allGameData.forEach((row, index) => {
       if (!row || typeof row !== 'object' || !row[1]) {
           console.warn(`Skipping invalid row at index ${index}:`, row);
           return;
       }
      const timestamp = String(row[1]);
      if (!timestamp || timestamp.length < 7) {
          console.warn(`Invalid or too short timestamp in row ${index}: '${timestamp}'. Cannot extract month.`);
          return;
      }
      const year = timestamp.substring(0, 4);
      const month = timestamp.substring(5, 7);
      const monthYear = timestamp.substring(0, 7);

      if (!/^\d{4}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month)) {
          console.warn(`Invalid year ('${year}') or month ('${month}') parsed from timestamp '${timestamp}' in row ${index}.`);
          return;
      }

      if(index < 5) {
        console.log(`Row ${index}: Timestamp='${timestamp}', Year='${year}', Month='${month}', MonthYear='${monthYear}'`);
      }

      const isYearMatch = selectedYear === "All" || selectedYear === year;

      const seatPairs = [
        { players: row[2], score: Number(row[3] || 0) },
        { players: row[4], score: Number(row[5] || 0) },
        { players: row[6], score: Number(row[7] || 0) },
        { players: row[8], score: Number(row[9] || 0) },
      ];

      const allNamesInGame = new Set();
      seatPairs.forEach((seat) => {
        if (seat.players) {
            const names = String(seat.players).split("+").map((p) => p.trim()).filter(Boolean);
            names.forEach(name => allNamesInGame.add(name));
        }
      });

      seatPairs.forEach((seat) => {
        if (!seat.players) return;
        const playersString = String(seat.players);
        const names = playersString.split("+").map((p) => p.trim()).filter(Boolean);
        if (names.length === 0) return;
        const splitScore = seat.score / names.length;

        if(index < 5 && isYearMatch) {
            console.log(`Row ${index}, Seat '${playersString}': Score=${seat.score}, Names=${names.length}, SplitScore=${splitScore}`);
        }
        if (isNaN(splitScore)) {
            console.warn(`NaN detected for splitScore in row ${index}, Seat '${playersString}'. Score: ${seat.score}, Names: ${names.length}`);
        }

        // --- Aggregate for PLAYER specific insights ---
        names.forEach((name) => {
          if (!playerData[name]) {
            playerData[name] = {
              monthlyScores: {}, // Keyed by monthYear "YYYY-MM"
              partnerScores: {}, partnerCounts: {},
              gameScores: {}, gameCounts: {},
            };
          }

          if (isYearMatch && !isNaN(splitScore)) {
             if (!playerData[name].monthlyScores[monthYear]) {
                playerData[name].monthlyScores[monthYear] = { totalScore: 0, count: 0 }; // Store score and count
             }
             playerData[name].monthlyScores[monthYear].totalScore += splitScore;
             playerData[name].monthlyScores[monthYear].count += 1; // Count games/entries for the player in that month/year

             names.forEach((partner) => {
               if (partner !== name) {
                 if (!playerData[name].partnerScores[partner]) {
                   playerData[name].partnerScores[partner] = 0;
                   playerData[name].partnerCounts[partner] = 0;
                 }
                 playerData[name].partnerScores[partner] += splitScore;
                 playerData[name].partnerCounts[partner] += 1;
               }
             });

             allNamesInGame.forEach(otherPlayer => {
               if (otherPlayer !== name) {
                 if (!playerData[name].gameScores[otherPlayer]) {
                   playerData[name].gameScores[otherPlayer] = 0;
                   playerData[name].gameCounts[otherPlayer] = 0;
                 }
                 playerData[name].gameScores[otherPlayer] += splitScore;
                 playerData[name].gameCounts[otherPlayer] += 1;
               }
             });
          }
        });
         // --- END Player Aggregation ---
      });
    }); // End of iterating through allGameData rows

    // Set the processed player data state
    console.log("Processed Player Data:", JSON.stringify(playerData, null, 2)); // Log processed data
    setProcessedPlayerData(playerData);

    // *** REMOVED calculation and setting of OVERALL monthly averages ***

  }, [allGameData, selectedYear]); // Re-process if data or year changes

  // Effect to calculate specific player insights when player selection or processed data changes
  useEffect(() => {
    if (selectedPlayer && processedPlayerData[selectedPlayer]) {
      console.log(`Calculating insights for player: ${selectedPlayer}`);
      calculateInsights(processedPlayerData, selectedPlayer);
    } else {
      // Clear insights if no player is selected or player has no data
      setInsights(null);
      setPartnerChartData([]);
      setPlayerMonthlyAverageScores([]); // Clear player monthly chart too
       if (selectedPlayer) {
          console.log(`No processed data found for selected player: ${selectedPlayer}`);
       }
    }
  }, [selectedPlayer, processedPlayerData]); // Re-calculate insights if player or data changes

  // Calculate player-specific insights AND player-specific monthly averages
  const calculateInsights = (data, player) => {
    const {
        monthlyScores: playerDataMonthlyScores, // Scores keyed by "YYYY-MM" - NOW OBJECTS { totalScore, count }
        partnerScores, partnerCounts,
        gameScores, gameCounts
    } = data[player];

    // --- Calculate Luckiest/Blackest Month (based on AVERAGE score in that month/year) ---
    let luckiestMonth = ""; // Format "YYYY-MM"
    let blackestMonth = ""; // Format "YYYY-MM"
    let maxAvgScore = -Infinity;
    let minAvgScore = Infinity;
    let luckiestAvgScore = 0;
    let blackestAvgScore = 0;

    // --- ALSO aggregate scores by CALENDAR month for the player chart ---
    const playerMonthlyAggregated = {}; // { "01": { totalScore: x, count: y }, ... }

    for (const monthYear in playerDataMonthlyScores) { // monthYear is "YYYY-MM"
      const scoreData = playerDataMonthlyScores[monthYear];
      if (!scoreData || scoreData.count <= 0) continue; // Skip if invalid

      const avgScore = scoreData.totalScore / scoreData.count;

      // For luckiest/blackest month stat
      if (avgScore > maxAvgScore) {
        maxAvgScore = avgScore;
        luckiestMonth = monthYear;
        luckiestAvgScore = avgScore;
      }
      if (avgScore < minAvgScore) {
        minAvgScore = avgScore;
        blackestMonth = monthYear;
        blackestAvgScore = avgScore;
      }

      // For player's monthly average chart
      const monthKey = monthYear.substring(5, 7); // Extract "MM"
      if (!playerMonthlyAggregated[monthKey]) {
          playerMonthlyAggregated[monthKey] = { totalScore: 0, gameCount: 0 }; // Use gameCount or similar
      }
      playerMonthlyAggregated[monthKey].totalScore += scoreData.totalScore;
      playerMonthlyAggregated[monthKey].gameCount += scoreData.count; // Sum counts across years
    }

    // --- Best/Worst Partner ---
    let bestPartner = ""; let worstPartner = "";
    let bestAvgPartner = -Infinity; let worstAvgPartner = Infinity;
    for (const partner in partnerScores) {
      if (partnerCounts[partner] && partnerCounts[partner] > 0) {
          const avg = partnerScores[partner] / partnerCounts[partner];
          if (avg > bestAvgPartner) { bestAvgPartner = avg; bestPartner = partner; }
          if (avg < worstAvgPartner) { worstAvgPartner = avg; worstPartner = partner; }
      }
    }

     // --- Most/Least Frequent Partner ---
     let mostFrequentPartner = ""; let leastFrequentPartner = "";
     let maxCountPartner = 0; let minCountPartner = Infinity;
     for (const partner in partnerCounts) {
       const count = partnerCounts[partner];
       if (count > maxCountPartner) { maxCountPartner = count; mostFrequentPartner = partner; }
       if (count > 0 && count < minCountPartner) { minCountPartner = count; leastFrequentPartner = partner; }
     }
     if (minCountPartner === Infinity && maxCountPartner > 0) { leastFrequentPartner = mostFrequentPartner; }
     else if (minCountPartner === Infinity) { leastFrequentPartner = "N/A"; }
     if (!mostFrequentPartner) mostFrequentPartner = "N/A";

     // --- Best/Worst Performance Against Player ---
     let bestGamePlayer = ""; let worstGamePlayer = "";
     let bestAvgGame = -Infinity; let worstAvgGame = Infinity;
     for (const otherPlayer in gameScores) {
       if (gameCounts[otherPlayer] && gameCounts[otherPlayer] > 0) {
           const avg = gameScores[otherPlayer] / gameCounts[otherPlayer];
           if (avg > bestAvgGame) { bestAvgGame = avg; bestGamePlayer = otherPlayer; }
           if (avg < worstAvgGame) { worstAvgGame = avg; worstGamePlayer = otherPlayer; }
       }
     }

    // Set the state for textual insights (using average for luckiest/blackest month now)
    setInsights({
      luckiestMonth: luckiestMonth ? `${luckiestMonth} (Avg: ${luckiestAvgScore.toFixed(2)})` : "N/A",
      blackestMonth: blackestMonth ? `${blackestMonth} (Avg: ${blackestAvgScore.toFixed(2)})` : "N/A",
      bestPartner: bestPartner ? `${bestPartner} (Avg: ${bestAvgPartner.toFixed(2)})` : "N/A",
      worstPartner: worstPartner ? `${worstPartner} (Avg: ${worstAvgPartner.toFixed(2)})` : "N/A",
      mostFrequentPartner: mostFrequentPartner,
      leastFrequentPartner: leastFrequentPartner,
      bestGamePlayer: bestGamePlayer ? `${bestGamePlayer} (Avg: ${bestAvgGame.toFixed(2)})` : "N/A",
      worstGamePlayer: worstGamePlayer ? `${worstGamePlayer} (Avg: ${worstAvgGame.toFixed(2)})` : "N/A",
    });

    // Prepare data for the partner average score chart
    const partnerChart = Object.keys(partnerScores).map(partner => {
        const count = partnerCounts[partner] || 0;
        const score = partnerScores[partner] || 0;
        const averageScore = count > 0 ? score / count : 0;
        return { name: partner, averageScore: parseFloat(averageScore.toFixed(2)) };
    });
    setPartnerChartData(partnerChart);

    // *** Calculate and set PLAYER'S monthly averages for the chart ***
    const playerMonthlyAvgs = Object.keys(playerMonthlyAggregated)
      .sort()
      .map(monthKey => {
         const monthData = playerMonthlyAggregated[monthKey];
         if (!monthData || monthData.gameCount <= 0) return null;

         const averageScore = monthData.totalScore / monthData.gameCount;
         const monthIndex = parseInt(monthKey) - 1;
         if (isNaN(monthIndex) || monthIndex < 0 || monthIndex >= months.length) return null;

         return {
             month: months[monthIndex],
             averageScore: parseFloat(averageScore.toFixed(2)),
         };
      })
      .filter(item => item !== null); // Filter out invalid months

    console.log("Player Monthly Average Scores (for Chart):", JSON.stringify(playerMonthlyAvgs, null, 2));
    setPlayerMonthlyAverageScores(playerMonthlyAvgs); // Update player-specific chart state

  }; // End of calculateInsights function

  // Handler for player dropdown change
  const handlePlayerChange = (e) => {
    setSelectedPlayer(e.target.value);
  };

  // Handler for year dropdown change
   const handleYearChange = (e) => {
      setSelectedYear(e.target.value);
   }


  // Render the component UI
  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Player Insights</h1>

      {/* Dropdowns */}
      <div className="mb-4 flex flex-wrap gap-4">
        <div>
          <label htmlFor="player-select" className="mr-2">Select Player:</label>
          <select id="player-select" value={selectedPlayer} onChange={handlePlayerChange} className="border rounded py-1 px-2 text-black mr-4" >
            <option value="">-- Select a Player --</option>
            {players.map((player, index) => (<option key={index} value={player}>{player}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor="year-select" className="mr-2">Filter by Year:</label>
          <select id="year-select" value={selectedYear} onChange={handleYearChange} className="border rounded py-1 px-2 text-black" >
            {availableYears.map((year, index) => (<option key={index} value={year}>{year}</option>))}
          </select>
        </div>
      </div>

        {/* Display Area: Shows Player Insights and Charts */}
        {selectedPlayer && insights ? (
          <div className="mt-8 overflow-x-auto">
            {/* Player Specific Insights Table */}
            <h2 className="text-lg font-semibold mb-2">Insights for {selectedPlayer} ({selectedYear})</h2>
            <table className="min-w-full table-auto border-collapse border border-gray-700 mb-8">
                 <thead>
                   <tr className="bg-gray-800 text-white">
                     <th className="border border-gray-700 p-2 w-1/2">Metric</th>
                     <th className="border border-gray-700 p-2 w-1/2">Value</th>
                   </tr>
                 </thead>
                 <tbody>
                   <tr><td className="border border-gray-700 p-2">Luckiest Month/Year (Avg Score)</td><td className="border border-gray-700 p-2">{insights.luckiestMonth}</td></tr>
                   <tr><td className="border border-gray-700 p-2">Blackest Month/Year (Avg Score)</td><td className="border border-gray-700 p-2">{insights.blackestMonth}</td></tr>
                   <tr><td className="border border-gray-700 p-2">Best Player to Partner With (Avg Score)</td><td className="border border-gray-700 p-2">{insights.bestPartner}</td></tr>
                   <tr><td className="border border-gray-700 p-2">Worst Player to Partner With (Avg Score)</td><td className="border border-gray-700 p-2">{insights.worstPartner}</td></tr>
                   <tr><td className="border border-gray-700 p-2">Most Frequently Paired With</td><td className="border border-gray-700 p-2">{insights.mostFrequentPartner}</td></tr>
                   <tr><td className="border border-gray-700 p-2">Least Frequently Paired With</td><td className="border border-gray-700 p-2">{insights.leastFrequentPartner}</td></tr>
                   <tr><td className="border border-gray-700 p-2">Highest Avg Score When This Player is in Game</td><td className="border border-gray-700 p-2">{insights.bestGamePlayer}</td></tr>
                   <tr><td className="border border-gray-700 p-2">Lowest Avg Score When This Player is in Game</td><td className="border border-gray-700 p-2">{insights.worstGamePlayer}</td></tr>
                 </tbody>
            </table>

            {/* Player Specific Partner Chart */}
            {partnerChartData.length > 0 && (
              <div className="mb-8"> {/* Added margin-bottom */}
                <h3 className="text-md font-semibold mb-2">Average Score When Partnered With ({selectedPlayer}, {selectedYear})</h3>
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
            {partnerChartData.length === 0 && (
                <p className="mt-4 mb-8">No partnership data found for {selectedPlayer} in {selectedYear}.</p>
            )}

            {/* Player Monthly Average Score Bar Chart */}
            {/* Uses the new state playerMonthlyAverageScores */}
            {playerMonthlyAverageScores.length > 0 ? (
              <div className="mt-8">
                <h3 className="text-md font-semibold mb-2">Average Score per Month for {selectedPlayer} ({selectedYear})</h3>
                <BarChart width={700} height={400} data={playerMonthlyAverageScores}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  {/* Adjust domain based on potential score range */}
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip />
                  <Bar dataKey="averageScore" fill="#82ca9d" />
                </BarChart>
              </div>
            ) : (
               <p className="mt-8">No monthly average data available for {selectedPlayer} in {selectedYear}.</p>
            )}

          </div> /* End of player insights container */

        ) : selectedPlayer ? (
           // Message while loading insights for a selected player
           <p className="mt-4">Loading insights for {selectedPlayer}...</p>
        ) : (
          // Message when no player is selected
          <p className="mt-4">Please select a player to view insights.</p>
        )}

       {/* Message while data is loading initially or if fetching failed */}
       {allGameData.length === 0 && !selectedPlayer && ( // Show only if no player selected yet
           <p className="mt-4">Loading data or no data found from the source...</p>
       )}

    </Layout>
  )
}