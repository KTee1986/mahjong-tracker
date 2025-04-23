import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function PlayerInsights() {
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedYear, setSelectedYear] = useState("All");
  const [availableYears, setAvailableYears] = useState([]);
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        const allPlayers = new Set();
        const years = new Set();

        const playerData = {}; // Store data for each player

        data.slice(1).forEach((row) => {
          const timestamp = row[1];
          const year = timestamp.substring(0, 4);
          const monthYear = timestamp.substring(0, 7); // YYYY-MM
          years.add(year);

          const seatPairs = [
            { players: row[2], score: Number(row[3] || 0) },
            { players: row[4], score: Number(row[5] || 0) },
            { players: row[6], score: Number(row[7] || 0) },
            { players: row[8], score: Number(row[9] || 0) },
          ];

          seatPairs.forEach((seat) => {
            if (!seat.players) return;
            const names = seat.players.split("+").map((p) => p.trim()).filter(Boolean);
            const splitScore = seat.score / names.length;

            names.forEach((name) => {
              allPlayers.add(name);
              if (!playerData[name]) {
                playerData[name] = {
                  monthlyScores: {},
                  partnerScores: {},
                  partnerCounts: {},
                };
              }

              // Monthly Scores
              if (!playerData[name].monthlyScores[monthYear]) {
                playerData[name].monthlyScores[monthYear] = 0;
              }
              if (selectedYear === "All" || selectedYear === year) {
                playerData[name].monthlyScores[monthYear] += splitScore;
              }

              // Partner Data
              names.forEach((partner) => {
                if (partner !== name) {
                  if (!playerData[name].partnerScores[partner]) {
                    playerData[name].partnerScores[partner] = 0;
                    playerData[name].partnerCounts[partner] = 0;
                  }
                  if (selectedYear === "All" || selectedYear === year) {
                    playerData[name].partnerScores[partner] += splitScore;
                    playerData[name].partnerCounts[partner] += 1;
                  }
                }
              });
            });
          });
        });

        setPlayers(Array.from(allPlayers).sort());
        setAvailableYears(["All", ...Array.from(years).sort((a, b) => parseInt(b) - parseInt(a))]);
        if (selectedPlayer) {
          calculateInsights(playerData, selectedPlayer);
        }
      });
  }, [selectedYear, selectedPlayer]);

  const calculateInsights = (data, player) => {
    if (!data[player]) {
      setInsights(null);
      return;
    }

    const { monthlyScores, partnerScores, partnerCounts } = data[player];

    // Luckiest/Blackest Month
    let luckiestMonth = "";
    let blackestMonth = "";
    let maxScore = -Infinity;
    let minScore = Infinity;

    for (const month in monthlyScores) {
      const score = monthlyScores[month];
      if (score > maxScore) {
        maxScore = score;
        luckiestMonth = month;
      }
      if (score < minScore) {
        minScore = score;
        blackestMonth = month;
      }
    }

    // Best/Worst Partner
    let bestPartner = "";
    let worstPartner = "";
    let bestAvg = -Infinity;
    let worstAvg = Infinity;

    for (const partner in partnerScores) {
      const avg = partnerScores[partner] / partnerCounts[partner];
      if (avg > bestAvg) {
        bestAvg = avg;
        bestPartner = partner;
      }
      if (avg < worstAvg) {
        worstAvg = avg;
        worstPartner = partner;
      }
    }

    // Most/Least Frequent Partner
    let mostFrequentPartner = "";
    let leastFrequentPartner = "";
    let maxCount = 0;
    let minCount = Infinity;

    for (const partner in partnerCounts) {
      const count = partnerCounts[partner];
      if (count > maxCount) {
        maxCount = count;
        mostFrequentPartner = partner;
      }
      if (count < minCount) {
        minCount = count;
        leastFrequentPartner = partner;
      }
    }

    setInsights({
      luckiestMonth,
      blackestMonth,
      bestPartner,
      worstPartner,
      mostFrequentPartner,
      leastFrequentPartner,
    });
  };

  const handlePlayerChange = (e) => {
    setSelectedPlayer(e.target.value);
  };

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Player Insights</h1>

      <div className="mb-4">
        <label htmlFor="player-select" className="mr-2">Select Player:</label>
        <select
          id="player-select"
          value={selectedPlayer}
          onChange={handlePlayerChange}
          className="border rounded py-1 px-2 text-black mr-4"
        >
          <option value="">-- Select a Player --</option>
          {players.map((player, index) => (
            <option key={index} value={player}>{player}</option>
          ))}
        </select>

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

      {selectedPlayer && insights ? (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Insights for {selectedPlayer}</h2>
          <p>
            <b>Luckiest Month/Year:</b> {insights.luckiestMonth || "N/A"}
          </p>
          <p>
            <b>Blackest Month/Year:</b> {insights.blackestMonth || "N/A"}
          </p>
          <p>
            <b>Best Player to Partner With:</b> {insights.bestPartner || "N/A"}
          </p>
          <p>
            <b>Worst Player to Partner With:</b> {insights.worstPartner || "N/A"}
          </p>
          <p>
            <b>Most Frequently Paired With:</b> {insights.mostFrequentPartner || "N/A"}
          </p>
          <p>
            <b>Least Frequently Paired With:</b> {insights.leastFrequentPartner || "N/A"}
          </p>
        </div>
      ) : selectedPlayer ? (
        <p>Loading insights...</p>
      ) : (
        <p>Please select a player to view insights.</p>
      )}
    </Layout>
  );
}