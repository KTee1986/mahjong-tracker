import { useEffect, useState, useCallback } from "react"; // Added useCallback
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
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevent double-submit

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
    setPlayers((prevPlayers) => {
      const newPlayers = { ...prevPlayers };
      const seatPlayers = newPlayers[seat];

      if (seatPlayers.includes(playerName)) {
        // Deselect player
        newPlayers[seat] = seatPlayers.filter((p) => p !== playerName);
      } else if (seatPlayers.length < MAX_PLAYERS_PER_SEAT) {
        // Select player if not full
        newPlayers[seat] = [...seatPlayers, playerName];
      }
      return newPlayers;
    });
  };

  // Use useCallback to memoize calculateScore
  const calculateScore = useCallback((seat, counts) => {
    let total = 0;
    for (const color in counts) {
      total += counts[color] * colorValues[color];
    }
    const finalScore = parseFloat(total.toFixed(1)) - 200;
    setScores((prevScores) => ({ ...prevScores, [seat]: finalScore }));
  }, []); // No dependencies needed if colorValues is constant


  const handleColorChange = (seat, color, change) => {
    const newColorCounts = { ...colorCounts };
    const currentValue = newColorCounts[seat][color] || 0;
    const newValue = Math.max(0, currentValue + change); // Ensure non-negative
    newColorCounts[seat][color] = newValue;
    setColorCounts(newColorCounts);
    // Pass the updated counts for the specific seat directly
    calculateScore(seat, newColorCounts[seat]);
  };


  useEffect(() => {
    const newSum = Object.values(scores).reduce(
      (sum, score) => sum + parseFloat(score || 0),
      0
    );
    setSumOfScores(parseFloat(newSum.toFixed(1)));
  }, [scores]);

  // --- Settle Up Integration Logic ---
  const triggerSettleUpIntegration = async (gameData) => {
    setMessage(prev => prev + " | Attempting Settle Up sync...");
    try {
      const settleUpRes = await fetch("/api/settleup-expense", { // NEW: Call your backend endpoint
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send relevant data. Your backend needs this to figure out
        // member IDs, group ID, amounts, payer/payees etc.
        body: JSON.stringify({
          gameId: gameData.gameId, // Pass gameId for reference
          scores: gameData.scores, // e.g., { East: 150, South: -50, West: -50, North: -50 }
          players: gameData.players // e.g., { East: "Alice", South: "Bob", West: "Charlie", North: "David" }
        }),
      });

      const settleUpData = await settleUpRes.json();

      if (settleUpRes.ok) {
        setMessage(prev => prev + " | Settle Up sync successful!");
      } else {
        console.error("Settle Up API Error:", settleUpData.error);
        setError(prev => prev + ` | Settle Up Error: ${settleUpData.error || 'Unknown error'}`);
        setMessage(prev => prev.replace(" | Attempting Settle Up sync...", "")); // Clear attempting message on error
      }
    } catch (err) {
      console.error("Failed to trigger Settle Up integration:", err);
      setError(prev => prev + ` | Failed to connect for Settle Up sync.`);
      setMessage(prev => prev.replace(" | Attempting Settle Up sync...", "")); // Clear attempting message on error
    }
  }
  // --- End Settle Up Integration Logic ---

  const handleSubmit = async () => {
    if (isSubmitting) return; // Prevent double clicks

    setError("");
    setMessage("");
    setIsSubmitting(true);

    // Use a tolerance for floating point comparison
    if (Math.abs(sumOfScores) > 0.01) {
      setError("Sum of scores must be exactly 0.");
      setIsSubmitting(false);
      return;
    }

    // Check if at least one seat has a player AND a non-default score
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

     // Ensure all seats with players also have scores entered (are not -200)
    const seatsWithPlayersButNoScore = filledSeatsData.filter(
        s => s.players.length > 0 && s.score === -200
    );
    if (seatsWithPlayersButNoScore.length > 0) {
        setError(`Seat(s) ${seatsWithPlayersButNoScore.map(s=>s.seat).join(', ')} have players selected but no scores entered (defaulting to -200). Please enter scores or remove players.`);
        setIsSubmitting(false);
        return;
    }


    const flatPlayers = {};
    const adjustedScores = {};
    for (const seat of seats) {
      flatPlayers[seat] = players[seat].join(" + "); // Keep player joining logic
      adjustedScores[seat] = parseFloat(scores[seat].toFixed(1));
    }

    try {
      // 1. Submit to Google Sheet
      const res = await fetch("/api/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: flatPlayers, scores: adjustedScores }),
      });

      const data = await res.json();

      if (res.ok) {
        const gameId = data.gameId;
        setMessage(`Game recorded! ID: ${gameId}`);

        // Prepare result text for display and clipboard
        const resultText = seats
          .map(
            (seat) =>
              `${flatPlayers[seat] || "Empty"} : ${adjustedScores[seat]}`
          )
          .filter(line => !line.startsWith("Empty")) // Don't show empty seats
          .join("\n");

        setLatestGameResult(resultText); // Set the latest game result to state

        // Attempt to copy to clipboard
        navigator.clipboard
          .writeText(resultText)
          .then(() => {
            setMessage(prev => prev + " | Result copied."); // Append confirmation
          })
          .catch((err) => {
            console.error("Could not copy text: ", err);
            // Append warning, don't overwrite original success message
            setMessage(prev => prev + " | Couldn't copy result.");
          });

        // 2. Trigger Settle Up integration (only after successful sheet submission)
        await triggerSettleUpIntegration({
           gameId: gameId,
           scores: adjustedScores, // Send the final scores
           players: flatPlayers // Send the player names (or joined names)
        });


        // Reset form only after everything succeeds (or partially succeeds)
        setPlayers({ East: [], South: [], West: [], North: [] });
        setColorCounts({ East: { Red: 0, Blue: 0, Green: 0, White: 0 }, South: { Red: 0, Blue: 0, Green: 0, White: 0 }, West: { Red: 0, Blue: 0, Green: 0, White: 0 }, North: { Red: 0, Blue: 0, Green: 0, White: 0 } });
        setScores({ East: -200, South: -200, West: -200, North: -200 });
        // setSumOfScores(-800); // This will recalculate automatically via useEffect

      } else {
        setError(data.error || "Error submitting game to sheet.");
      }
    } catch (err) {
      setError("Failed to submit to sheet. Check console.");
      console.error(err);
    } finally {
      setIsSubmitting(false); // Re-enable button
    }
  };

  // Function to check if a player is selected in another seat
  const isPlayerSelectedElsewhere = (seat, playerName) => {
    for (const otherSeat in players) {
      if (otherSeat !== seat && players[otherSeat].includes(playerName)) {
        return true;
      }
    }
    return false;
  };

  // Function to get players available for a specific seat
  const getAvailablePlayersForSeat = (currentSeat) => {
    return availablePlayers.filter(player => !isPlayerSelectedElsewhere(currentSeat, player.name));
  };

  // Disable submit button if sum is not 0 or if any seat has players but default score
  const isSubmitDisabled = () => {
     if (isSubmitting) return true;
     if (Math.abs(sumOfScores) > 0.01) return true;
     const activeSeatsCount = seats.filter(s => players[s].length > 0 && scores[s] !== -200).length;
     if (activeSeatsCount < 2) return true; // Need at least 2 active seats
     const invalidScoreSeats = seats.filter(s => players[s].length > 0 && scores[s] === -200).length;
     if (invalidScoreSeats > 0) return true; // Seats with players must have scores entered

     return false;
  }


  if (isAdmin === null) return <div>Loading...</div>; // Show loading state

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Score Entry</h1>

      {seats.map((seat) => (
        <div key={seat} className="mb-6 p-4 border rounded bg-gray-50">
          <label className="block font-semibold text-lg mb-2">{seat} Players</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {getAvailablePlayersForSeat(seat).map((player) => (
              <button
                key={player.id}
                onClick={() => handlePlayerSelect(seat, player.name)}
                className={`px-2 py-1 rounded text-xs mt-1 mb-1 text-center whitespace-nowrap transition-colors duration-150 ${
                  players[seat].includes(player.name)
                    ? "bg-blue-600 text-white ring-2 ring-blue-300" // Highlight selected
                    : "bg-gray-200 hover:bg-gray-300 text-black"
                } ${players[seat].length >= MAX_PLAYERS_PER_SEAT && !players[seat].includes(player.name) ? "opacity-50 cursor-not-allowed" : ""}`} // Dim if seat is full
                disabled={players[seat].length >= MAX_PLAYERS_PER_SEAT && !players[seat].includes(player.name)}
                style={{ minWidth: "5ch" }} // Slightly wider buttons
              >
                {player.name}
              </button>
            ))}
             {players[seat].length === 0 && <span className="text-xs text-gray-500 italic">Select player(s)</span>}
          </div>

          <label className="block font-semibold text-lg mb-2">{seat} Colors</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2"> {/* Responsive grid */}
            {colors.map((color) => (
              <div key={color} className="flex flex-col items-center p-2 bg-white rounded shadow-sm">
                <label className="mb-1 font-medium text-sm">{color} ({colorValues[color]})</label>
                <div className="flex items-center justify-center mt-1">
                  <button
                    onClick={() => handleColorChange(seat, color, -1)}
                    className="px-3 py-1 rounded-l bg-red-200 hover:bg-red-300 text-red-800 font-bold disabled:opacity-50"
                    disabled={colorCounts[seat][color] <= 0} // Disable if count is 0
                  >
                    -
                  </button>
                  <div
                    className="px-2 py-1 text-center mx-0 bg-gray-100 font-mono text-sm" // Use mono font for numbers
                    style={{ width: `${INPUT_WIDTH_CH + 1}ch`, minWidth: `${INPUT_WIDTH_CH + 1}ch` }} // Ensure width
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


      {/* Display the latest game result */}
      {latestGameResult && (
        <div className="mt-8 p-4 bg-white rounded-md shadow border border-gray-200">
          <h2 className="text-lg font-semibold mb-2 text-gray-800">Latest Game Result</h2>
          <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-3 rounded">{latestGameResult}</pre>
        </div>
      )}
    </Layout>
  );
}