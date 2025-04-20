
import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function PlayerInsights() {
  const [data, setData] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState("");
  const [insight, setInsight] = useState({});
  const [pairStats, setPairStats] = useState({
    bestTeammate: {},
    worstTeammate: {},
    mostWins: {},
    mostLosses: {},
    mostPairedWith: {},
    leastPairedWith: {},
    winMostWhenInGame: {},
    loseMostWhenInGame: {}
  });

  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        const allPlayers = [];
        const pairStats = {
          bestTeammate: {},
          worstTeammate: {},
          mostWins: {},
          mostLosses: {},
          mostPairedWith: {},
          leastPairedWith: {},
          winMostWhenInGame: {},
          loseMostWhenInGame: {}
        };

        data.slice(1).forEach((row) => {
          const seats = ["East", "South", "West", "North"];
          seats.forEach((seat, i) => {
            const names = (row[2 + i * 2] || "").split("+").map(n => n.trim()).filter(Boolean);
            const score = Number(row[3 + i * 2]);

            // Process player pairs
            if (names.length === 2) {
              const [p1, p2] = names;
              if (!pairStats.mostPairedWith[p1]) pairStats.mostPairedWith[p1] = 0;
              if (!pairStats.mostPairedWith[p2]) pairStats.mostPairedWith[p2] = 0;
              pairStats.mostPairedWith[p1]++;
              pairStats.mostPairedWith[p2]++;
            }

            if (!allPlayers.includes(names[0])) allPlayers.push(names[0]);
            if (names.length > 1 && !allPlayers.includes(names[1])) allPlayers.push(names[1]);

            names.forEach((player) => {
              if (!pairStats.mostWins[player]) pairStats.mostWins[player] = 0;
              if (!pairStats.mostLosses[player]) pairStats.mostLosses[player] = 0;
              if (!pairStats.bestTeammate[player]) pairStats.bestTeammate[player] = { score: 0, games: 0 };
              if (!pairStats.worstTeammate[player]) pairStats.worstTeammate[player] = { score: 0, games: 0 };

              if (score > 0) {
                pairStats.mostWins[player]++;
                pairStats.bestTeammate[player].score += score;
                pairStats.bestTeammate[player].games++;
                pairStats.winMostWhenInGame[player] = (pairStats.winMostWhenInGame[player] || 0) + 1;
              } else {
                pairStats.mostLosses[player]++;
                pairStats.worstTeammate[player].score += score;
                pairStats.worstTeammate[player].games++;
                pairStats.loseMostWhenInGame[player] = (pairStats.loseMostWhenInGame[player] || 0) + 1;
              }
            });
          });
        });

        const bestTeammate = Object.entries(pairStats.bestTeammate).map(([player, stats]) => {
          const avgScore = stats.score / stats.games;
          return { player, avgScore };
        }).sort((a, b) => b.avgScore - a.avgScore)[0];

        const worstTeammate = Object.entries(pairStats.worstTeammate).map(([player, stats]) => {
          const avgScore = stats.score / stats.games;
          return { player, avgScore };
        }).sort((a, b) => a.avgScore - b.avgScore)[0];

        setPairStats(pairStats);
        setInsight({ bestTeammate, worstTeammate });
        setPlayers(allPlayers);
        setData(data.slice(1));
      });
  }, []);

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Player Insights</h1>
      <label className="block mb-2">Select Player</label>
      <select
        className="bg-gray-800 text-white p-2 mb-4 rounded"
        onChange={(e) => setSelected(e.target.value)}
        value={selected}
      >
        <option value="">-- Choose Player --</option>
        {players.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {selected && insight.bestTeammate && (
        <div className="text-sm space-y-2">
          <p><strong>Best player to partner with:</strong> {insight.bestTeammate.player} with an average score of {insight.bestTeammate.avgScore.toFixed(2)}</p>
          <p><strong>Worst player to partner with:</strong> {insight.worstTeammate.player} with an average score of {insight.worstTeammate.avgScore.toFixed(2)}</p>
          <p><strong>Win most when this player is part of the game:</strong> {pairStats.winMostWhenInGame[selected] || "N/A"}</p>
          <p><strong>Lose most when this player is part of the game:</strong> {pairStats.loseMostWhenInGame[selected] || "N/A"}</p>
          <p><strong>Most frequently paired with:</strong> {pairStats.mostPairedWith[selected] || "N/A"} times</p>
          <p><strong>Least frequently paired with:</strong> {pairStats.leastPairedWith[selected] || "N/A"} times</p>
        </div>
      )}
    </Layout>
  );
}
