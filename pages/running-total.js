import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function RunningTotal() {
  const [players, setPlayers] = useState([]);
  const [selectedYear, setSelectedYear] = useState("All");
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(true); // Add loading state

  useEffect(() => {
    setLoading(true); // Start loading
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        const scores = {};
        const years = new Set();

        // Check if data is an array before iterating
        if (Array.isArray(data)) {
          data.slice(1).forEach((row) => {
            // Extract year from the timestamp (2nd column, index 1)
            const timestamp = row[1];
            // Check if timestamp is a string before calling substring
            if (typeof timestamp === 'string') {
              const year = timestamp.substring(0, 4); // Assuming YYYY-MM-DDTHH:mm:ss.sssZ format
              years.add(year);

              if (selectedYear === "All" || selectedYear === year) {
                const seatPairs = [
                  [row[2], row[3]],
                  [row[4], row[5]],
                  [row[6], row[7]],
                  [row[8], row[9]],
                ];

                seatPairs.forEach(([playersStr, scoreStr]) => {
                  if (!playersStr || !scoreStr) return;
                  const seatScore = Number(scoreStr);
                  const splitPlayers = playersStr.split("+").map((p) => p.trim()).filter(Boolean);
                  const portion = seatScore / splitPlayers.length;

                  splitPlayers.forEach((name) => {
                    if (!scores[name]) scores[name] = 0;
                    scores[name] += portion;
                  });
                });
              }
            } else {
              console.warn("Timestamp is not a string:", timestamp);
              // Handle the case where timestamp is not a string (e.g., skip this row, use a default year)
            }
          });
        } else {
          console.error("Data is not an array:", data);
          // Handle the case where data is not an array (e.g., display an error message)
        }


        const result = Object.entries(scores)
          .map(([name, total]) => ({ name, total: total.toFixed(2) }))
          .sort((a, b) => b.total - a.total);

        setPlayers(result);
        // Sort years in descending order
        setAvailableYears(["All", ...Array.from(years).sort((a, b) => parseInt(b) - parseInt(a))]);
        setLoading(false); // End loading
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        setLoading(false); // Also end loading on error!
        // Optionally, set an error state and display an error message to the user
      });
  }, [selectedYear]);

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Running Total</h1>

      {/* Year Filter */}
      <div className="mb-4">
        <label htmlFor="year-select" className="mr-2">Filter by Year:</label>
        <select
          id="year-select"
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="border rounded py-1 px-2 text-black"
        >
          {availableYears.map((year, index) => (
            <option key={index} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <div className="max-w-md mx-auto">
        {loading ? (
          <p>Loading...</p>
        ) : players.length > 0 ? (
          players.map((p, index) => (
            <div key={index} className="flex justify-between p-2 border-b border-gray-700">
              <span>{p.name}</span>
              <span className="font-mono">{p.total}</span>
            </div>
          ))
        ) : (
          <p className="text-gray-400 mt-4">No data available.</p>
        )}
      </div>
    </Layout>
  );
}