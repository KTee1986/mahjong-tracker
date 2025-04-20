
import Layout from "../components/Layout";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function ScoreEntry() {
  const [isAdmin, setIsAdmin] = useState(null);
  const [eastPlayer1, setEastPlayer1] = useState("");
  const [eastPlayer2, setEastPlayer2] = useState("");
  const [eastScore, setEastScore] = useState("");
  const [southPlayer1, setSouthPlayer1] = useState("");
  const [southPlayer2, setSouthPlayer2] = useState("");
  const [southScore, setSouthScore] = useState("");
  const [westPlayer1, setWestPlayer1] = useState("");
  const [westPlayer2, setWestPlayer2] = useState("");
  const [westScore, setWestScore] = useState("");
  const [northPlayer1, setNorthPlayer1] = useState("");
  const [northPlayer2, setNorthPlayer2] = useState("");
  const [northScore, setNorthScore] = useState("");
  const router = useRouter();

  useEffect(() => {
    const admin = sessionStorage.getItem("admin");
    if (admin !== "true") {
      router.replace("/login");
    } else {
      setIsAdmin(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const gameData = {
      east: { player1: eastPlayer1, player2: eastPlayer2, score: eastScore },
      south: { player1: southPlayer1, player2: southPlayer2, score: southScore },
      west: { player1: westPlayer1, player2: westPlayer2, score: westScore },
      north: { player1: northPlayer1, player2: northPlayer2, score: northScore },
      timestamp: new Date().toISOString(),
    };
    await fetch("/api/sheet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gameData),
    });
    // Reset form after submission
    setEastPlayer1("");
    setEastPlayer2("");
    setEastScore("");
    setSouthPlayer1("");
    setSouthPlayer2("");
    setSouthScore("");
    setWestPlayer1("");
    setWestPlayer2("");
    setWestScore("");
    setNorthPlayer1("");
    setNorthPlayer2("");
    setNorthScore("");
  };

  if (isAdmin === null) return null; // Wait for login check

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Score Entry</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>East Players:</label>
          <input
            type="text"
            value={eastPlayer1}
            onChange={(e) => setEastPlayer1(e.target.value)}
            placeholder="Player 1"
          />
          <input
            type="text"
            value={eastPlayer2}
            onChange={(e) => setEastPlayer2(e.target.value)}
            placeholder="Player 2"
          />
          <input
            type="number"
            value={eastScore}
            onChange={(e) => setEastScore(e.target.value)}
            placeholder="Score"
          />
        </div>
        <div>
          <label>South Players:</label>
          <input
            type="text"
            value={southPlayer1}
            onChange={(e) => setSouthPlayer1(e.target.value)}
            placeholder="Player 1"
          />
          <input
            type="text"
            value={southPlayer2}
            onChange={(e) => setSouthPlayer2(e.target.value)}
            placeholder="Player 2"
          />
          <input
            type="number"
            value={southScore}
            onChange={(e) => setSouthScore(e.target.value)}
            placeholder="Score"
          />
        </div>
        <div>
          <label>West Players:</label>
          <input
            type="text"
            value={westPlayer1}
            onChange={(e) => setWestPlayer1(e.target.value)}
            placeholder="Player 1"
          />
          <input
            type="text"
            value={westPlayer2}
            onChange={(e) => setWestPlayer2(e.target.value)}
            placeholder="Player 2"
          />
          <input
            type="number"
            value={westScore}
            onChange={(e) => setWestScore(e.target.value)}
            placeholder="Score"
          />
        </div>
        <div>
          <label>North Players:</label>
          <input
            type="text"
            value={northPlayer1}
            onChange={(e) => setNorthPlayer1(e.target.value)}
            placeholder="Player 1"
          />
          <input
            type="text"
            value={northPlayer2}
            onChange={(e) => setNorthPlayer2(e.target.value)}
            placeholder="Player 2"
          />
          <input
            type="number"
            value={northScore}
            onChange={(e) => setNorthScore(e.target.value)}
            placeholder="Score"
          />
        </div>
        <button type="submit" className="mt-4 bg-blue-500 text-white p-2 rounded">
          Submit Score
        </button>
      </form>
    </Layout>
  );
}
