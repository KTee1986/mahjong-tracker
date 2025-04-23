// pages/player-list.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";

const PlayerList = () => {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(null);
  const [players, setPlayers] = useState([]);
  const [newPlayer, setNewPlayer] = useState("");
  // --- NEW: State for the Settle Up Member ID of the new player ---
  const [newSettleUpId, setNewSettleUpId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Loading state for fetch

  useEffect(() => {
    const admin = sessionStorage.getItem("admin");
    if (admin !== "true") {
      router.replace("/login");
    } else {
      setIsAdmin(true);
    }
  }, [router]);

  // Fetch players when admin status is confirmed
  useEffect(() => {
    if (isAdmin) {
      setIsLoading(true);
      fetch("/api/players")
        .then((res) => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then(({ data }) => {
          // Ensure data is an array before setting
          setPlayers(Array.isArray(data) ? data : []);
          if (!Array.isArray(data)) {
              console.warn("Received non-array data from /api/players:", data);
              setError("Received invalid player data format.");
          }
        })
        .catch((err) => {
          setError("Error fetching players.");
          console.error("Fetch error:", err);
        })
        .finally(() => {
            setIsLoading(false);
        });
    }
  }, [isAdmin]); // Re-run if isAdmin changes (specifically, when it becomes true)

  const handleAddPlayer = async () => {
    setError("");
    setMessage("");
    if (!newPlayer.trim()) {
        setError("Player name cannot be empty.");
        return;
    };
    // Optional: Add validation for the Settle Up ID format if needed
    if (!newSettleUpId.trim()) {
        setError("Settle Up Member ID cannot be empty.");
        return;
    }

    try {
      // --- UPDATED: Send both name and settleUpMemberId ---
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: newPlayer.trim(),
            settleUpMemberId: newSettleUpId.trim() // Send the new ID
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Ensure the response includes the full player object including the new ID
        const addedPlayer = data.player || { name: newPlayer.trim(), settleUpMemberId: newSettleUpId.trim(), id: Date.now() }; // Fallback if API doesn't return full object

        setMessage(`${addedPlayer.name} added!`);
        setPlayers([...players, addedPlayer]); // Add the new player to the list
        setNewPlayer("");
        setNewSettleUpId(""); // Clear the Settle Up ID input field
      } else {
        setError(data.error || "Error adding player.");
      }
    } catch (err) {
      setError("Failed to add player. Check console.");
      console.error(err);
    }
  };

  const handleDeletePlayer = async (id) => {
    // --- No changes needed for delete logic ---
    setError("");
    setMessage("");
    // Optimistic UI update (optional): Remove immediately and add back on error
    const originalPlayers = [...players];
    setPlayers(players.filter((p) => p.id !== id));

    try {
      const res = await fetch(`/api/players/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMessage("Player deleted!");
        // Player already removed optimistically
      } else {
        const data = await res.json();
        setError(data.error || "Error deleting player.");
        setPlayers(originalPlayers); // Revert on error
      }
    } catch (err) {
      setError("Failed to delete player. Check console.");
      console.error(err);
      setPlayers(originalPlayers); // Revert on error
    }
  };

  // --- TODO: Implement Edit Player Functionality ---
  // This would typically involve:
  // 1. Adding an "Edit" button to each list item.
  // 2. Handling state to show input fields for editing name and/or SettleUpMemberID.
  // 3. Creating a new API endpoint (e.g., PUT /api/players/[id]) to handle updates.
  // 4. Calling that endpoint from a handleEditPlayer function.
  // const handleEditPlayer = async (id, updatedData) => { ... }

  if (isAdmin === null) return <Layout><div>Loading authentication...</div></Layout>;

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Player List & SettleUp IDs</h1>

      <div className="mb-6 p-4 border rounded bg-gray-50 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Add New Player</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={newPlayer}
            onChange={(e) => setNewPlayer(e.target.value)}
            className="p-2 rounded border border-gray-300 flex-grow"
            placeholder="New Player Name"
          />
          {/* --- NEW: Input for Settle Up Member ID --- */}
          <input
            type="text"
            value={newSettleUpId}
            onChange={(e) => setNewSettleUpId(e.target.value)}
            className="p-2 rounded border border-gray-300 flex-grow"
            placeholder="Settle Up Member ID"
          />
          <button
            onClick={handleAddPlayer}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white"
          >
            Add Player
          </button>
        </div>
      </div>


      {error && <p className="text-red-500 mb-3">{error}</p>}
      {message && <p className="text-green-500 mb-3">{message}</p>}

      <h2 className="text-lg font-semibold mb-3">Current Players</h2>
      {isLoading ? (
           <p>Loading players...</p>
       ) : (
          <ul className="divide-y divide-gray-200 border rounded shadow-sm">
            {/* --- UPDATED: Display Settle Up Member ID --- */}
            {Array.isArray(players) && players.length > 0 ? players.map((player) => (
              <li key={player.id || player.name} className="flex flex-wrap justify-between items-center py-3 px-4 hover:bg-gray-50">
                <div className="flex-1 min-w-0 mr-4">
                    <span className="font-medium text-gray-900">{player.name}</span>
                    <br/>
                    {/* Display the Member ID if it exists */}
                    <span className="text-sm text-gray-500">
                        SettleUp ID: {player.settleUpMemberId || <span className="italic text-red-500">Not Set!</span>}
                    </span>
                </div>
                <div className="flex gap-2 mt-2 sm:mt-0">
                    {/* Placeholder for Edit Button */}
                    {/* <button onClick={() => handleEditPlayer(player.id, { name: player.name, settleUpMemberId: 'new_id' })} className="bg-yellow-500 hover:bg-yellow-600 px-2 py-1 rounded text-white text-xs">Edit</button> */}
                    <button
                      onClick={() => handleDeletePlayer(player.id)}
                      className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-white text-xs"
                    >
                      Delete
                    </button>
                </div>
              </li>
            )) : (
                <li className="py-3 px-4 text-gray-500 italic">No players found.</li>
            )}
          </ul>
       )}
    </Layout>
  );
};

export default PlayerList;