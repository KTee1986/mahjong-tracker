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
  // State for the overall monthly average scores chart
  const [overallMonthlyAverageScores, setOverallMonthlyAverageScores] = useState([]);
  // State to store the raw data rows to avoid re-fetching if only player changes
  const [allGameData, setAllGameData] = useState([]);
  // State to store processed player data based on selected year
  const [processedPlayerData, setProcessedPlayerData] = useState({});

  // Effect to fetch data initially
  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        if (data && data.length > 1) {
          const years = new Set();
          const uniquePlayers = new Set();
          // Store raw data (skip header)
          const rawData = data.slice(1);
          setAllGameData(rawData);

          // Populate years and players once from raw data
          rawData.forEach(row => {
            if (row && row[1]) { // Ensure row and timestamp exist
              const timestamp = String(row[1]); // Ensure timestamp is a string
              const year = timestamp.substring(0, 4);
              years.add(year);
              // Add players from all seats
              [row[2], row[4], row[6], row[8]].forEach(playersCell => {
                 if (playersCell) {
                    playersCell.split("+").map(p => p.trim()).filter(Boolean).forEach(name => uniquePlayers.add(name));
                 }
              });
            }
          });
          setPlayers(Array.from(uniquePlayers).sort());
          setAvailableYears(["All", ...Array.from(years).sort((a, b) => parseInt(b) - parseInt(a))]);
        } else {
          setAllGameData([]); // Handle empty or invalid data
          setPlayers([]);
          setAvailableYears(["All"]);
        }
      })
      .catch(error => {
         console.error("Error fetching sheet data:", error);
         // Handle fetch error state if needed
      });
  }, []); // Runs only once on mount

  // Effect to process data when game data or selected year changes
  useEffect(() => {
    if (allGameData.length === 0) {
      setProcessedPlayerData({});
      setOverallMonthlyAverageScores([]);
      return; // No data to process
    }

    const monthlyScoresAggregated = {}; // For overall averages { "01": { totalScore: x, count: y }, ... }
    const playerData = {}; // For player-specific insights

    allGameData.forEach((row) => {
      if (!row || !row[1]) return; // Skip invalid rows

      const timestamp = String(row[1]);
      const year = timestamp.substring(0, 4);
      const month = timestamp.substring(5, 7); // Month as "01", "02", etc.
      const monthYear = timestamp.substring(0, 7); // For player-specific monthly tracking

      // Filter data based on selectedYear for calculations
      const isYearMatch = selectedYear === "All" || selectedYear === year;

      const seatPairs = [
        { players: row[2], score: Number(row[3] || 0) },
        { players: row[4], score: Number(row[5] || 0) },
        { players: row[6], score: Number(row[7] || 0) },
        { players: row[8], score: Number(row[9] || 0) },
      ];

      const allNamesInGame = new Set();
      seatPairs.forEach((seat) => {
        if (!seat.players) return;
        const names = String(seat.players).split("+").map((p) => p.trim()).filter(Boolean);
        names.forEach(name => allNamesInGame.add(name));
      });

      seatPairs.forEach((seat) => {
        if (!seat.players) return;
        const names = String(seat.players).split("+").map((p) => p.trim()).filter(Boolean);
        if (names.length === 0) return; // Avoid division by zero
        const splitScore = seat.score / names.length;

        // --- Aggregate for OVERALL Monthly Average Chart ---
        if (isYearMatch) {
          if (!monthlyScoresAggregated[month]) {
            monthlyScoresAggregated[month] = { totalScore: 0, count: 0 };
          }
          // Add score for each player instance in the pair for the monthly average
          monthlyScoresAggregated[month].totalScore += seat.score; // Use pair score, not split score? Or add splitScore * names.length? Assuming average score *per game entry* for the month. Let's use splitScore * names.length for consistency.
          // Let's refine: average score per *player instance* in that month.
          monthlyScoresAggregated[month].totalScore += (splitScore * names.length); // Add score for each player instance
          monthlyScoresAggregated[month].count += names.length; // Count each player instance
        }
        // --- END Overall Aggregation ---


        // --- Aggregate for PLAYER specific insights ---
        names.forEach((name) => {
          if (!playerData[name]) {
            playerData[name] = {
              monthlyScores: {}, // Keyed by monthYear "YYYY-MM"
              partnerScores: {},
              partnerCounts: {},
              gameScores: {},
              gameCounts: {},
            };
          }

          if (isYearMatch) {
             // Player's score in specific month/year
             if (!playerData[name].monthlyScores[monthYear]) {
                playerData[name].monthlyScores[monthYear] = 0;
             }
             playerData[name].monthlyScores[monthYear] += splitScore;

             // Partner stats
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

             // Opponent/Game stats
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
    });

    // Set the processed player data state
    setProcessedPlayerData(playerData);

    // Calculate and set the OVERALL monthly averages for the chart
    const monthlyAverages = Object.keys(monthlyScoresAggregated)
      .sort()
      .map(monthKey => {
        const monthData = monthlyScoresAggregated[monthKey];
        const averageScore = monthData.count > 0 ? monthData.totalScore / monthData.count : 0;
        return {
           month: months[parseInt(monthKey) - 1], // Convert "01" -> "Jan"
           averageScore: parseFloat(averageScore.toFixed(2)), // Ensure number
        };
      });

    console.log("Overall Monthly Averages Data:", JSON.stringify(monthlyAverages, null, 2)); // Log the data
    setOverallMonthlyAverageScores(monthlyAverages);

  }, [allGameData, selectedYear]); // Re-process if data or year changes

  // Effect to calculate player insights when player or processed data changes
  useEffect(() => {
    if (selectedPlayer && processedPlayerData[selectedPlayer]) {
      calculateInsights(processedPlayerData, selectedPlayer);
    } else {
      // Clear insights if no player is selected or player has no data
      setInsights(null);
      setPartnerChartData([]);
    }
  }, [selectedPlayer, processedPlayerData]); // Re-calculate insights if player or data changes

  // Calculate player-specific insights (DOES NOT TOUCH overall monthly scores anymore)
  const calculateInsights = (data, player) => {
    // This function remains largely the same as your original,
    // EXCEPT it no longer calculates or sets `monthlyAverageScores`.
    // It only calculates and sets `insights` and `partnerChartData`.

    const { monthlyScores: playerDataMonthlyScores, partnerScores, partnerCounts, gameScores, gameCounts } = data[player];

    // Luckiest/Blackest Month (using monthYear)
    let luckiestMonth = "";
    let blackestMonth = "";
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

    // Best/Worst Partner
    let bestPartner = "";
    let worstPartner = "";
    let bestAvgPartner = -Infinity;
    let worstAvgPartner = Infinity;

    for (const partner in partnerScores) {
      const avg = partnerCounts[partner] > 0 ? partnerScores[partner] / partnerCounts[partner] : 0;
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
       // Ensure least frequent partner has been played with at least once
       if (count > 0 && count < minCountPartner) {
         minCountPartner = count;
         leastFrequentPartner = partner;
       }
     }
     // Handle case where player played alone or only with one partner
     if (minCountPartner === Infinity) leastFrequentPartner = mostFrequentPartner || "N/A";


     // Best/Worst Game Player
     let bestGamePlayer = "";
     let worstGamePlayer = "";
     let bestAvgGame = -Infinity;
     let worstAvgGame = Infinity;

     for (const otherPlayer in gameScores) {
       const avg = gameCounts[otherPlayer] > 0 ? gameScores[otherPlayer] / gameCounts[otherPlayer] : 0;
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
      bestPartner: bestPartner ? `${bestPartner} (${bestAvgPartner.toFixed(2)})` : "N/A",
      worstPartner: worstPartner ? `${worstPartner} (${worstAvgPartner.toFixed(2)})` : "N/A",
      mostFrequentPartner: mostFrequentPartner || "N/A",
      leastFrequentPartner: leastFrequentPartner || "N/A",
      bestGamePlayer: bestGamePlayer ? `${bestGamePlayer} (${bestAvgGame.toFixed(2)})` : "N/A",
      worstGamePlayer: worstGamePlayer ? `${worstGamePlayer} (${worstAvgGame.toFixed(2)})` : "N/A",
    });

    // Prepare data for the partner chart
    const chartData = Object.keys(partnerScores).map(partner => ({
      name: partner,
      averageScore: partnerCounts[partner] > 0 ? parseFloat((partnerScores[partner] / partnerCounts[partner]).toFixed(2)) : 0,
    }));
    setPartnerChartData(chartData);

    // ---> REMOVED the calculation and setting of monthlyAverageScores from here <---
  };

  const handlePlayerChange = (e) => {
    setSelectedPlayer(e.target.value);
  };

   const handleYearChange = (e) => {
      setSelectedYear(e.target.value);
      // Optionally clear player selection when year changes if desired
      // setSelectedPlayer("");
      // setInsights(null);
      // setPartnerChartData([]);
   }


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
          // Use the new handler
          onChange={handleYearChange}
          className="border rounded py-1 px-2 text-black"
        >
          {availableYears.map((year, index) => (
            <option key={index} value={year}>{year}</option>
          ))}
        </select>
      </div>

        {/* This section now shows player insights OR general monthly average */}

        {/* Player Specific Insights Table */}
        {selectedPlayer && insights && (
          <div className="mt-8 overflow-x-auto">
            <h2 className="text-lg font-semibold mb-2">Insights for {selectedPlayer} ({selectedYear})</h2>
            <table className="min-w-full table-auto border-collapse border border-gray-700">
                {/* ... Table headers and rows using 'insights' state ... */}
                 <thead>
                   <tr className="bg-gray-800 text-white">
                     <th className="border border-gray-700 p-2 w-1/2">Metric</th>
                     <th className="border border-gray-700 p-2 w-1/2">Value</th>
                   </tr>
                 </thead>
                 <tbody>
                   <tr>
                     <td className="border border-gray-700 p-2">Luckiest Month/Year</td>
                     <td className="border border-gray-700 p-2">{insights.luckiestMonth}</td>
                   </tr>
                   <tr>
                     <td className="border border-gray-700 p-2">Blackest Month/Year</td>
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
                     <td className="border border-gray-700 p-2">Performs Best when this player is in the game (Avg Score)</td>
                     <td className="border border-gray-700 p-2">{insights.bestGamePlayer}</td>
                   </tr>
                   <tr>
                     <td className="border border-gray-700 p-2">Performs Worst when this player is in the game (Avg Score)</td>
                     <td className="border border-gray-700 p-2">{insights.worstGamePlayer}</td>
                   </tr>
                 </tbody>
            </table>
          </div>
        )}

        {/* Player Specific Partner Chart */}
        {selectedPlayer && partnerChartData.length > 0 && (
           <div className="mt-8">
             <h3 className="text-md font-semibold mb-2">Average Score When Partnered With ({selectedPlayer})</h3>
             {/* Ensure dataKey averageScore is correctly typed as number */}
             <BarChart width={600} height={300} data={partnerChartData.map(d => ({...d, averageScore: Number(d.averageScore)}))}>
               <CartesianGrid strokeDasharray="3 3" />
               <XAxis dataKey="name" />
               <YAxis />
               <Tooltip />
               <Legend />
               <Bar dataKey="averageScore" fill="#8884d8" />
             </BarChart>
           </div>
         )}

        {/* Overall Monthly Average Score Bar Chart */}
        {/* Use the new state variable 'overallMonthlyAverageScores' */}
        {overallMonthlyAverageScores.length > 0 ? (
          <div className="mt-8">
            <h3 className="text-md font-semibold mb-2">Overall Average Score per Month ({selectedYear})</h3>
            <BarChart width={700} height={400} data={overallMonthlyAverageScores}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              {/* Add domain to YAxis if scores can be negative */}
              <YAxis domain={['auto', 'auto']} />
              <Tooltip />
              <Bar dataKey="averageScore" fill="#82ca9d" />
            </BarChart>
          </div>
        ) : (
          <p className="mt-8">No monthly average data available for the selected year.</p>
        )}

      {/* Message when no player is selected */}
       {!selectedPlayer && allGameData.length > 0 && (
          <p className="mt-4">Select a player to view their specific insights.</p>
       )}
       {allGameData.length === 0 && (
           <p className="mt-4">Loading data or no data found...</p>
       )}

    </Layout>
  )
}