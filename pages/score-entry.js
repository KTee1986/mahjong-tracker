import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout"; // Assuming Layout provides main structure
import _ from 'lodash'; // Import lodash for deep comparison

const seats = ["East", "South", "West", "North"];
const colors = ["Red", "Blue", "Green", "White"];
const colorValues = { Red: 20, Blue: 10, Green: 2, White: 0.4 };
const MAX_PLAYERS_PER_SEAT = 2;
const INPUT_WIDTH_CH = 3; // Character width for the input

// Define default color counts
const defaultColorCountsPerSeat = { Red: 8, Blue: 2, Green: 9, White: 5 };

// Function to create initial state with defaults
const createInitialColorCounts = () => {
    const initialState = {};
    seats.forEach(seat => {
        initialState[seat] = { ...defaultColorCountsPerSeat };
    });
    return initialState;
};

// Function to calculate score based on counts
const calculateSeatScore = (counts) => {
    let total = 0;
    for (const color in counts) {
        // Treat empty string input as 0 for calculation
        const countValue = counts[color] === '' ? 0 : (counts[color] || 0);
        total += countValue * (colorValues[color] || 0);
    }
    // Round to one decimal place
    return parseFloat(total.toFixed(1)) - 200;
};

export default function ScoreEntry() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(null);
  const [players, setPlayers] = useState({ East: [], South: [], West: [], North: [] });
  const [colorCounts, setColorCounts] = useState(createInitialColorCounts());
  const [scores, setScores] = useState({ East: 0, South: 0, West: 0, North: 0 });
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sumOfScores, setSumOfScores] = useState(0);
  const [latestGameResult, setLatestGameResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Authentication Check
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
        const uniquePlayersMap = new Map();
        data.forEach(player => {
            if (player && player.name && player.settleUpMemberId) {
                if (!uniquePlayersMap.has(player.name)) {
                    uniquePlayersMap.set(player.name, player);
                }
            } else {
                 console.warn("Skipping invalid player entry (missing name or settleUpMemberId):", player);
            }
        });
        const uniquePlayerList = Array.from(uniquePlayersMap.values());
        setAvailablePlayers(uniquePlayerList);
      })
      .catch((err) => {
        setError("Error fetching or processing players.");
        console.error(err);
         setAvailablePlayers([]);
      });
  }, []);

  // Calculate initial scores and sum on mount
  useEffect(() => {
      const initialScores = {};
      let initialSum = 0;
      seats.forEach(seat => {
          const score = calculateSeatScore(colorCounts[seat]);
          initialScores[seat] = score;
          initialSum += score;
      });
      setScores(initialScores);
      setSumOfScores(parseFloat(initialSum.toFixed(1)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Recalculate scores and sum whenever color counts change
  useEffect(() => {
    const newScores = {};
    let newSum = 0;
    seats.forEach(seat => {
        const score = calculateSeatScore(colorCounts[seat]);
        newScores[seat] = score;
        newSum += score;
    });
    setScores(newScores);
    setSumOfScores(parseFloat(newSum.toFixed(1)));
  }, [colorCounts]);

  // Player Selection Logic
  const handlePlayerSelect = (seat, playerObject) => {
    setPlayers((prevPlayers) => {
      const newPlayers = { ...prevPlayers };
      const seatPlayers = newPlayers[seat];
      const isSelectedInSeat = seatPlayers.some(p => p.name === playerObject.name);

      if (isSelectedInSeat) {
        newPlayers[seat] = seatPlayers.filter((p) => p.name !== playerObject.name);
      } else if (seatPlayers.length < MAX_PLAYERS_PER_SEAT) {
         if (!isPlayerSelectedElsewhere(seat, playerObject)) {
             newPlayers[seat] = [...seatPlayers, playerObject];
         } else {
              console.warn(`Player "${playerObject.name}" is already selected in another seat.`);
         }
      }
      return newPlayers;
    });
  };

  const isPlayerSelectedElsewhere = (currentSeat, playerObject) => {
    for (const otherSeat in players) {
      if (otherSeat !== currentSeat) {
        if (players[otherSeat].some(p => p.name === playerObject.name)) {
          return true;
        }
      }
    }
    return false;
  };

  const getAvailablePlayersForSeat = (currentSeat) => {
    return availablePlayers.filter(player => !isPlayerSelectedElsewhere(currentSeat, player));
  };

  // Handle +/- Button Clicks
  const handleColorChange = (seat, color, change) => {
    setColorCounts(prevCounts => {
        const newCounts = { ...prevCounts };
        const currentSeatCounts = { ...newCounts[seat] };
        const currentValue = currentSeatCounts[color] === '' ? 0 : (currentSeatCounts[color] || 0);
        const newValue = Math.max(0, currentValue + change);
        currentSeatCounts[color] = newValue;
        newCounts[seat] = currentSeatCounts;
        return newCounts;
    });
  };

  // Handle Direct Input Change
  const handleColorInputChange = (seat, color, event) => {
      const rawValue = event.target.value;
      const value = parseInt(rawValue, 10);

      if (rawValue === '' || (!isNaN(value) && value >= 0)) {
          setColorCounts(prevCounts => {
              const newCounts = { ...prevCounts };
              const currentSeatCounts = { ...newCounts[seat] };
              currentSeatCounts[color] = rawValue === '' ? '' : value;
              newCounts[seat] = currentSeatCounts;
              return newCounts;
          });
      }
  };

  // Settle Up Integration
  const triggerSettleUpIntegration = async (gameData) => {
    setMessage(prev => prev + " | Checking Settle Up sync...");
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
        setMessage(prev => prev.replace(" | Checking Settle Up sync...", "") + ` | ${settleUpData.message || 'Settle Up status unknown.'}`);
      } else {
        console.error("Settle Up API Error:", settleUpData.error);
        setError(prev => (prev ? prev + " | " : "") + `Settle Up Error: ${settleUpData.error || 'Unknown error'}`);
        setMessage(prev => prev.replace(" | Checking Settle Up sync...", ""));
      }
    } catch (err) {
      console.error("Failed to trigger Settle Up integration:", err);
      setError(prev => (prev ? prev + " | " : "") + `Failed to connect for Settle Up sync.`);
      setMessage(prev => prev.replace(" | Checking Settle Up sync...", ""));
    }
  }

  // Handle Form Submission
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setError("");
    setMessage("");
    setIsSubmitting(true);

    // --- VALIDATION CHECKS ---

    // 1. Check if all seats have default values
    const allSeatsDefault = seats.every(seat =>
        _.isEqual(
            Object.fromEntries(Object.entries(colorCounts[seat]).map(([k, v]) => [k, v === '' ? 0 : v])),
            defaultColorCountsPerSeat
        )
    );
    if (allSeatsDefault) {
        setError("Cannot submit with default values for all seats. Please enter scores.");
        setIsSubmitting(false);
        return;
    }

    // 2. Check if sum of scores is zero
    if (Math.abs(sumOfScores) > 0.01) {
      setError("Sum of scores must be exactly 0.");
      setIsSubmitting(false);
      return;
    }

    // 3. Check for minimum players
    const seatsWithPlayersCount = seats.filter(seat => players[seat].length > 0).length;
    if (seatsWithPlayersCount < 2) {
        setError("At least two seats must have players selected.");
        setIsSubmitting(false);
        return;
    }

    // --- End Validation Checks ---


    // --- Prepare data for API ---
    const sheetPlayersPayload = {};
    seats.forEach(seat => {
        sheetPlayersPayload[seat] = players[seat].map(p => p.name).join(" + ");
    });

    const adjustedScores = {};
    seats.forEach(seat => {
        adjustedScores[seat] = parseFloat(scores[seat].toFixed(1));
    });

    const settleUpPlayersPayload = {};
     seats.forEach(seat => {
        settleUpPlayersPayload[seat] = players[seat];
    });


    // --- API Calls ---
    try {
      // 1. Submit to Google Sheet
      const res = await fetch("/api/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            players: sheetPlayersPayload,
            scores: adjustedScores
        }),
      });
      const data = await res.json();

      if (res.ok) {
        const gameId = data.gameId;
        setMessage(`Game recorded! ID: ${gameId}`);

        const resultText = seats
            .map(seat => `${sheetPlayersPayload[seat] || "Empty"} : ${adjustedScores[seat]}`)
            .filter(line => !line.startsWith("Empty"))
            .join("\n");
        setLatestGameResult(resultText);

        navigator.clipboard.writeText(resultText)
            .then(() => setMessage(prev => prev + " | Result copied."))
            .catch((err) => {
                console.error("Could not copy text: ", err);
                setMessage(prev => prev + " | Couldn't copy result.");
            });

        // 2. Trigger Settle Up Integration
        await triggerSettleUpIntegration({
            gameId: gameId,
            scores: adjustedScores,
            players: settleUpPlayersPayload
        });

        // Reset Form on Success
        setPlayers({ East: [], South: [], West: [], North: [] });
        setColorCounts(createInitialColorCounts());

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

  // Determine if Submit Button Should Be Disabled
  const isSubmitDisabled = () => {
     // Disable if currently submitting
     if (isSubmitting) return true;

     // Disable if all seats have default values
     const allSeatsDefault = seats.every(seat =>
        _.isEqual(
            Object.fromEntries(Object.entries(colorCounts[seat]).map(([k, v]) => [k, v === '' ? 0 : v])),
            defaultColorCountsPerSeat
        )
     );
     if (allSeatsDefault) return true;

     // Disable if sum of scores is not 0
     if (Math.abs(sumOfScores) > 0.01) return true;

     // Disable if less than 2 seats have players
     const seatsWithPlayersCount = seats.filter(seat => players[seat].length > 0).length;
     if (seatsWithPlayersCount < 2) return true;

     // Otherwise, enable
     return false;
  }

  // Render Loading State
  if (isAdmin === null) return <Layout><div className="text-center p-8 text-white">Loading...</div></Layout>;

  // Render Main Component
  return (
    <Layout>
      {/* Main title */}
      <h1 className="text-2xl font-bold mb-6 text-center text-white">Score Entry</h1>

      {/* Grid for Seat Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
          {seats.map((seat) => (
            <div key={seat} className="p-4 border border-gray-700 rounded-lg bg-gray-900 text-gray-200 shadow-md">
              {/* Seat Title */}
              <h2 className="text-xl font-semibold mb-3 text-white border-b border-gray-600 pb-2">{seat}</h2>

              {/* Player Selection */}
              <div className="mb-4">
                  <label className="block font-medium text-md mb-2 text-gray-300">Players</label>
                  <div className="flex flex-wrap gap-2">
                    {getAvailablePlayersForSeat(seat).map((player) => (
                      <button
                        key={player.name}
                        onClick={() => handlePlayerSelect(seat, player)}
                        className={`px-3 py-1 rounded text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                          players[seat].some(p => p.name === player.name)
                            ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
                            : "bg-gray-700 text-gray-100 hover:bg-gray-600 focus:ring-gray-500"
                        } ${
                            players[seat].length >= MAX_PLAYERS_PER_SEAT && !players[seat].some(p => p.name === player.name)
                            ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        disabled={players[seat].length >= MAX_PLAYERS_PER_SEAT && !players[seat].some(p => p.name === player.name)}
                      >
                        {player.name}
                      </button>
                    ))}
                    {availablePlayers.length === 0 && <span className="text-xs text-gray-500 italic">No players loaded</span>}
                    {availablePlayers.length > 0 && getAvailablePlayersForSeat(seat).length === 0 && players[seat].length === 0 && <span className="text-xs text-gray-500 italic">All players assigned</span>}
                    {players[seat].length === 0 && getAvailablePlayersForSeat(seat).length > 0 && <span className="text-xs text-gray-500 italic">Select player(s)</span>}
                  </div>
              </div>

              {/* Color/Score Entry */}
              <div>
                  <label className="block font-medium text-md mb-2 text-gray-300">Colors</label>
                  <div className="grid grid-cols-2 gap-3">
                    {colors.map((color) => (
                      <div key={color} className="flex flex-col items-center p-2 bg-gray-800 rounded shadow-sm border border-gray-700">
                        <label className="mb-1 font-medium text-xs text-gray-400">{color} ({colorValues[color]})</label>
                        <div className="flex items-center justify-center mt-1 w-full">
                          {/* Minus Button */}
                          <button
                              onClick={() => handleColorChange(seat, color, -1)}
                              className="px-3 py-1 rounded-l bg-red-700 hover:bg-red-600 text-red-100 font-bold disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 focus:ring-offset-gray-800"
                              disabled={(colorCounts[seat][color] === '' || (colorCounts[seat][color] || 0) <= 0) || isSubmitting}
                          >
                              -
                          </button>
                          {/* Editable Input */}
                          <input
                              type="number"
                              min="0"
                              value={colorCounts[seat][color]}
                              onChange={(e) => handleColorInputChange(seat, color, e)}
                              className="px-1 py-1 text-center font-mono text-sm text-white bg-gray-700 border-t border-b border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 no-spinner"
                              style={{ width: `${INPUT_WIDTH_CH + 2}ch` }}
                              disabled={isSubmitting}
                              placeholder="0"
                          />
                          {/* Plus Button */}
                          <button
                              onClick={() => handleColorChange(seat, color, 1)}
                              className="px-3 py-1 rounded-r bg-green-700 hover:bg-green-600 text-green-100 font-bold focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={isSubmitting}
                          >
                              +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
              </div>

              {/* Seat Score Display */}
              <p className="mt-4 text-right font-semibold text-lg">
                Score: <span className={`ml-2 px-2 py-1 rounded ${scores[seat] >= 0 ? 'text-green-300 bg-green-900 bg-opacity-50' : 'text-red-300 bg-red-900 bg-opacity-50'}`}>
                    {scores[seat]}
                </span>
              </p>
            </div>
          ))}
      </div> {/* End Grid for Seat Sections */}

      {/* Submit Section - Sticky Footer */}
      <div className="sticky bottom-0 mt-6 p-4 border-t border-gray-700 bg-gray-900 shadow-inner">
        <div className="max-w-3xl mx-auto">
            {/* Sum of Scores Display */}
            <p className={`text-xl font-bold mb-3 text-center ${Math.abs(sumOfScores) > 0.01 ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
                Sum of Scores: {sumOfScores} {Math.abs(sumOfScores) > 0.01 ? '(Must be 0!)' : ''}
            </p>
            {/* Error/Message Display */}
            {error && <p className="text-red-400 text-sm break-words mb-2 text-center bg-red-900 bg-opacity-40 p-2 rounded border border-red-700">{error}</p>}
            {message && <p className="text-green-400 text-sm break-words mb-2 text-center bg-green-900 bg-opacity-40 p-2 rounded border border-green-700">{message}</p>}
            {/* Submit Button */}
            <button
                onClick={handleSubmit}
                className={`w-full bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded text-white text-lg font-semibold transition-opacity duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500`}
                disabled={isSubmitDisabled()} // Uses the updated validation logic
            >
                {isSubmitting ? "Submitting..." : "Submit Game"}
            </button>
        </div>
      </div>

      {/* Result Display Area */}
      {latestGameResult && (
        <div className="mt-8 mb-8 max-w-3xl mx-auto p-4 bg-gray-800 rounded-md shadow border border-gray-700">
          <h2 className="text-lg font-semibold mb-3 text-gray-100 border-b border-gray-600 pb-2">Latest Game Result (Copied)</h2>
          <pre className="whitespace-pre-wrap text-sm text-gray-200 bg-gray-700 p-3 rounded font-mono">{latestGameResult}</pre>
        </div>
      )}

      {/* CSS to hide number input spinners */}
      <style jsx global>{`
        .no-spinner::-webkit-outer-spin-button,
        .no-spinner::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinner {
          -moz-appearance: textfield; /* Firefox */
        }
      `}</style>
    </Layout>
  );
}
