import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function AdvancedStats() {
  const [data, setData] = useState([]);
  //  ✅  Initialize with null or a more appropriate default structure
  const [stats, setStats] = useState({
    mostVolatile: null,
    mostPlayed: null,
    leastPlayed: null,
    biggestWin: null,
    biggestLoss: null
  });

  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        const playerStats = {};
        const timestampedWins = {};

        data.slice(1).forEach((row) => {
          ["East", "South", "West", "North"].forEach((seat, i) => {
            const names = (row[2 + i * 2] || "").split("+").map(n => n.trim()).filter(Boolean);
            const score = Number(row[3 + i * 2] || 0);
            if (!names || !names.length) return;

            names.forEach((player) => {
              if (!playerStats[player]) {
                playerStats[player] = {
                  played: 0,
                  wins: 0,
                  losses: 0,
                  totalScore: 0,
                  scorePerGame: [],
                  highestWin: { score: 0, timestamp: null },
                  highestLoss: { score: 0, timestamp: null }
                };
              }

              playerStats[player].played += 1;
              playerStats[player].totalScore += score;
              playerStats[player].scorePerGame.push(score);

              if (score > 0) {
                playerStats[player].wins += 1;
                if (score > playerStats[player].highestWin.score) {
                  playerStats[player].highestWin = { score, timestamp: row[1] };
                }
              } else {
                playerStats[player].losses += 1;
                if (score < playerStats[player].highestLoss.score) {
                  playerStats[player].highestLoss = { score, timestamp: row[1] };
                }
              }
            });
          });
        });

        const volatilityStats = Object.entries(playerStats).map(([player, stats]) => {
          const variance = stats.scorePerGame.reduce((acc, score) => acc + Math.pow(score - stats.totalScore / stats.played, 2), 0) / stats.played;
          return { player, variance, ...stats };
        }).sort((a, b) => b.variance - a.variance);

        const mostVolatile = volatilityStats[0] || null;  //  ✅  Handle empty results
        const mostPlayed = Object.entries(playerStats).sort(([, a], [, b]) => b.played - a.played)[0]?.[0] || null;  //  ✅  Safely access first element
        const leastPlayed = Object.entries(playerStats).sort(([, a], [, b]) => a.played - b.played)[0]?.[0] || null;  //  ✅  Safely access first element
        const biggestWin = Object.entries(playerStats).sort(([, a], [, b]) => b.highestWin.score - a.highestWin.score)[0]?.[1] || null;  //  ✅  Safely access first element
        const biggestLoss = Object.entries(playerStats).sort(([, a], [, b]) => a.highestLoss.score - b.highestLoss.score)[0]?.[1] || null;  //  ✅  Safely access first element


        setStats({
          mostVolatile,
          mostPlayed,
          leastPlayed,
          biggestWin,
          biggestLoss
        });

        setData(data.slice(1));
      });
  }, []);

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Advanced Stats</h1>
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold">Most Volatile Player</h2>
          {/* ✅  Use optional chaining and null checks */}
          <p>{stats.mostVolatile ? `${stats.mostVolatile.player} with a volatility score of ${stats.mostVolatile.variance?.toFixed(2)}` : "Loading..."}</p>
        </div>
        <div>
          <h2 className="font-semibold">Most Played Player</h2>
          <p>{stats.mostPlayed || "Loading..."}</p>
        </div>
        <div>
          <h2 className="font-semibold">Least Played Player</h2>
          <p>{stats.leastPlayed || "Loading..."}</p>
        </div>
        <div>
          <h2 className="font-semibold">Biggest Win</h2>
          {/* ✅  Use optional chaining and null checks */}
          <p>{stats.biggestWin ? `${stats.biggestWin.player} with ${stats.biggestWin.highestWin.score} on ${stats.biggestWin.highestWin.timestamp}` : "Loading..."}</p>
        </div>
        <div>
          <h2 className="font-semibold">Biggest Loss</h2>
          {/* ✅  Use optional chaining and null checks */}
          <p>{stats.biggestLoss ? `${stats.biggestLoss.player} with ${stats.biggestLoss.highestLoss.score} on ${stats.biggestLoss.highestLoss.timestamp}` : "Loading..."}</p>
        </div>
      </div>
    </Layout>
  );
}