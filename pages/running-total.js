
import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function RunningTotal() {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        const scores = {};

        data.slice(1).forEach((row) => {
          const seatPairs = [
            [row[2], row[3]], // East
            [row[4], row[5]], // South
            [row[6], row[7]], // West
            [row[8], row[9]], // North
          ];

          seatPairs.forEach(([playersStr, scoreStr]) => {
            if (!playersStr || !scoreStr) return;
            const seatScore = Number(scoreStr);
            const splitPlayers = playersStr.split("+").map((p) => p.trim()).filter(Boolean);
            const portion = seatScore / splitPlayers.length;

            splitPlayers.forEach((name) => {
              if (!scores[name]) scores[name] = 0;
              scores[name] += portion;
            });
          });
        });

        const result = Object.entries(scores)
          .map(([name, total]) => ({ name, total: total.toFixed(2) }))
          .sort((a, b) => b.total - a.total);

        setPlayers(result);
      });
  }, []);

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Running Total</h1>
      <div className="max-w-md mx-auto">
        {players.map((p, index) => (
          <div key={index} className="flex justify-between p-2 border-b border-gray-700">
            <span>{p.name}</span>
            <span className="font-mono">{p.total}</span>
          </div>
        ))}
        {players.length === 0 && <p className="text-gray-400 mt-4">No data available.</p>}
      </div>
    </Layout>
  );
}
