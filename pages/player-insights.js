
import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function PlayerInsights() {
  const [playerStats, setPlayerStats] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  
  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        const stats = data.slice(1).reduce((acc, row) => {
          const gameDate = new Date(row[1]);
          if (
            (fromDate && gameDate < new Date(fromDate)) ||
            (toDate && gameDate > new Date(toDate))
          ) {
            return acc; // Skip records outside of the selected date range
          }
          // East Player Stats
          acc[row[2]] = acc[row[2]] || { wins: 0, losses: 0, games: 0, monthlyWins: [], monthlyLosses: [], partners: {}, pairedWith: {}, winWith: {}, loseWith: {} };
          acc[row[2]].games += 1;
          if (parseFloat(row[4]) > 0) {
            acc[row[2]].wins += 1;
            const month = new Date(row[1]).toLocaleString("default", { month: "long", year: "numeric" });
            acc[row[2]].monthlyWins.push(month);
            acc[row[2]].winWith[row[3]] = (acc[row[2]].winWith[row[3]] || 0) + 1;
            acc[row[2]].pairedWith[row[3]] = (acc[row[2]].pairedWith[row[3]] || 0) + 1;
          } else {
            acc[row[2]].losses += 1;
            const month = new Date(row[1]).toLocaleString("default", { month: "long", year: "numeric" });
            acc[row[2]].monthlyLosses.push(month);
            acc[row[2]].loseWith[row[3]] = (acc[row[2]].loseWith[row[3]] || 0) + 1;
            acc[row[2]].pairedWith[row[3]] = (acc[row[2]].pairedWith[row[3]] || 0) + 1;
          }
          // Repeat for other players as in the previous version

          return acc;
        }, {});
        setPlayerStats(stats);
      });
  }, [fromDate, toDate]);

  const getMostFrequentMonth = (months) => {
    const monthCount = {};
    months.forEach((month) => {
      monthCount[month] = (monthCount[month] || 0) + 1;
    });
    return Object.entries(monthCount).reduce((max, entry) => entry[1] > max[1] ? entry : max, ["", 0])[0];
  };

  const getBestOrWorstPlayer = (stats, win) => {
    const partnerStats = win ? stats.winWith : stats.loseWith;
    return Object.entries(partnerStats).reduce((max, entry) => entry[1] > max[1] ? entry : max, ["", 0])[0];
  };

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Player Insights</h1>
      <div>
        <label>Select Player:</label>
        <select onChange={(e) => setSelectedPlayer(e.target.value)} value={selectedPlayer}>
          <option value="">Select a Player</option>
          {Object.keys(playerStats).map((player, i) => (
            <option key={i} value={player}>{player}</option>
          ))}
        </select>
        <div>
          <label>From Date:</label>
          <input 
            type="date" 
            value={fromDate} 
            onChange={(e) => setFromDate(e.target.value)} 
          />
          <label>To Date:</label>
          <input 
            type="date" 
            value={toDate} 
            onChange={(e) => setToDate(e.target.value)} 
          />
        </div>
        {selectedPlayer && playerStats[selectedPlayer] && (
          <div>
            <h2>{selectedPlayer}</h2>
            <p>Wins: {playerStats[selectedPlayer].wins}</p>
            <p>Losses: {playerStats[selectedPlayer].losses}</p>
            <p>Total Games Played: {playerStats[selectedPlayer].games}</p>
            <p>Luckiest Month/Year: {getMostFrequentMonth(playerStats[selectedPlayer].monthlyWins)}</p>
            <p>Blacklisted Month/Year: {getMostFrequentMonth(playerStats[selectedPlayer].monthlyLosses)}</p>
            <p>Best Player to Partner With: {getBestOrWorstPlayer(playerStats[selectedPlayer], true)}</p>
            <p>Worst Player to Partner With: {getBestOrWorstPlayer(playerStats[selectedPlayer], false)}</p>
            {/* Add additional stats here as needed */}
          </div>
        )}
      </div>
    </Layout>
  );
}
