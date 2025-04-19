import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function Stats() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        const stats = {};
        data.slice(1).forEach(row => {
          const seats = ["East", "South", "West", "North"];
          seats.forEach((seat, i) => {
            const player = row[2 + i * 2];
            const score = Number(row[3 + i * 2] || 0);
            if (!player) return;
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
            s.totalScore += score;
            if (score > 0) s.positiveGames += 1;
            s.highest = Math.max(s.highest, score);
            s.lowest = Math.min(s.lowest, score);
          });
        });

        const table = Object.values(stats).map(s => ({
          player: s.player,
          games: s.totalGames,
          winRate: ((s.positiveGames / s.totalGames) * 100).toFixed(1) + '%',
          average: (s.totalScore / s.totalGames).toFixed(2),
          highest: s.highest,
          lowest: s.lowest
        }));

        setRows(table);
      });
  }, []);

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Stats</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border-collapse border border-gray-700">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="border border-gray-700 p-2">Player</th>
              <th className="border border-gray-700 p-2">Games</th>
              <th className="border border-gray-700 p-2">Win Rate</th>
              <th className="border border-gray-700 p-2">Avg Score</th>
              <th className="border border-gray-700 p-2">Highest</th>
              <th className="border border-gray-700 p-2">Lowest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.player}>
                <td className="border border-gray-700 p-2">{row.player}</td>
                <td className="border border-gray-700 p-2">{row.games}</td>
                <td className="border border-gray-700 p-2">{row.winRate}</td>
                <td className="border border-gray-700 p-2">{row.average}</td>
                <td className="border border-gray-700 p-2">{row.highest}</td>
                <td className="border border-gray-700 p-2">{row.lowest}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
