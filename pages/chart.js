import Layout from "../components/Layout";
import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

export default function Chart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("/api/sheet")
      .then(res => res.json())
      .then(({ data }) => {
        const playerScores = {};
        data.slice(1).forEach((row, index) => {
          const timestamp = row[1];
          const seats = ["East", "South", "West", "North"];

          seats.forEach((seat, i) => {
            const nameCell = row[2 + i * 2];
            const score = Number(row[3 + i * 2] || 0);
            if (!nameCell) return;
            const players = nameCell.split("+").map((n) => n.trim()).filter(Boolean);
            const share = score / players.length;

            players.forEach((p) => {
              if (!playerScores[p]) playerScores[p] = [];
              const last = playerScores[p].length ? playerScores[p][playerScores[p].length - 1].score : 0;
              playerScores[p].push({ timestamp, score: last + share });
            });
          });
        });

        const timestamps = data.slice(1).map((r) => r[1]);
        const graph = timestamps.map((t, i) => {
          const entry = { timestamp: t };
          for (const p in playerScores) {
            entry[p] = playerScores[p][i]?.score ?? null;
          }
          return entry;
        });

        setData(graph);
      });
  }, []);

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Score Chart</h1>
      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            {data.length > 0 &&
              Object.keys(data[0])
                .filter((k) => k !== "timestamp")
                .map((player) => (
                  <Line
                    key={player}
                    type="monotone"
                    dataKey={player}
                    stroke="#8884d8"
                    dot={false}
                  />
                ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Layout>
  );
}
