
import Layout from "../components/Layout";
import { useState, useEffect } from "react";

export default function HeadToHead() {
  const [players, setPlayers] = useState([]);
  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");
  const [gameData, setGameData] = useState([]);
  const [comparison, setComparison] = useState(null);

  useEffect(() => {
    fetch("/api/sheet")
      .then(res => res.json())
      .then(({ data }) => {
        const allPlayers = new Set();
        data.slice(1).forEach((row) => {
          ["East", "South", "West", "North"].forEach((seat, i) => {
            const names = (row[2 + i * 2] || "").split("+").map(n => n.trim()).filter(Boolean);
            names.forEach(name => allPlayers.add(name));
          });
        });
        setPlayers(Array.from(allPlayers).sort());
      });
  }, []);

  const comparePlayers = () => {
    fetch("/api/sheet")
      .then(res => res.json())
      .then(({ data }) => {
        const gamesBetweenPlayers = [];
        let netA = 0;
        let netB = 0;
        let totalDifference = 0;
        let gameCount = 0;

        data.slice(1).forEach((row) => {
          const seats = ["East", "South", "West", "North"];
          const seatData = seats.map((seat, i) => {
            return {
              names: (row[2 + i * 2] || "").split("+").map(n => n.trim()).filter(Boolean),
              score: Number(row[3 + i * 2] || 0)
            };
          });

          let scoreA = 0, scoreB = 0;

          seatData.forEach((seat) => {
            if (seat.names.includes(playerA)) scoreA = seat.score;
            if (seat.names.includes(playerB)) scoreB = seat.score;
          });

          if (scoreA !== 0 && scoreB !== 0) {
            gamesBetweenPlayers.push({
              timestamp: row[1],
              scoreA,
              scoreB,
              scoreDifference: scoreA - scoreB
            });

            netA += scoreA;
            netB += scoreB;
            totalDifference += Math.abs(scoreA - scoreB);
            gameCount++;
          }
        });

        const avgDifference = totalDifference / gameCount;

        setComparison({
          netA,
          netB,
          avgDifference,
          games: gamesBetweenPlayers
        });
      });
  };

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Head-to-Head</h1>
      <label className="block mb-2">Select Player A</label>
      <select
        className="bg-gray-800 text-white p-2 mb-4 rounded"
        onChange={(e) => setPlayerA(e.target.value)}
        value={playerA}
      >
        <option value="">-- Choose Player A --</option>
        {players.map((player) => (
          <option key={player} value={player}>{player}</option>
        ))}
      </select>

      <label className="block mb-2">Select Player B</label>
      <select
        className="bg-gray-800 text-white p-2 mb-4 rounded"
        onChange={(e) => setPlayerB(e.target.value)}
        value={playerB}
      >
        <option value="">-- Choose Player B --</option>
        {players.map((player) => (
          <option key={player} value={player}>{player}</option>
        ))}
      </select>

      <button
        className="bg-blue-500 text-white p-2 rounded"
        onClick={comparePlayers}
        disabled={!playerA || !playerB}
      >
        Compare Players
      </button>

      {comparison && (
        <div className="mt-4">
          <p><strong>Games Played:</strong> {comparison.games.length}</p>
          <p><strong>Net Score:</strong> {playerA}: {comparison.netA}, {playerB}: {comparison.netB}</p>
          <p><strong>Average Score Difference:</strong> {comparison.avgDifference.toFixed(2)}</p>

          <h3 className="font-semibold">Game-by-Game Score Differences</h3>
          <ul>
            {comparison.games.map((game, index) => (
              <li key={index}>
                {game.timestamp} - {playerA}: {game.scoreA}, {playerB}: {game.scoreB} (Difference: {game.scoreDifference})
              </li>
            ))}
          </ul>
        </div>
      )}
    </Layout>
  );
}
