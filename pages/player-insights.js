
import Layout from "../components/Layout";
import { useState, useEffect } from "react";

export default function PlayerInsights() {
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [insights, setInsights] = useState({});

  useEffect(() => {
    // Fetch list of players for the dropdown
    fetch("/api/players")
      .then((res) => res.json())
      .then((data) => {
        setPlayers(data);
      });
  }, []);

  const handleFetchInsights = async () => {
    let url = `/api/player-insights?player=${selectedPlayer}`;
    if (fromDate) url += `&from=${fromDate}`;
    if (toDate) url += `&to=${toDate}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      setInsights(data);
    } catch (error) {
      console.error("Error fetching player insights:", error);
    }
  };

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Player Insights</h1>
      <div className="mb-4">
        <label htmlFor="player-select">Select Player: </label>
        <select
          id="player-select"
          value={selectedPlayer}
          onChange={(e) => setSelectedPlayer(e.target.value)}
          className="bg-gray-800 text-white border p-2 rounded"
        >
          <option value="">--Select Player--</option>
          {players.map((player) => (
            <option key={player} value={player}>
              {player}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4">
        <label htmlFor="from-date">From Date: </label>
        <input
          type="date"
          id="from-date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="bg-gray-800 text-white border p-2 rounded"
        />
      </div>
      <div className="mb-4">
        <label htmlFor="to-date">To Date: </label>
        <input
          type="date"
          id="to-date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="bg-gray-800 text-white border p-2 rounded"
        />
      </div>
      <button
        onClick={handleFetchInsights}
        className="bg-blue-500 text-white p-2 rounded mt-4"
      >
        Get Insights
      </button>
      <div className="mt-6">
        <h2 className="text-lg font-bold">Player Insights:</h2>
        {insights ? (
          <div>
            <p><strong>Luckiest Month/Year:</strong> {insights.luckiestMonth}</p>
            <p><strong>Blacklist Month/Year:</strong> {insights.blacklistMonth}</p>
            <p><strong>Best Player to Partner With:</strong> {insights.bestPartner}</p>
            <p><strong>Worst Player to Partner With:</strong> {insights.worstPartner}</p>
            <p><strong>Win the Most with:</strong> {insights.winMostWith}</p>
            <p><strong>Lose the Most with:</strong> {insights.loseMostWith}</p>
            <p><strong>Most Frequently Paired With:</strong> {insights.mostFrequentlyPaired}</p>
            <p><strong>Least Frequently Paired With:</strong> {insights.leastFrequentlyPaired}</p>
          </div>
        ) : (
          <p>No insights to display. Please select a player and a date range.</p>
        )}
      </div>
    </Layout>
  );
}
