// pages/player-list.js  (formerly admin.js)
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";

const PlayerList = () => {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(null);
  const [players, setPlayers] = useState([]);
  const [newPlayer, setNewPlayer] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const admin = sessionStorage.getItem("admin");
    if (admin !== "true") {
      router.replace("/login");
    } else {
      setIsAdmin(true);
    }
  }, [router]);

  useEffect(() => {
    fetch("/api/players")
      .then((res) => res.json())
      .then(({ data }) => {
        setPlayers(data);
      })
      .catch((err) => {
        setError("Error fetching players.");
        console.error(err);
      });
  }, []);

  const handleAddPlayer = async () => {
    setError("");
    setMessage("");
    if (!newPlayer.trim()) return;

    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPlayer.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`${newPlayer} added!`);
        setPlayers([...players, data.player]);
        setNewPlayer("");
      } else {
        setError(data.error || "Error adding player.");
      }
    } catch (err) {
      setError("Failed to add player. Check console.");
      console.error(err);
    }
  };

  const handleDeletePlayer = async (id) => {
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/players/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMessage("Player deleted!");
        setPlayers(players.filter((p) => p.id !== id));
      } else {
        const data = await res.json();
        setError(data.error || "Error deleting player.");
      }
    } catch (err) {
      setError("Failed to delete player. Check console.");
      console.error(err);
    }
  };

  if (isAdmin === null) return null;

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Player List</h1>

      <div className="mb-4">
        <input
          type="text"
          value={newPlayer}
          onChange={(e) => setNewPlayer(e.target.value)}
          className="p-2 rounded bg-gray-800 text-white mr-2"
          placeholder="New Player Name"
        />
        <button
          onClick={handleAddPlayer}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white"
        >
          Add Player
        </button>
      </div>

      {error && <p className="text-red-400">{error}</p>}
      {message && <p className="text-green-400">{message}</p>}

      <ul>
        {players.map((player) => (
          <li key={player.id} className="flex justify-between items-center py-2 border-b border-gray-700">
            {player.name}
            <button
              onClick={() => handleDeletePlayer(player.id)}
              className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-white text-xs"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </Layout>
  );
};

export default PlayerList;