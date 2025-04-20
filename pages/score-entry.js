
import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function ScoreEntry() {
  const [players, setPlayers] = useState([]);
  const [playerSuggestions, setPlayerSuggestions] = useState([]);
  const [form, setForm] = useState({
    eastPlayer1: "",
    eastPlayer2: "",
    southPlayer1: "",
    southPlayer2: "",
    westPlayer1: "",
    westPlayer2: "",
    northPlayer1: "",
    northPlayer2: "",
    eastScore: "",
    southScore: "",
    westScore: "",
    northScore: "",
  });

  useEffect(() => {
    // Fetch historical player data to populate autocomplete suggestions
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        const playersSet = new Set();
        data.slice(1).forEach((row) => {
          playersSet.add(row[2]); // Add East Player 1
          playersSet.add(row[3]); // Add East Player 2
          playersSet.add(row[5]); // Add South Player 1
          playersSet.add(row[6]); // Add South Player 2
          playersSet.add(row[8]); // Add West Player 1
          playersSet.add(row[9]); // Add West Player 2
          playersSet.add(row[11]); // Add North Player 1
          playersSet.add(row[12]); // Add North Player 2
        });
        setPlayers(Array.from(playersSet)); // Convert set to array
      });
  }, []);

  const handleInputChange = (e, field) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (value) {
      // Filter suggestions based on current input value
      setPlayerSuggestions(
        players.filter((player) => player.toLowerCase().includes(value.toLowerCase()))
      );
    } else {
      setPlayerSuggestions([]);
    }
  };

  const handlePlayerSelection = (selectedPlayer, field) => {
    setForm((prev) => ({ ...prev, [field]: selectedPlayer }));
    setPlayerSuggestions([]); // Clear suggestions after selection
  };

  const handleSubmit = async () => {
    // You can implement the logic to submit the scores to Google Sheets here
  };

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Score Entry</h1>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label>East Player 1</label>
            <input 
              type="text" 
              value={form.eastPlayer1} 
              onChange={(e) => handleInputChange(e, "eastPlayer1")} 
              placeholder="Enter Player 1" 
            />
            {playerSuggestions.length > 0 && (
              <ul className="border bg-gray-700 text-white p-2 max-h-40 overflow-y-auto">
                {playerSuggestions.map((player) => (
                  <li
                    key={player}
                    onClick={() => handlePlayerSelection(player, "eastPlayer1")}
                    className="cursor-pointer hover:bg-gray-600 p-1"
                  >
                    {player}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col">
            <label>East Player 2</label>
            <input 
              type="text" 
              value={form.eastPlayer2} 
              onChange={(e) => handleInputChange(e, "eastPlayer2")} 
              placeholder="Enter Player 2" 
            />
            {playerSuggestions.length > 0 && (
              <ul className="border bg-gray-700 text-white p-2 max-h-40 overflow-y-auto">
                {playerSuggestions.map((player) => (
                  <li
                    key={player}
                    onClick={() => handlePlayerSelection(player, "eastPlayer2")}
                    className="cursor-pointer hover:bg-gray-600 p-1"
                  >
                    {player}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Repeat this for other positions (South, West, North) */}
          {/* For brevity, only East is shown here */}
          <div className="flex flex-col">
            <label>East Score</label>
            <input
              type="number"
              value={form.eastScore}
              onChange={(e) => setForm({ ...form, eastScore: e.target.value })}
              placeholder="Enter Score"
            />
          </div>
          <button type="submit" className="bg-blue-500 text-white p-2 mt-4">Submit</button>
        </div>
      </form>
    </Layout>
  );
}
