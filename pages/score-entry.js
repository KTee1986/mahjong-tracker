
import Layout from "../components/Layout";
import { useState, useEffect } from "react";

export default function ScoreEntry() {
  const [eastPlayer1, setEastPlayer1] = useState("");
  const [eastPlayer2, setEastPlayer2] = useState("");
  const [southPlayer1, setSouthPlayer1] = useState("");
  const [southPlayer2, setSouthPlayer2] = useState("");
  const [westPlayer1, setWestPlayer1] = useState("");
  const [westPlayer2, setWestPlayer2] = useState("");
  const [northPlayer1, setNorthPlayer1] = useState("");
  const [northPlayer2, setNorthPlayer2] = useState("");
  const [eastScore, setEastScore] = useState("");
  const [southScore, setSouthScore] = useState("");
  const [westScore, setWestScore] = useState("");
  const [northScore, setNorthScore] = useState("");
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    fetch("/api/players")
      .then((res) => res.json())
      .then((data) => setPlayers(data));
  }, []);

  const handleSubmit = () => {
    const data = {
      eastPlayer1,
      eastPlayer2,
      southPlayer1,
      southPlayer2,
      westPlayer1,
      westPlayer2,
      northPlayer1,
      northPlayer2,
      eastScore,
      southScore,
      westScore,
      northScore,
    };
    fetch("/api/score-entry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }).then((res) => {
      if (res.ok) {
        alert("Score submitted successfully!");
      } else {
        alert("Error submitting score!");
      }
    });
  };

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Score Entry</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <label>East Players:</label>
          <select
            className="bg-gray-800 text-white border p-2 rounded mb-2"
            value={eastPlayer1}
            onChange={(e) => setEastPlayer1(e.target.value)}
          >
            <option value="">Select Player 1</option>
            {players.map((player) => (
              <option key={player} value={player}>{player}</option>
            ))}
          </select>
          <select
            className="bg-gray-800 text-white border p-2 rounded mb-2"
            value={eastPlayer2}
            onChange={(e) => setEastPlayer2(e.target.value)}
          >
            <option value="">Select Player 2</option>
            {players.map((player) => (
              <option key={player} value={player}>{player}</option>
            ))}
          </select>
          <input
            type="number"
            className="bg-gray-800 text-white border p-2 rounded mb-2"
            placeholder="East Score"
            value={eastScore}
            onChange={(e) => setEastScore(e.target.value)}
          />
        </div>

        <div className="flex flex-col">
          <label>South Players:</label>
          <select
            className="bg-gray-800 text-white border p-2 rounded mb-2"
            value={southPlayer1}
            onChange={(e) => setSouthPlayer1(e.target.value)}
          >
            <option value="">Select Player 1</option>
            {players.map((player) => (
              <option key={player} value={player}>{player}</option>
            ))}
          </select>
          <select
            className="bg-gray-800 text-white border p-2 rounded mb-2"
            value={southPlayer2}
            onChange={(e) => setSouthPlayer2(e.target.value)}
          >
            <option value="">Select Player 2</option>
            {players.map((player) => (
              <option key={player} value={player}>{player}</option>
            ))}
          </select>
          <input
            type="number"
            className="bg-gray-800 text-white border p-2 rounded mb-2"
            placeholder="South Score"
            value={southScore}
            onChange={(e) => setSouthScore(e.target.value)}
          />
        </div>

        <div className="flex flex-col">
          <label>West Players:</label>
          <select
            className="bg-gray-800 text-white border p-2 rounded mb-2"
            value={westPlayer1}
            onChange={(e) => setWestPlayer1(e.target.value)}
          >
            <option value="">Select Player 1</option>
            {players.map((player) => (
              <option key={player} value={player}>{player}</option>
            ))}
          </select>
          <select
            className="bg-gray-800 text-white border p-2 rounded mb-2"
            value={westPlayer2}
            onChange={(e) => setWestPlayer2(e.target.value)}
          >
            <option value="">Select Player 2</option>
            {players.map((player) => (
              <option key={player} value={player}>{player}</option>
            ))}
          </select>
          <input
            type="number"
            className="bg-gray-800 text-white border p-2 rounded mb-2"
            placeholder="West Score"
            value={westScore}
            onChange={(e) => setWestScore(e.target.value)}
          />
        </div>

        <div className="flex flex-col">
          <label>North Players:</label>
          <select
            className="bg-gray-800 text-white border p-2 rounded mb-2"
            value={northPlayer1}
            onChange={(e) => setNorthPlayer1(e.target.value)}
          >
            <option value="">Select Player 1</option>
            {players.map((player) => (
              <option key={player} value={player}>{player}</option>
            ))}
          </select>
          <select
            className="bg-gray-800 text-white border p-2 rounded mb-2"
            value={northPlayer2}
            onChange={(e) => setNorthPlayer2(e.target.value)}
          >
            <option value="">Select Player 2</option>
            {players.map((player) => (
              <option key={player} value={player}>{player}</option>
            ))}
          </select>
          <input
            type="number"
            className="bg-gray-800 text-white border p-2 rounded mb-2"
            placeholder="North Score"
            value={northScore}
            onChange={(e) => setNorthScore(e.target.value)}
          />
        </div>
      </div>
      <button
        onClick={handleSubmit}
        className="bg-blue-500 text-white p-2 rounded mt-4"
      >
        Submit Score
      </button>
    </Layout>
  );
}
