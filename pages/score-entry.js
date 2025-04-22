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
  const [latestGameResult, setLatestGameResult] = useState(null); // State to hold the latest game result

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
    for (const seat of seats) {
      flatPlayers[seat] = players[seat].join(" + ");
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

        // Prepare result text for display and clipboard
        const resultText = seats
          .map(
            (seat) =>
              `${flatPlayers[seat] || "None"} : ${adjustedScores[seat]}`
          )
          .join("\n");

        setLatestGameResult(resultText); // Set the latest game result to state

        navigator.clipboard
          .writeText(resultText)
          .then(() => {
            setMessage(message + " Result copied to clipboard!");
          })
          .catch((err) => {
            console.error("Could not copy text: ", err);
            setMessage(
              message +
                " Could not copy result to clipboard. Please copy manually."
            );
          });
      } else {
        setError(data.error || "Error submitting game.");
      }
    } catch (err) {
      setError("Failed to submit. Check console for details.");
      console.error(err);
    }
  };

  const isPlayerAvailable = (seat, playerName) => {
    for (const otherSeat in players) {
      if (otherSeat !== seat && players[otherSeat].includes(playerName)) {
        return false;
      }
    }
    return true;
  };

  const areAllSeatsFilled = () => {
    return seats.every(seat => players[seat].length > 0);
  };

  const getAvailablePlayers = (currentSeat) => {
    return availablePlayers.filter(player => {
      for (const seat in players) {
        if (seat !== currentSeat && players[seat].includes(player.name)) {
          return false;
        }
      }
      return true;
    });
  };

  if (isAdmin === null) return null;

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Score Entry</h1>

      {seats.map((seat) => (
        <div key={seat} className="mb-6">
          <label className="block font-semibold">{seat} Players</label>
          <div className="flex flex-wrap gap-2">
            {getAvailablePlayers(seat).map((player) => (
              <button
                key={player.id}
                onClick={() => handlePlayerSelect(seat, player.name)}
                className={`px-2 py-1 rounded text-xs mt-1 mb-1 text-center whitespace-nowrap ${
                  players[seat].includes(player.name)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-black"
                }`}
                style={{ minWidth: "4ch" }}
              >
                {player.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-4 mt-2">
            {colors.map((color) => (
              <div key={color} className="flex flex-col items-center">
                <label className="mb-1">{color}</label>
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => handleColorChange(seat, color, -1)}
                    className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-black"
                  >
                    -
                  </button>
                  <div
                    className="px-2 py-1 text-center mx-1"
                    style={{ width: `${INPUT_WIDTH_CH}ch` }}
                  >
                    {colorCounts[seat][color] || 0}
                  </div>
                  <button
                    onClick={() => handleColorChange(seat, color, 1)}
                    className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-black"
                  >
                    +
                  </button>
                </div>
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
        className={`bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white mt-4 ${areAllSeatsFilled() ? "" : "opacity-50 cursor-not-allowed"}`}
        disabled={!areAllSeatsFilled()}
      >
        Submit Game
      </button>

      {/* Display the latest game result */}
      {latestGameResult && (
        <div className="mt-8 p-4 bg-gray-100 rounded-md">
          <h2 className="text-lg font-semibold mb-2">Latest Game Result</h2>
          <pre className="whitespace-pre-wrap">{latestGameResult}</pre>
        </div>
      )}
    </Layout>
  );
}