import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout"; // Assuming Layout provides main structure

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

  // Fetch and De-duplicate Players by NAME
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
        console.log("Unique players list (by name):", uniquePlayerList);
        setAvailablePlayers(uniquePlayerList);
      })
      .catch((err) => {
        setError("Error fetching or processing players. Ensure /api/players returns correct data including 'name' and 'settleUpMemberId'.");
        console.error(err);
         setAvailablePlayers([]);
      });
  }, []);
  // End Fetch and De-duplicate

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
      console.log("Players state updated:", newPlayers);
      return newPlayers;
    });
  };

  const calculateScore = useCallback((seat, counts) => {
    let total = 0;
    for (const color in counts) { total += counts[color] * colorValues[color]; }
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
    const newSum = Object.values(scores).reduce((sum, score) => sum + parseFloat(score || 0), 0);
    setSumOfScores(parseFloat(newSum.toFixed(1)));
  }, [scores]);

  const triggerSettleUpIntegration = async (gameData) => {
    setMessage(prev => prev + " | Checking Settle Up sync..."); // Initial message
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

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setError("");
    setMessage("");
    setIsSubmitting(true);

    // Validations
    if (Math.abs(sumOfScores) > 0.01) { setError("Sum of scores must be exactly 0."); setIsSubmitting(false); return; }
    const filledSeatsData = seats.map(seat => ({ seat, players: players[seat], score: scores[seat] }));
    const activeSeats = filledSeatsData.filter(s => s.players.length > 0 && s.score !== -200);
    if (activeSeats.length < 2) { setError("At least two seats must have players and scores entered."); setIsSubmitting(false); return; }
    const seatsWithPlayersButNoScore = filledSeatsData.filter(s => s.players.length > 0 && s.score === -200);
    if (seatsWithPlayersButNoScore.length > 0) { setError(`Seat(s) ${seatsWithPlayersButNoScore.map(s=>s.seat).join(', ')} have players selected but no scores entered.`); setIsSubmitting(false); return; }

    // Prepare data
    const sheetPlayersPayload = {};
    for (const seat of seats) { sheetPlayersPayload[seat] = players[seat].map(p => p.name).join(" + "); }
    const adjustedScores = {};
    for (const seat of seats) { adjustedScores[seat] = parseFloat(scores[seat].toFixed(1)); }

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
        setMessage(`Game recorded! ID: ${gameId}`); // Initial success message
        const resultText = seats.map(seat => `${sheetPlayersPayload[seat] || "Empty"} : ${adjustedScores[seat]}`).filter(line => !line.startsWith("Empty")).join("\n");
        setLatestGameResult(resultText);
        navigator.clipboard.writeText(resultText).then(() => setMessage(prev => prev + " | Result copied.")).catch((err) => { console.error("Could not copy text: ", err); setMessage(prev => prev + " | Couldn't copy result."); });

        // 2. Trigger Settle Up (will now handle disabled state message)
        await triggerSettleUpIntegration({ gameId: gameId, scores: adjustedScores, players: players });

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

  // Check if player NAME is selected elsewhere
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

  // Filter available players based on NAME
  const getAvailablePlayersForSeat = (currentSeat) => {
    return availablePlayers.filter(player => !isPlayerSelectedElsewhere(currentSeat, player));
  };

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
      {/* Assuming Layout doesn't force a background, otherwise need to override */}
      {/* Main title - ensure contrast if Layout background is black */}
      <h1 className="text-xl font-bold mb-4 text-white">Score Entry</h1>

      {/* Player Selection Sections */}
      {seats.map((seat) => (
        // *** MODIFIED: Changed background to black, adjusted text/elements inside ***
        <div key={seat} className="mb-6 p-4 border border-gray-700 rounded bg-black text-gray-200">
          <label className="block font-semibold text-lg mb-2 text-white">{seat} Players</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {getAvailablePlayersForSeat(seat).map((player) => (
              <button
                key={player.name}
                onClick={() => handlePlayerSelect(seat, player)}
                // Adjusted button colors for black background
                className={`px-2 py-1 rounded text-xs mt-1 mb-1 text-center whitespace-nowrap transition-colors duration-150 ${
                  players[seat].some(p => p.name === player.name)
                    ? "bg-blue-600 text-white ring-2 ring-blue-400" // Selected: keep blue
                    : "bg-gray-700 hover:bg-gray-600 text-gray-100" // Default: dark gray
                } ${players[seat].length >= MAX_PLAYERS_PER_SEAT && !players[seat].some(p => p.name === player.name) ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={players[seat].length >= MAX_PLAYERS_PER_SEAT && !players[seat].some(p => p.name === player.name)}
                style={{ minWidth: "5ch" }}
              >
                {player.name}
              </button>
            ))}
             {players[seat].length === 0 && <span className="text-xs text-gray-400 italic">Select player(s)</span>}
          </div>

          {/* Color Selection Sections */}
          <label className="block font-semibold text-lg mb-2 text-white">{seat} Colors</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
            {colors.map((color) => (
              // Adjusted background for color selection boxes
              <div key={color} className="flex flex-col items-center p-2 bg-gray-800 rounded shadow-sm">
                <label className="mb-1 font-medium text-sm text-gray-200">{color} ({colorValues[color]})</label>
                <div className="flex items-center justify-center mt-1">
                  {/* Adjusted +/- button colors */}
                  <button onClick={() => handleColorChange(seat, color, -1)} className="px-3 py-1 rounded-l bg-red-800 hover:bg-red-700 text-red-100 font-bold disabled:opacity-50" disabled={colorCounts[seat][color] <= 0}>-</button>
                  {/* Adjusted count display colors */}
                  <div className="px-2 py-1 text-center mx-0 bg-gray-700 font-mono text-sm text-white" style={{ width: `${INPUT_WIDTH_CH + 1}ch`, minWidth: `${INPUT_WIDTH_CH + 1}ch` }}>{colorCounts[seat][color] || 0}</div>
                  <button onClick={() => handleColorChange(seat, color, 1)} className="px-3 py-1 rounded-r bg-green-800 hover:bg-green-700 text-green-100 font-bold">+</button>
                </div>
              </div>
            ))}
          </div>
          {/* Adjusted score text color */}
          <p className="mt-3 font-semibold text-md text-gray-200">
            Seat Score: <span className={scores[seat] >= 0 ? 'text-green-400' : 'text-red-400'}>{scores[seat]}</span>
          </p>
        </div>
        // *** END MODIFIED SECTION ***
      ))}

      {/* Submit Section */}
      {/* *** MODIFIED: Changed background to black, adjusted text inside *** */}
      <div className="mt-4 p-4 border border-gray-700 rounded bg-black sticky bottom-0">
        {/* Adjusted sum text color */}
        <p className={`text-lg font-bold mb-2 ${Math.abs(sumOfScores) > 0.01 ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
            Sum of Scores: {sumOfScores} {Math.abs(sumOfScores) > 0.01 ? '(Must be 0!)' : '(OK)'}
        </p>
        {/* Adjusted error/message text colors */}
        {error && <p className="text-red-400 text-sm break-words">{error}</p>}
        {message && <p className="text-green-400 text-sm break-words">{message}</p>}
        {/* Submit button colors are likely fine */}
        <button onClick={handleSubmit} className={`w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white mt-2 text-lg font-semibold transition-opacity duration-200 ${isSubmitDisabled() ? "opacity-50 cursor-not-allowed" : ""}`} disabled={isSubmitDisabled()}>{isSubmitting ? "Submitting..." : "Submit Game"}</button>
      </div>
       {/* *** END MODIFIED SECTION *** */}


      {/* Result Display */}
      {/* *** MODIFIED: Changed background, adjusted text inside *** */}
      {latestGameResult && (
        <div className="mt-8 p-4 bg-gray-900 rounded-md shadow border border-gray-700">
          <h2 className="text-lg font-semibold mb-2 text-gray-100">Latest Game Result</h2>
          <pre className="whitespace-pre-wrap text-sm text-gray-200 bg-gray-800 p-3 rounded">{latestGameResult}</pre>
        </div>
      )}
       {/* *** END MODIFIED SECTION *** */}
    </Layout>
  );
}
