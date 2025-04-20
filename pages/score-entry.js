import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";

const seats = ["East", "South", "West", "North"];

export default function ScoreEntry() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(null);

  const [players, setPlayers] = useState({
    East: ["", ""],
    South: ["", ""],
    West: ["", ""],
    North: ["", ""],
  });
  const [scores, setScores] = useState({ East: "", South: "", West: "", North: "" });
  const [suggestions, setSuggestions] = useState([]);
  const [allNames, setAllNames] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const admin = sessionStorage.getItem("admin");
    if (admin !== "true") router.replace("/login");
    else setIsAdmin(true);
  }, [router]);

  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        const names = new Set();
        data.slice(1).forEach((row) => {
          for (let i = 2; i <= 8; i += 2) {
            if (row[i]) {
              row[i].split("+").forEach((n) => names.add(n.trim()));
            }
          }
        });
        setAllNames([...names]);
      });
  }, []);

  const handleInput = (seat, index, value) => {
    const newPlayers = { ...players };
    newPlayers[seat][index] = value;
    setPlayers(newPlayers);
    if (value.length > 0) {
      setSuggestions(allNames.filter((n) => n.toLowerCase().startsWith(value.toLowerCase())));
    } else {
      setSuggestions([]);
    }
  };

  const handleScoreInput = (seat, value) => {
    setScores((prev) => ({ ...prev, [seat]: value }));
  };

  const calculateTotal = () =>
    Object.values(scores).reduce((sum, val) => sum + Number(val || 0), 0);

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    const total = calculateTotal();

    if (total !== 0) {
      setError("Scores must sum to 0.");
      return;
    }

    const filled = seats.filter((s) => (players[s][0] || players[s][1]) && scores[s] !== "");
    if (filled.length < 2) {
      setError("At least two seats must be filled.");
      return;
    }

    const flatPlayers = {};
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
            {suggestions.map((name) => (
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
