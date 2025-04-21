// pages/score-entry.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";

const seats = ["East", "South", "West", "North"];
const colors = ["Red", "Blue", "Green", "White"];
const colorValues = { Red: 20, Blue: 10, Green: 2, White: 0.4 };

export default function ScoreEntry() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(null);
  const [players, setPlayers] = useState({
    East: ["", ""],
    South: ["", ""],
    West: ["", ""],
    North: ["", ""],
  });
  const [colorCounts, setColorCounts] = useState({
    East: { Red: 0, Blue: 0, Green: 0, White: 0 },
    South: { Red: 0, Blue: 0, Green: 0, White: 0 },
    West: { Red: 0, Blue: 0, Green: 0, White: 0 },
    North: { Red: 0, Blue: 0, Green: 0, White: 0 },
  });
  const [scores, setScores] = useState({ East: 0, South: 0, West: 0, North: 0 });
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const admin = sessionStorage.getItem("admin");
    if (admin !== "true") router.replace("/login");
    else setIsAdmin(true);
  }, [router]);

  useEffect(() => {
    fetch("/api/players")
      .then((res) => res.json())
      .then(({ data }) => {
        setAvailablePlayers(data);
      })
      .catch((err) => {
        setError("Error fetching players.");
        console.error(err);
      });
  }, []);

  const handlePlayerSelect = (seat, index, playerName) => {
    const newPlayers = { ...players };
    newPlayers[seat][index] = playerName === players[seat][index] ? "" : playerName;
    setPlayers(newPlayers);
  };

  const handleColorChange = (seat, color, value) => {
    const newColorCounts = { ...colorCounts };
    newColorCounts[seat][color] = parseFloat(value || 0); // Use parseFloat for decimal
    setColorCounts(newColorCounts);
    calculateScore(seat, newColorCounts[seat]);
  };

  const calculateScore = (seat, counts) => {
    let total = 0;
    for (const color in counts) {
      total += counts[color] * colorValues[color];
    }
    setScores((prevScores) => ({ ...prevScores, [seat]: total.toFixed(1) })); // Corrected: comma instead of semicolon
  };

  const calculateTotal = () =>
    Object.values(scores).reduce((sum, val) => sum + parseFloat(val || 0), 0).toFixed(1); // Keep 1 decimal place

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    const total = calculateTotal();

    if (parseFloat(total) !== 0) {
      setError("Scores must sum to 0.");
      return;
    }

    const filled = seats.filter((s) => (players[s][0] || players[s][1]) && parseFloat(scores[s]) !== 0);
    if (filled.length < 2) {
      setError("At least two seats must be filled.");
      return;
    }

    const flatPlayers = {};
    const adjustedScores = {};
    for (let seat of seats) {
      const p = players[seat].filter(Boolean).join(" + ");
      flatPlayers[seat] = p;
      adjustedScores[seat] = (parseFloat(scores[seat]) - 200).toFixed(1); // Keep 1 decimal place
    }

    try {
      const res = await fetch("/api/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: flatPlayers, scores: adjustedScores }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`Game recorded! ID: ${data.gameId}`);
        setPlayers({
          East: ["", ""],
          South: ["", ""],
          West: ["", ""],
          North: ["", ""],
        });
        setColorCounts({
          East: { Red: 0, Blue: 0, Green: 0, White: 0 },
          South: { Red: 0, Blue: 0, Green: 0, White: 0 },
          West: { Red: 0, Blue: 0, Green: 0, White: 0 },
          North: { Red: 0, Blue: 0, Green: 0, White: 0 },
        });
        setScores({ East: 0, South: 0, West: 0, North: 0 });
      } else {
        setError(data.error || "Error submitting game.");
      }
    } catch (err) {
      setError("Failed to submit. Check console for details.");
      console.error(err);
    }
  };

  const isPlayerAvailable = (playerName) => {
    for (const seat in players) {
      if (players[seat].includes(playerName)) {
        return false;
      }
    }
    return true;
  };

  if (isAdmin === null) return null;

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Score Entry</h1>

      {seats.map((seat) => (
        <div key={seat} className="mb-6">
          <label className="block font-semibold">{seat} Players</label>
          <div>
            <label className="block font-semibold">Player 1:</label>
            <div className="flex flex-wrap gap-1">
              {availablePlayers.map((player) => (
                isPlayerAvailable(player.name) || players[seat][0] === player.name ? (
                  <button
                    key={player.id}
                    onClick={() => handlePlayerSelect(seat, 0, player.name)}
                    className={`px-2 py-1 rounded text-xs mt-1 mb-1 text-center whitespace-nowrap ${
                      players[seat][0] === player.name ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-black"
                    }`}
                    style={{ minWidth: "4ch" }}
                  >
                    {player.name}
                  </button>
                ) : null
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold">Player 2:</label>
            <div className="flex flex-wrap gap-1">
              {availablePlayers.map((player) => (
                isPlayerAvailable(player.name) || players[seat][1] === player.name ? (
                  <button
                    key={player.id}
                    onClick={() => handlePlayerSelect(seat, 1, player.name)}
                    className={`px-2 py-1 rounded text-xs mt-1 mb-1 text-center whitespace-nowrap ${
                      players[seat][1] === player.name ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-black"
                    }`}
                    style={{ minWidth: "4ch" }}
                  >
                    {player.name}
                  </button>
                ) : null
              ))}
            </div>
          </div>

          <label className="block font-semibold mt-2">{seat} Score</label>
          <div className="flex gap-4">
            {colors.map((color) => (
              <div key={color}>
                <label className="block">{color}</label>
                <input
                  type="number"
                  value={colorCounts[seat][color] !== 0 ? colorCounts[seat][color] : ''}
                  onChange={(e) => handleColorChange(seat, color, e.target.value)}
                  className="w-16 p-2 rounded bg-gray-800 text-white mt-1"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <p className="mt-2">Total: {scores[seat]}</p>
        </div>
      ))}

      <p className="text-sm text-gray-400 mb-2">Grand Total: {calculateTotal()}</p>
      {error && <p className="text-red-400">{error}</p>}
      {message && <p className="text-green-400">{message}</p>}

      <button
        onClick={handleSubmit}
        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white mt-4"
      >
        Submit Game
      </button>
    </Layout>
  );
}