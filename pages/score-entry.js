import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";

const seats = ["East", "South", "West", "North"];
const colors = ["Red", "Blue", "Green", "White"];
const colorValues = { Red: 20, Blue: 10, Green: 2, White: 0.4 };
const MAX_PLAYERS_PER_SEAT = 2;
const INPUT_WIDTH_CH = 3;

export default function ScoreEntry() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(null);
  const [players, setPlayers] = useState({ East: [], South: [], West: [], North: [] });
  const [colorCounts, setColorCounts] = useState({ East: { Red: 0, Blue: 0, Green: 0, White: 0 }, South: { Red: 0, Blue: 0, Green: 0, White: 0 }, West: { Red: 0, Blue: 0, Green: 0, White: 0 }, North: { Red: 0, Blue: 0, Green: 0, White: 0 } });
  const [scores, setScores] = useState({ East: -200, South: -200, West: -200, North: -200 });
  const [availablePlayers, setAvailablePlayers] = useState([]); // Array of UNIQUE { name, settleUpMemberId }
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sumOfScores, setSumOfScores] = useState(-800);
  const [latestGameResult, setLatestGameResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const admin = sessionStorage.getItem("admin");
    if (admin !== "true") router.replace("/login");
    else setIsAdmin(true);
  }, [router]);

  // Fetch and De-duplicate Players
  useEffect(() => {
    fetch("/api/players")
      .then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch players: ${res.statusText}`);
          return res.json();
      })
      .then(({ data }) => {
        if (!Array.isArray(data)) {
             console.error("Invalid player data received (not an array):", data);
             setError("Error: Invalid player data format received from API.");
             setAvailablePlayers([]);
             return;
        }

        // De-duplication logic
        const uniquePlayersMap = new Map();
        data.forEach(player => {
            if (player && player.settleUpMemberId && player.name) {
                if (!uniquePlayersMap.has(player.settleUpMemberId)) {
                    uniquePlayersMap.set(player.settleUpMemberId, player);
                }
            } else {
                 console.warn("Skipping invalid player entry:", player);
            }
        });
        const uniquePlayerList = Array.from(uniquePlayersMap.values());

        console.log("Unique players list fetched and set:", uniquePlayerList);
        setAvailablePlayers(uniquePlayerList);

      })
      .catch((err) => {
        setError("Error fetching or processing players. Ensure /api/players returns correct data including 'settleUpMemberId'.");
        console.error(err);
         setAvailablePlayers([]);
      });
  }, []);
  // End Fetch and De-duplicate

  const handlePlayerSelect = (seat, playerObject) => {
    setPlayers((prevPlayers) => {
      const newPlayers = { ...prevPlayers };
      const seatPlayers = newPlayers[seat];
      const isSelected = seatPlayers.some(p => p.settleUpMemberId === playerObject.settleUpMemberId);

      if (isSelected) {
        newPlayers[seat] = seatPlayers.filter((p) => p.settleUpMemberId !== playerObject.settleUpMemberId);
      } else if (seatPlayers.length < MAX_PLAYERS_PER_SEAT) {
        newPlayers[seat] = [...seatPlayers, playerObject];
      }
      console.log("Players state updated:", newPlayers); // Log state change
      return newPlayers;
    });
  };

  const calculateScore = useCallback((seat, counts) => {
    let total = 0;
    for (const color in counts) {
      total += counts[color] * colorValues[color];
    }
    const finalScore = parseFloat(total.toFixed(1)) - 200;
    setScores((prevScores) => ({ ...prevScores, [seat]: finalScore }));
  }, []);


  const handleColorChange = (seat, color, change) => {
    const newColorCounts = { ...colorCounts };
    const currentValue = newColorCounts[seat][color] || 0;
    const newValue = Math.max(0, currentValue + change);
    newColorCounts[seat][color] = newValue;
    setColorCounts(newColorCounts);
    calculateScore(seat, newColorCounts[seat]);
  };


  useEffect(() => {
    const newSum = Object.values(scores).reduce(
      (sum, score) => sum + parseFloat(score || 0),
      0
    );
    setSumOfScores(parseFloat(newSum.toFixed(1)));
  }, [scores]);


  const triggerSettleUpIntegration = async (gameData) => {
    setMessage(prev => prev + " | Attempting Settle Up sync...");
    try {
      const settleUpRes = await fetch("/api/settleup-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: gameData.gameId,
          scores: gameData.scores,
          players: gameData.players,
        }),
      });

      const settleUpData = await settleUpRes.json();

      if (settleUpRes.ok) {
        setMessage(prev => prev + " | Settle Up sync successful!");
      } else {
        console.error("Settle Up API Error:", settleUpData.error);
        setError(prev => (prev ? prev + " | " : "") + `Settle Up Error: ${settleUpData.error || 'Unknown error'}`);
        setMessage(prev => prev.replace(" | Attempting Settle Up sync...", ""));
      }
    } catch (err) {
      console.error("Failed to trigger Settle Up integration:", err);
      setError(prev => (prev ? prev + " | " : "") + `Failed to connect for Settle Up sync.`);
      setMessage(prev => prev.replace(" | Attempting Settle Up sync...", ""));
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setError("");
    setMessage("");
    setIsSubmitting(true);

    if (Math.abs(sumOfScores) > 0.01) {
      setError("Sum of scores must be exactly 0.");
      setIsSubmitting(false);
      return;
    }

    const filledSeatsData = seats.map(seat => ({
        seat,
        players: players[seat],
        score: scores[seat]
    }));

    const activeSeats = filledSeatsData.filter(
        s => s.players.length > 0 && s.score !== -200
    );

    if (activeSeats.length < 2) {
      setError("At least two seats must have players and scores entered.");
      setIsSubmitting(false);
      return;
    }

    const seatsWithPlayersButNoScore = filledSeatsData.filter(
        s => s.players.length > 0 && s.score === -200
    );
    if (seatsWithPlayersButNoScore.length > 0) {
        setError(`Seat(s) ${seatsWithPlayersButNoScore.map(s=>s.seat).join(', ')} have players selected but no scores entered. Please enter scores or remove players.`);
        setIsSubmitting(false);
        return;
    }

    // Prepare data for Sheet API (needs names)
    const sheetPlayersPayload = {};
    for (const seat of seats) {
        sheetPlayersPayload[seat] = players[seat].map(p => p.name).join(" + ");
    }

    const adjustedScores = {};
    for (const seat of seats) {
      adjustedScores[seat] = parseFloat(scores[seat].toFixed(1));
    }

    try {
      // 1. Submit to Google Sheet
      const res = await fetch("/api/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: sheetPlayersPayload, scores: adjustedScores }),
      });

      const data = await res.json();

      if (res.ok) {
        const gameId = data.gameId;
        setMessage(`Game recorded! ID: ${gameId}`);

        const resultText = seats
          .map(
            (seat) =>
              `${sheetPlayersPayload[seat] || "Empty"} : ${adjustedScores[seat]}`
          )
          .filter(line => !line.startsWith("Empty"))
          .join("\n");

        setLatestGameResult(resultText);

        navigator.clipboard
          .writeText(resultText)
          .then(() => {
            setMessage(prev => prev + " | Result copied.");
          })
          .catch((err) => {
            console.error("Could not copy text: ", err);
            setMessage(prev => prev + " | Couldn't copy result.");
          });

        // 2. Trigger Settle Up
        await triggerSettleUpIntegration({
           gameId: gameId,
           scores: adjustedScores,
           players: players
        });

        // Reset form
        setPlayers({ East: [], South: [], West: [], North: [] });
        setColorCounts({ East: { Red: 0, Blue: 0, Green: 0, White: 0 }, South: { Red: 0, Blue: 0, Green: 0, White: 0 }, West: { Red: 0, Blue: 0, Green: 0, White: 0 }, North: { Red: 0, Blue: 0, Green: 0, White: 0 } });
        setScores({ East: -200, South: -200, West: -200, North: -200 });

      } else {
        setError(data.error || "Error submitting game to sheet.");
      }
    } catch (err) {
      setError("Failed to submit to sheet. Check console.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Checks if a player (by ID) is selected in any seat OTHER than the current one
  const isPlayerSelectedElsewhere = (currentSeat, playerObject) => {
    for (const otherSeat in players) {
      if (otherSeat !== currentSeat) { // Only check other seats
        if (players[otherSeat].some(p => p.settleUpMemberId === playerObject.settleUpMemberId)) {
          return true; // Found in another seat
        }
      }
    }
    return false; // Not found in any other seat
  };

  // --- MODIFIED: Added logging to this function ---
  // Gets the list of players available for selection in a specific seat
  const getAvailablePlayersForSeat = (currentSeat) => {
    // Start with the full unique list of players
    const available = availablePlayers.filter(player => {
        // Check if this player is selected in any *other* seat
        const isElsewhere = isPlayerSelectedElsewhere(currentSeat, player);
        // Keep the player only if they are NOT selected elsewhere
        return !isElsewhere;
    });
    // Log the result of filtering for debugging
    // console.log(`Players available for seat ${currentSeat}:`, available.map(p => `${p.name} (${p.settleUpMemberId})`));
    return available;
  };
  // --- END MODIFIED ---


  const isSubmitDisabled = () => {
     if (isSubmitting) return true;
     if (Math.abs(sumOfScores) > 0.01) return true;
     const activeSeatsCount = seats.filter(s => players[s].length > 0 && scores[s] !== -200).length;
     if (activeSeatsCount < 2) return true;
     const invalidScoreSeats = seats.filter(s => players[s].length > 0 && scores[s] === -200).length;
     if (invalidScoreSeats > 0) return true;
     return false;
  }


  if (isAdmin === null) return <div>Loading...</div>;

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Score Entry</h1>

      {seats.map((seat) => (
        <div key={seat} className="mb-6 p-4 border rounded bg-gray-50">
          <label className="block font-semibold text-lg mb-2">{seat} Players</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {/* Render buttons using the filtered list */}
            {getAvailablePlayersForSeat(seat).map((player) => (
              <button
                key={player.settleUpMemberId}
                onClick={() => handlePlayerSelect(seat, player)}
                className={`px-2 py-1 rounded text-xs mt-1 mb-1 text-center whitespace-nowrap transition-colors duration-150 ${
                  players[seat].some(p => p.settleUpMemberId === player.settleUpMemberId)
                    ? "bg-blue-600 text-white ring-2 ring-blue-300"
                    : "bg-gray-200 hover:bg-gray-300 text-black"
                } ${players[seat].length >= MAX_PLAYERS_PER_SEAT && !players[seat].some(p => p.settleUpMemberId === player.settleUpMemberId) ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={players[seat].length >= MAX_PLAYERS_PER_SEAT && !players[seat].some(p => p.settleUpMemberId === player.settleUpMemberId)}
                style={{ minWidth: "5ch" }}
              >
                {player.name}
              </button>
            ))}
             {players[seat].length === 0 && <span className="text-xs text-gray-500 italic">Select player(s)</span>}
          </div>

          {/* Color selection */}
          <label className="block font-semibold text-lg mb-2">{seat} Colors</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
            {colors.map((color) => (
              <div key={color} className="flex flex-col items-center p-2 bg-white rounded shadow-sm">
                <label className="mb-1 font-medium text-sm">{color} ({colorValues[color]})</label>
                <div className="flex items-center justify-center mt-1">
                  <button
                    onClick={() => handleColorChange(seat, color, -1)}
                    className="px-3 py-1 rounded-l bg-red-200 hover:bg-red-300 text-red-800 font-bold disabled:opacity-50"
                    disabled={colorCounts[seat][color] <= 0}
                  >
                    -
                  </button>
                  <div
                    className="px-2 py-1 text-center mx-0 bg-gray-100 font-mono text-sm"
                    style={{ width: `${INPUT_WIDTH_CH + 1}ch`, minWidth: `${INPUT_WIDTH_CH + 1}ch` }}
                  >
                    {colorCounts[seat][color] || 0}
                  </div>
                  <button
                    onClick={() => handleColorChange(seat, color, 1)}
                    className="px-3 py-1 rounded-r bg-green-200 hover:bg-green-300 text-green-800 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 font-semibold text-md">
            Seat Score: <span className={scores[seat] >= 0 ? 'text-green-600' : 'text-red-600'}>{scores[seat]}</span>
          </p>
        </div>
      ))}

      {/* Submit section */}
      <div className="mt-4 p-4 border rounded bg-gray-100 sticky bottom-0">
        <p className={`text-lg font-bold mb-2 ${Math.abs(sumOfScores) > 0.01 ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>
            Sum of Scores: {sumOfScores} {Math.abs(sumOfScores) > 0.01 ? '(Must be 0!)' : '(OK)'}
        </p>
        {error && <p className="text-red-500 text-sm break-words">{error}</p>}
        {message && <p className="text-green-500 text-sm break-words">{message}</p>}

        <button
          onClick={handleSubmit}
          className={`w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white mt-2 text-lg font-semibold transition-opacity duration-200 ${isSubmitDisabled() ? "opacity-50 cursor-not-allowed" : ""}`}
          disabled={isSubmitDisabled()}
        >
          {isSubmitting ? "Submitting..." : "Submit Game"}
        </button>
      </div>

      {/* Display result section */}
      {latestGameResult && (
        <div className="mt-8 p-4 bg-white rounded-md shadow border border-gray-200">
          <h2 className="text-lg font-semibold mb-2 text-gray-800">Latest Game Result</h2>
          <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-3 rounded">{latestGameResult}</pre>
        </div>
      )}
    </Layout>
  );
}
