
import Layout from "../components/Layout";
import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

export default function Chart() {
  const [data, setData] = useState([]);
  const [playerList, setPlayerList] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);

  useEffect(() => {
    fetch("/api/sheet")
      .then(res => res.json())
      .then(({ data }) => {
        const playerScores = {};
        const timestamps = [];

        data.slice(1).forEach((row, index) => {
          const timestamp = row[1];
          timestamps.push(timestamp);

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

        const graph = timestamps.map((t, i) => {
          const entry = { timestamp: t };
          for (const p in playerScores) {
            entry[p] = playerScores[p][i]?.score ?? null;
          }
          return entry;
        });

        setData(graph);
        setPlayerList(Object.keys(playerScores));
        setSelectedPlayers(Object.keys(playerScores)); // Default to all
      });
  }, []);

  const togglePlayer = (player) => {
    setSelectedPlayers((prev) =>
      prev.includes(player)
        ? prev.filter((p) => p !== player)
        : [...prev, player]
    );
  };

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Score Chart</h1>

      <div className="mb-4">
        <label className="block mb-1 font-semibold">Select Players</label>
        <div className="flex flex-wrap gap-2">
          {playerList.map((player) => (
            <button
              key={player}
              className={`px-2 py-1 text-sm rounded border ${
                selectedPlayers.includes(player)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-gray-800 text-gray-300 border-gray-600"
              }`}
              onClick={() => togglePlayer(player)}
            >
              {player}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            {data.length > 0 &&
              selectedPlayers.map((player) => (
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
