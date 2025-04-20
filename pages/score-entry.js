
import Layout from "../components/Layout";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (sessionStorage.getItem("admin") === "true") {
      setIsAdmin(true);
    }
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
      setPlayerSuggestions(
        players.filter((player) => player.toLowerCase().includes(value.toLowerCase()))
      );
    } else {
      setPlayerSuggestions([]);
    }
  };

  const handlePlayerSelection = (selectedPlayer, field) => {
    setForm((prev) => ({ ...prev, [field]: selectedPlayer }));
    setPlayerSuggestions([]);
  };

  const handleLogin = () => {
    if (adminPassword === "admin_password") { // Replace with your actual admin password
      sessionStorage.setItem("admin", "true");
      setIsAdmin(true);
    } else {
      alert("Invalid password!");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin");
    setIsAdmin(false);
    router.push("/login"); // Redirect to login page after logout
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Submit form logic to API
    console.log(form);
  };

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Score Entry</h1>
      {isAdmin ? (
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            {/* East Section */}
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

            {/* Repeat for South, West, North */}

            {/* Score Inputs */}
            <div className="flex flex-col">
              <label>East Score</label>
              <input
                type="number"
                value={form.eastScore}
                onChange={(e) => setForm({ ...form, eastScore: e.target.value })}
                placeholder="Enter Score"
              />
            </div>

            <div className="flex flex-col">
              <label>South Score</label>
              <input
                type="number"
                value={form.southScore}
                onChange={(e) => setForm({ ...form, southScore: e.target.value })}
                placeholder="Enter Score"
              />
            </div>

            <div className="flex flex-col">
              <label>West Score</label>
              <input
                type="number"
                value={form.westScore}
                onChange={(e) => setForm({ ...form, westScore: e.target.value })}
                placeholder="Enter Score"
              />
            </div>

            <div className="flex flex-col">
              <label>North Score</label>
              <input
                type="number"
                value={form.northScore}
                onChange={(e) => setForm({ ...form, northScore: e.target.value })}
                placeholder="Enter Score"
              />
            </div>

            <button type="submit" className="bg-blue-500 text-white p-2 mt-4">Submit</button>
          </div>
          <button onClick={handleLogout} className="bg-red-500 text-white p-2 mt-4">Logout</button>
        </form>
      ) : (
        <div className="flex flex-col items-center">
          <h2>Please Log in</h2>
          <input 
            type="password" 
            value={adminPassword} 
            onChange={(e) => setAdminPassword(e.target.value)} 
            placeholder="Enter Admin Password" 
            className="border p-2 mt-2"
          />
          <button onClick={handleLogin} className="bg-green-500 text-white p-2 mt-2">Login</button>
        </div>
      )}
    </Layout>
  );
}
