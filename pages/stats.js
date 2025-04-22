import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function Stats() {
  const [rows, setRows] = useState([]);
  const [selectedYear, setSelectedYear] = useState("All");
  const [availableYears, setAvailableYears] = useState([]);

  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        const stats = {};
        const years = new Set();

        data.slice(1).forEach(row => {
          // Extract year from the timestamp (2nd column, index 1)
          const timestamp = row[1];
          const year = timestamp.substring(0, 4); // Assuming YYYY-MM-DDTHH:mm:ss.sssZ format
          years.add(year);

          if (selectedYear === "All" || selectedYear === year) {
            const seats = ["East", "South", "West", "North"];
            seats.forEach((seat, i) => {
              const playerCell = row[2 + i * 2];
              const score = Number(row[3 + i * 2] || 0);
              if (!playerCell) return;
              const playerNames = playerCell.split("+").map(name => name.trim()).filter(Boolean);
              const splitScore = score / playerNames.length;

              playerNames.forEach(player => {
                if (!stats[player]) {
                  stats[player] = {
                    player,
                    totalGames: 0,
                    totalScore: 0,
                    positiveGames: 0,
                    highest: -Infinity,
                    lowest: Infinity,
                  };
                }
                const s = stats[player];
                s.totalGames += 1;
                s.totalScore += splitScore;
                if (splitScore > 0) s.positiveGames += 1;
                s.highest = Math.max(s.highest, splitScore);
                s.lowest = Math.min(s.lowest, splitScore);
              });
            });
          }
        });

        const table = Object.values(stats)
          .map(s => ({
            player: s.player,
            games: s.totalGames,
            winRate: ((s.positiveGames / s.totalGames) * 100).toFixed(1) + '%',
            average: (s.totalScore / s.totalGames).toFixed(2),
            highest: s.highest.toFixed(2),
            lowest: s.lowest.toFixed(2),
          }))
          .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate)); // Sort by winRate

        setRows(table);
        setAvailableYears(["All", ...Array.from(years).sort((a, b) => parseInt(b) - parseInt(a))]);
      });
  }, [selectedYear]);

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Stats</h1>

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

      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border-collapse border border-gray-700">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="border border-gray-700 p-2">Player</th>
              <th className="border border-gray-700 p-2">Games</th>
              <th className="border border-gray-700 p-2">Win Rate</th>
              <th className="border border-gray-700 p-2">Avg Score</th>
              <th className="border border-gray-700 p-2">Highest</th>
              <th className="border border-gray-700 p-2">Lowest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.player}>
                <td className="border border-gray-700 p-2">{row.player}</td>
                <td className="border border-gray-700 p-2">{row.games}</td>
                <td className="border border-gray-700 p-2">{row.winRate}</td>
                <td className="border border-gray-700 p-2">{row.average}</td>
                <td className="border border-gray-700 p-2">{row.highest}</td>
                <td className="border border-gray-700 p-2">{row.lowest}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}