// Effect to process data when game data or selected year changes
  useEffect(() => {
    console.log("Processing effect triggered. Selected Year:", selectedYear, "Data length:", allGameData.length); // Log: Start processing

    if (allGameData.length === 0) {
      console.log("No game data (allGameData) to process."); // Log: No data
      setProcessedPlayerData({});
      setOverallMonthlyAverageScores([]);
      return; // No data to process
    }

    const monthlyScoresAggregated = {}; // For overall averages { "01": { totalScore: x, count: y }, ... }
    const playerData = {}; // For player-specific insights

    allGameData.forEach((row, index) => {
       // Add basic row validation
       if (!row || typeof row !== 'object' || !row[1]) {
           console.warn(`Skipping invalid row at index ${index}:`, row); // Log: Invalid row
           return;
       }

      const timestamp = String(row[1]); // Ensure string
      // Add timestamp validation / logging
      if (!timestamp || timestamp.length < 7) {
          console.warn(`Invalid timestamp format in row ${index}:`, timestamp); // Log: Invalid timestamp
          return; // Skip row if timestamp is unusable
      }
      const year = timestamp.substring(0, 4);
      const month = timestamp.substring(5, 7); // Month as "01", "02", etc.
      const monthYear = timestamp.substring(0, 7); // For player-specific monthly tracking

      // Log timestamp details for the first few rows
      if(index < 5) {
        console.log(`Row ${index}: Timestamp='${timestamp}', Year='${year}', Month='${month}', MonthYear='${monthYear}'`);
      }


      // Filter data based on selectedYear for calculations
      const isYearMatch = selectedYear === "All" || selectedYear === year;

      const seatPairs = [
        { players: row[2], score: Number(row[3] || 0) },
        { players: row[4], score: Number(row[5] || 0) },
        { players: row[6], score: Number(row[7] || 0) },
        { players: row[8], score: Number(row[9] || 0) },
      ];

      const allNamesInGame = new Set();
      seatPairs.forEach((seat) => {
        if (!seat.players) return;
        const names = String(seat.players).split("+").map((p) => p.trim()).filter(Boolean);
        names.forEach(name => allNamesInGame.add(name));
      });

      seatPairs.forEach((seat) => {
        if (!seat.players) return;
        const playersString = String(seat.players); // Ensure string
        const names = playersString.split("+").map((p) => p.trim()).filter(Boolean);
        if (names.length === 0) return; // Avoid division by zero
        const splitScore = seat.score / names.length;

        // Log score calculation details for first few rows if year matches
        if(index < 5 && isYearMatch) {
            console.log(`Row ${index}, Seat '${playersString}': Score=${seat.score}, Names=${names.length}, SplitScore=${splitScore}`);
        }
        if (isNaN(splitScore)) {
            console.warn(`NaN detected for splitScore in row ${index}, Seat '${playersString}'. Score: ${seat.score}, Names: ${names.length}`); // Log NaN
        }


        // --- Aggregate for OVERALL Monthly Average Chart ---
        if (isYearMatch && !isNaN(splitScore)) { // Also check for NaN score
          if (!monthlyScoresAggregated[month]) {
            monthlyScoresAggregated[month] = { totalScore: 0, count: 0 };
          }
          // Add score for each player instance
          monthlyScoresAggregated[month].totalScore += (splitScore * names.length); // Add score for each player instance
          monthlyScoresAggregated[month].count += names.length; // Count each player instance
        }
        // --- END Overall Aggregation ---


        // --- Aggregate for PLAYER specific insights ---
        names.forEach((name) => {
          if (!playerData[name]) {
            playerData[name] = {
              monthlyScores: {}, // Keyed by monthYear "YYYY-MM"
              partnerScores: {},
              partnerCounts: {},
              gameScores: {},
              gameCounts: {},
            };
          }

          if (isYearMatch && !isNaN(splitScore)) { // Check for NaN score
             // Player's score in specific month/year
             if (!playerData[name].monthlyScores[monthYear]) {
                playerData[name].monthlyScores[monthYear] = 0;
             }
             playerData[name].monthlyScores[monthYear] += splitScore;

             // Partner stats
             names.forEach((partner) => {
               if (partner !== name) {
                 if (!playerData[name].partnerScores[partner]) {
                   playerData[name].partnerScores[partner] = 0;
                   playerData[name].partnerCounts[partner] = 0;
                 }
                 playerData[name].partnerScores[partner] += splitScore;
                 playerData[name].partnerCounts[partner] += 1;
               }
             });

             // Opponent/Game stats
             allNamesInGame.forEach(otherPlayer => {
               if (otherPlayer !== name) {
                 if (!playerData[name].gameScores[otherPlayer]) {
                   playerData[name].gameScores[otherPlayer] = 0;
                   playerData[name].gameCounts[otherPlayer] = 0;
                 }
                 playerData[name].gameScores[otherPlayer] += splitScore;
                 playerData[name].gameCounts[otherPlayer] += 1;
               }
             });
          }
        });
         // --- END Player Aggregation ---
      });
    });

    // Log the aggregated scores BEFORE calculating averages
    console.log("Aggregated Monthly Scores (Raw):", JSON.stringify(monthlyScoresAggregated, null, 2)); // Log: Raw Aggregation

    // Set the processed player data state
    setProcessedPlayerData(playerData);

    // Calculate and set the OVERALL monthly averages for the chart
    const monthlyAverages = Object.keys(monthlyScoresAggregated)
      .sort()
      .map(monthKey => {
        const monthData = monthlyScoresAggregated[monthKey];
        // Add specific check for count validity
        if (!monthData || typeof monthData !== 'object' || typeof monthData.count !== 'number' || monthData.count <= 0) {
            console.warn(`Invalid month data for key ${monthKey}:`, monthData); // Log: Invalid month data
            return null; // Return null for invalid entries
        }
        const averageScore = monthData.totalScore / monthData.count;
        const monthIndex = parseInt(monthKey) - 1;

        // Check if month index is valid
        if (isNaN(monthIndex) || monthIndex < 0 || monthIndex >= months.length) {
            console.warn(`Invalid month key detected: ${monthKey}`); // Log: Invalid month key
            return null; // Return null for invalid entries
        }

        return {
           month: months[monthIndex], // Convert "01" -> "Jan"
           averageScore: parseFloat(averageScore.toFixed(2)), // Ensure number
        };
      })
      .filter(item => item !== null); // Filter out any null entries from invalid data

    // Log the FINAL calculated averages array
    console.log("Overall Monthly Averages Data (Final):", JSON.stringify(monthlyAverages, null, 2)); // Log: Final Data

    setOverallMonthlyAverageScores(monthlyAverages);

  }, [allGameData, selectedYear]); // Re-process if data or year changes