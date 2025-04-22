// pages/score-entry.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";

const seats = ["East", "South", "West", "North"];
const colors = ["Red", "Blue", "Green", "White"];
const colorValues = { Red: 20, Blue: 10, Green: 2, White: 0.4 };
const MAX_PLAYERS_PER_SEAT = 2;
const INPUT_WIDTH_CH = 3; // Adjusted width for display

export default function ScoreEntry() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(null);
  const [players, setPlayers] = useState({
    East: [],
    South: [],
    West: [],
    North: [],
  });
  const [colorCounts, setColorCounts] = useState({
    East: { Red: 0, Blue: 0, Green: 0, White: 0 },
    South: { Red: 0, Blue: 0, Green: 0, White: 0 },
    West: { Red: 0, Blue: 0, Green: 0, White: 0 },
    North: { Red: 0, Blue: 0, Green: 0, White: 0 },
  });
  const [scores, setScores] = useState({
    East: -200,
    South: -200,
    West: -200,
    North: -200,
  });
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sumOfScores, setSumOfScores] = useState(-800);

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

  const handlePlayerSelect = (seat, playerName) => {
    const newPlayers = { ...players };
    const seatPlayers = newPlayers[seat];

    if (seatPlayers.includes(playerName)) {
      // Deselect player
      newPlayers[seat] = seatPlayers.filter((p) => p !== playerName);
    } else if (seatPlayers.length < MAX_PLAYERS_PER_SEAT) {
      // Select player if not full
      newPlayers[seat] = [...seatPlayers, playerName];
    }
    setPlayers(newPlayers);
  };

  const handleColorChange = (seat, color, change) => {
    const newColorCounts = { ...colorCounts };
    const currentValue = newColorCounts[seat][color] || 0;
    const newValue = Math.max(0, currentValue + change); // Ensure non-negative
    newColorCounts[seat][color] = newValue;
    setColorCounts(newColorCounts);
    calculateScore(seat, newColorCounts[seat]);
  };

  const calculateScore = (seat, counts) => {
    let total = 0;
    for (const color in counts) {
      total += counts[color] * colorValues[color];
    }
    setScores((prevScores) => ({ ...prevScores, [seat]: parseFloat(total.toFixed(1)) - 200 }));
  };

  useEffect(() => {
    const newSum = Object.values(scores).reduce(
      (sum, score) => sum + parseFloat(score || 0),
      0
    );
    setSumOfScores(parseFloat(newSum.toFixed(1)));
  }, [scores]);

  const handleSubmit = async () => {
    setError("");
    setMessage("");

    if (parseFloat(sumOfScores.toFixed(1)) !== 0) {
      setError("Sum of scores must be 0.");
      return;
    }

    const filled = seats.filter(
      (s) => players[s].length > 0 && parseFloat(scores[s]) !== -200
    );
    if (filled.length < 2) {
      setError("At least two seats must be filled.");
      return;
    }

    const flatPlayers = {};
    const adjustedScores = {};
    for (let seat of seats) {
      const p = players[seat].filter(Boolean).join(" + ");
      flatPlayers[seat] = p;
    }

    try {
      const res = await fetch("/api/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: flatPlayers, scores }),
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
        setScores({ East: "", South: "", West: "", North: "" });
      } else {
        setError(data.error || "Error submitting game.");
      }
    } catch (err) {
      setError("Failed to submit. Check console for details.");
      console.error(err);
    }
  };

  if (isAdmin === null) return null;

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Score Entry</h1>

      {seats.map((seat) => (
        <div key={seat} className="mb-6">
          <label className="block font-semibold">{seat} Players</label>
          <div className="flex gap-2">
            {[0, 1].map((i) => (
              <input
                key={i}
                type="text"
                value={players[seat][i]}
                onChange={(e) => handleInput(seat, i, e.target.value)}
                className="w-full p-2 rounded bg-gray-800 text-white mt-1"
                placeholder={`Player ${i + 1}`}
                list={`autocomplete-${seat}-${i}`}
              />
            ))}
          </div>
          <datalist id={`autocomplete-${seat}-0`}>
            {Array.isArray(suggestions) && suggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <label className="block font-semibold mt-2">{seat} Score</label>
          <input
            type="number"
            value={scores[seat]}
            onChange={(e) => handleScoreInput(seat, e.target.value)}
            className="w-full p-2 rounded bg-gray-800 text-white mt-1"
            placeholder="e.g., -5"
          />
        </div>
      ))}

      <p className="text-sm text-gray-400 mb-2">Total: {calculateTotal()}</p>
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