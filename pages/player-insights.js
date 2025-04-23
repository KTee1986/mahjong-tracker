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
}