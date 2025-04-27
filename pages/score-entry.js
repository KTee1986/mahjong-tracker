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

  // --- MODIFIED: Store array of player objects { name, settleUpMemberId } per seat ---
  const [players, setPlayers] = useState({
    East: [],
    South: [],
    West: [],
    North: [],
  });
  // --- END MODIFIED ---

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

  // --- MODIFIED: Expect players with { name, settleUpMemberId } ---
  const [availablePlayers, setAvailablePlayers] = useState([]); // Array of { name, settleUpMemberId }
  // --- END MODIFIED ---

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

  useEffect(() => {
    // --- MODIFIED: Fetch players, expecting settleUpMemberId ---
    fetch("/api/players") // Ensure this API returns [{ name, settleUpMemberId }, ...]
      .then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch players: ${res.statusText}`);
          return res.json();
      })
      .then(({ data }) => {
        // Validate data structure
        if (!Array.isArray(data) || (data.length > 0 && (!data[0].name || !data[0].settleUpMemberId))) {
            console.error("Invalid player data received:", data);
            setError("Error: Invalid player data format received from API. Expected [{ name, settleUpMemberId }, ...]");
            setAvailablePlayers([]); // Set to empty array on error
        } else {
            setAvailablePlayers(data);
        }
      })
      .catch((err) => {
        setError("Error fetching players. Ensure /api/players returns correct data including 'settleUpMemberId'.");
        console.error(err);
         setAvailablePlayers([]); // Set to empty array on fetch error
      });
     // --- END MODIFIED ---
  }, []);

  // --- MODIFIED: Handle player OBJECT selection ---
  const handlePlayerSelect = (seat, playerObject) => {
    setPlayers((prevPlayers) => {
      const newPlayers = { ...prevPlayers };
      const seatPlayers = newPlayers[seat]; // Array of player objects
      const isSelected = seatPlayers.some(p => p.settleUpMemberId === playerObject.settleUpMemberId);

      if (isSelected) {
        // Deselect player by filtering based on ID
        newPlayers[seat] = seatPlayers.filter((p) => p.settleUpMemberId !== playerObject.settleUpMemberId);
      } else if (seatPlayers.length < MAX_PLAYERS_PER_SEAT) {
        // Select player object if not full
        newPlayers[seat] = [...seatPlayers, playerObject];
      }
      // No change if seat is full and player wasn't selected
      return newPlayers;
    });
  };
  // --- END MODIFIED ---

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

  // --- MODIFIED: Send structured player data to Settle Up API ---
  const triggerSettleUpIntegration = async (gameData) => {
    setMessage(prev => prev + " | Attempting Settle Up sync...");
    try {
      const settleUpRes = await fetch("/api/settleup-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: gameData.gameId,
          scores: gameData.scores, // Send scores as before { East: 100, ... }
          // Send the structured players state directly
          // Backend will extract settleUpMemberId
          players: gameData.players, // Send { East: [{ name, id }, ...], ... }
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
  // --- END MODIFIED ---

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
        players: players[seat], // Array of player objects
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

    // --- MODIFIED: Prepare data for Sheet API (needs names) ---
    const sheetPlayersPayload = {};
    for (const seat of seats) {
        // Extract names from player objects and join them
        sheetPlayersPayload[seat] = players[seat].map(p => p.name).join(" + ");
    }
    // --- END MODIFIED ---

    const adjustedScores = {};
    for (const seat of seats) {
      adjustedScores[seat] = parseFloat(scores[seat].toFixed(1));
    }

    try {
      // 1. Submit to Google Sheet (using names)
      const res = await fetch("/api/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send payload with joined names
        body: JSON.stringify({ players: sheetPlayersPayload, scores: adjustedScores }),
      });

      const data = await res.json();

      if (res.ok) {
        const gameId = data.gameId;
        setMessage(`Game recorded! ID: ${gameId}`);

        // Prepare result text using names
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

        // --- MODIFIED: Trigger Settle Up using the original players state (with objects) ---
        await triggerSettleUpIntegration({
           gameId: gameId,
           scores: adjustedScores,
           players: players // Send the state containing player objects { name, settleUpMemberId }
        });
        // --- END MODIFIED ---

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

  // --- MODIFIED: Check based on player ID ---
  const isPlayerSelectedElsewhere = (seat, playerObject) => {
    for (const otherSeat in players) {
      if (otherSeat !== seat && players[otherSeat].some(p => p.settleUpMemberId === playerObject.settleUpMemberId)) {
        return true;
      }
    }
    return false;
  };

  const getAvailablePlayersForSeat = (currentSeat) => {
    // Filter availablePlayers based on whether their ID is selected elsewhere
    return availablePlayers.filter(player => !isPlayerSelectedElsewhere(currentSeat, player));
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
            {/* --- MODIFIED: Iterate available players and pass object to handler --- */}
            {getAvailablePlayersForSeat(seat).map((player) => (
              <button
                key={player.settleUpMemberId} // Use ID as key
                onClick={() => handlePlayerSelect(seat, player)} // Pass the whole object
                className={`px-2 py-1 rounded text-xs mt-1 mb-1 text-center whitespace-nowrap transition-colors duration-150 ${
                  // Check if player ID is in the selected list for the seat
                  players[seat].some(p => p.settleUpMemberId === player.settleUpMemberId)
                    ? "bg-blue-600 text-white ring-2 ring-blue-300"
                    : "bg-gray-200 hover:bg-gray-300 text-black"
                } ${players[seat].length >= MAX_PLAYERS_PER_SEAT && !players[seat].some(p => p.settleUpMemberId === player.settleUpMemberId) ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={players[seat].length >= MAX_PLAYERS_PER_SEAT && !players[seat].some(p => p.settleUpMemberId === player.settleUpMemberId)}
                style={{ minWidth: "5ch" }}
              >
                {player.name} {/* Display name */}
              </button>
            ))}
             {/* --- END MODIFIED --- */}
             {players[seat].length === 0 && <span className="text-xs text-gray-500 italic">Select player(s)</span>}
          </div>

          {/* Color selection remains the same */}
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

      {/* Submit section remains mostly the same */}
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

      {/* Display result section remains the same */}
      {latestGameResult && (
        <div className="mt-8 p-4 bg-white rounded-md shadow border border-gray-200">
          <h2 className="text-lg font-semibold mb-2 text-gray-800">Latest Game Result</h2>
          <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-3 rounded">{latestGameResult}</pre>
        </div>
      )}
    </Layout>
  );
}
