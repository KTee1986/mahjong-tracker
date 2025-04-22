// pages/score-entry.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import Select from "react-select"; // Import the react-select library

const seats = ["East", "South", "West", "North"];
const colors = ["Red", "Blue", "Green", "White"];
const colorValues = { Red: 20, Blue: 10, Green: 2, White: 0.4 };

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
        setAvailablePlayers(
          data.map((player) => ({ value: player.name, label: player.name }))
        ); // Format for react-select
      })
      .catch((err) => {
        setError("Error fetching players.");
        console.error(err);
      });
  }, []);

  const handlePlayerSelect = (seat, selectedOptions) => {
    const newPlayers = { ...players };
    newPlayers[seat] = selectedOptions || []; // Store selected options
    setPlayers(newPlayers);
  };

  const handleColorChange = (seat, color, value) => {
    const newColorCounts = { ...colorCounts };
    newColorCounts[seat][color] = parseFloat(value || 0);
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
    for (const seat of seats) {
      flatPlayers[seat] = players[seat].map((p) => p.value).join(" + ");
      adjustedScores[seat] = parseFloat(scores[seat].toFixed(1));
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
          East: [],
          South: [],
          West: [],
          North: [],
        });
        setColorCounts({
          East: { Red: 0, Blue: 0, Green: 0, White: 0 },
          South: { Red: 0, Blue: 0, Green: 0, White: 0 },
          West: { Red: 0, Blue: 0, Green: 0, White: 0 },
          North: { Red: 0, Blue: 0, Green: 0, White: 0 },
        });
        setScores({
          East: -200,
          South: -200,
          West: -200,
          North: -200,
        });
        setSumOfScores(-800);
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
          <Select
            isMulti
            options={availablePlayers}
            value={players[seat]}
            onChange={(selectedOptions) =>
              handlePlayerSelect(seat, selectedOptions)
            }
            placeholder="Select up to 2 players"
            maxMenuHeight={150} // Limit the dropdown height
            styles={{
              control: (provided) => ({
                ...provided,
                backgroundColor: "rgb(31 41 55)", // bg-gray-800 equivalent
                color: "white",
                borderColor: "rgb(75 85 99)", // border-gray-500 equivalent
                borderRadius: "0.375rem", // rounded-md equivalent
                "&:hover": {
                  borderColor: "rgb(156 163 175)", // hover:border-gray-300 equivalent
                },
              }),
              menu: (provided) => ({
                ...provided,
                backgroundColor: "rgb(31 41 55)",
                color: "white",
              }),
              option: (provided, state) => ({
                ...provided,
                color: state.isSelected ? "white" : "white",
                backgroundColor: state.isSelected ? "rgb(59 130 246)" : "rgb(31 41 55)", // blue-500/gray-800 equivalent
                "&:hover": {
                  backgroundColor: state.isSelected ? "rgb(59 130 246)" : "rgb(55 65 81)", // hover:bg-gray-700 equivalent
                },
              }),
              input: (provided) => ({
                ...provided,
                color: "white",
              }),
              singleValue: (provided) => ({
                ...provided,
                color: "white",
              }),
              multiValue: (provided) => ({
                ...provided,
                backgroundColor: "rgb(59 130 246)", // blue-500 equivalent
                color: "white",
                borderRadius: "0.25rem", // rounded-sm equivalent
              }),
              multiValueLabel: (provided) => ({
                ...provided,
                color: "white",
              }),
              multiValueRemove: (provided) => ({
                ...provided,
                color: "white",
                "&:hover": {
                  backgroundColor: "rgb(94 144 249)", // hover:bg-blue-400 equivalent
                },
              }),
            }}
          />

          <label className="block font-semibold mt-2">{seat} Color Counts</label>
          <div className="flex gap-4">
            {colors.map((color) => (
              <div key={color}>
                <label className="block">{color}</label>
                <input
                  type="number"
                  value={colorCounts[seat][color] !== 0 ? colorCounts[seat][color] : ""}
                  onChange={(e) => handleColorChange(seat, color, e.target.value)}
                  className="w-16 p-2 rounded bg-gray-800 text-white mt-1"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <p className="mt-2">
            Score: {scores[seat]}
          </p>
        </div>
      ))}

      <p className="text-sm text-gray-400 mb-2">
        Sum of Scores: {sumOfScores}
      </p>
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