
import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function PlayerInsights() {
  const [data, setData] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState("");
  const [insight, setInsight] = useState({});

  useEffect(() => {
    fetch("/api/sheet")
      .then(res => res.json())
      .then(({ data }) => {
        const all = [];
        data.slice(1).forEach((row) => {
          ["East", "South", "West", "North"].forEach((seat, i) => {
            const names = (row[2 + i * 2] || "").split("+").map(n => n.trim()).filter(Boolean);
            all.push(...names);
          });
        });
        const unique = [...new Set(all)].sort();
        setPlayers(unique);
        setData(data.slice(1));
      });
  }, []);

  useEffect(() => {
    if (!selected || !data.length) return;
    const opponents = {};

    data.forEach((row) => {
      const seatData = [
        [row[2], Number(row[3])], // East
        [row[4], Number(row[5])],
        [row[6], Number(row[7])],
        [row[8], Number(row[9])]
      ];

      const involved = seatData.find(([p]) => p?.includes(selected));
      if (!involved) return;

      const [playerStr, playerScore] = involved;
      const selfSplit = playerStr.split("+").map(s => s.trim());
      const selfShare = playerScore / selfSplit.length;

      seatData.forEach(([oppStr, oppScore]) => {
        if (!oppStr || oppStr.includes(selected)) return;
        const oppSplit = oppStr.split("+").map(s => s.trim());
        const oppShare = oppScore / oppSplit.length;

        oppSplit.forEach((opp) => {
          if (!opponents[opp]) opponents[opp] = 0;
          opponents[opp] -= selfShare;
        });
      });
    });

    const sorted = Object.entries(opponents).sort((a, b) => b[1] - a[1]);
    setInsight({
      best: sorted[0],
      worst: sorted[sorted.length - 1],
    });
  }, [selected, data]);

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

      {selected && insight.best && (
        <div className="text-sm space-y-2">
          <p><strong>Best vs:</strong> {insight.best[0]} (+{insight.best[1].toFixed(2)})</p>
          <p><strong>Worst vs:</strong> {insight.worst[0]} ({insight.worst[1].toFixed(2)})</p>
        </div>
      )}
    </Layout>
  );
}
