import Layout from "../components/Layout";
import { useState, useEffect } from "react";

export default function RunningTotal() {
  const [data, setData] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filteredData, setFilteredData] = useState([]);
  const [totalScores, setTotalScores] = useState({});

  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        setData(data.slice(1)); // Ignore header row
      });
  }, []);

  useEffect(() => {
    if (data.length) {
      let filtered = data;
      if (fromDate) {
        filtered = filtered.filter((row) => new Date(row[1]) >= new Date(fromDate));
      }
      if (toDate) {
        filtered = filtered.filter((row) => new Date(row[1]) <= new Date(toDate));
      }
      setFilteredData(filtered);
    }
  }, [fromDate, toDate, data]);

  useEffect(() => {
    const totals = {};
    filteredData.forEach((row) => {
      // Handle each row's score and pairings
      const players = [
        { name: row[2], score: parseInt(row[4]) },
        { name: row[3], score: parseInt(row[4]) },
        { name: row[5], score: parseInt(row[7]) },
        { name: row[6], score: parseInt(row[7]) },
        { name: row[8], score: parseInt(row[10]) },
        { name: row[9], score: parseInt(row[10]) },
        { name: row[11], score: parseInt(row[13]) },
        { name: row[12], score: parseInt(row[13]) },
      ];

      // Split the score for pairs
      players.forEach((player, idx) => {
        if (idx % 2 === 0) {  // If East/South are paired with West/North
          const partnerIdx = idx + 1; // Partnering logic (East pairs with West, South with North)
          if (player && players[partnerIdx]) {
            player.score = player.score / 2; // Split the score between paired players
            players[partnerIdx].score = players[partnerIdx].score / 2;
          }
        }
        
        if (totals[player.name]) {
          totals[player.name] += player.score;
        } else {
          totals[player.name] = player.score;
        }
      });
    });
    setTotalScores(totals);
  }, [filteredData]);

  const handleFilter = () => {
    setFilteredData(data);  // Re-fetch data if needed
  };

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Running Total</h1>
      <div className="mb-4 flex space-x-4">
        <div>
          <label htmlFor="from-date" className="block">From Date:</label>
          <input
            type="date"
            id="from-date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-gray-800 text-white border p-2 rounded"
          />
        </div>
        <div>
          <label htmlFor="to-date" className="block">To Date:</label>
          <input
            type="date"
            id="to-date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-gray-800 text-white border p-2 rounded"
          />
        </div>
        <button
          onClick={handleFilter}
          className="bg-blue-500 text-white p-2 rounded"
        >
          Filter
        </button>
      </div>
      <div className="overflow-x-auto text-sm">
        <table className="w-full border-collapse border border-gray-700">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th>Player</th><th>Total Score</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(totalScores).map(([player, score], i) => (
              <tr key={i} className="border-t border-gray-700">
                <td>{player}</td>
                <td>{score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
