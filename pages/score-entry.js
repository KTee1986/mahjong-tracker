const handleSubmit = async () => {
    setError("");
    setMessage("");

    if (parseFloat(sumOfScores.toFixed(1)) !== 0) {
      setError("Sum of scores must be 0.");
      return;
    }

    const filled = seats.filter(
      (s) => players[s].length > 0 && parseFloat(scores[s]) !== -200
    );
    if (filled.length < 2) {
      setError("At least two seats must be filled.");
      return;
    }

    const flatPlayers = {};
    const adjustedScores = {};
    for (const seat of seats) {
      flatPlayers[seat] = players[seat].join(" + ");
      adjustedScores[seat] = parseFloat(scores[seat].toFixed(1));
    }

    try {
      const res = await fetch("/api/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: flatPlayers, scores: adjustedScores }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`Game recorded! ID: ${data.gameId}`);
        setPlayers({
          East: [],
          South: [],
          West: [],
          North: [],
        });
        setColorCounts({
          East: { Red: 0, Blue: 0, Green: 0, White: 0 },
          South: { Red: 0, Blue: 0, Green: 0, White: 0 },
          West: { Red: 0, Blue: 0, Green: 0, White: 0 },
          North: { Red: 0, Blue: 0, Green: 0, White: 0 },
        });
        setScores({
          East: -200,
          South: -200,
          West: -200,
          North: -200,
        });
        setSumOfScores(-800);

        // Copy result to clipboard
        const resultText = seats
          .map(
            (seat) =>
              `${seat} Player(s): ${flatPlayers[seat] || "None"} - Score: ${adjustedScores[seat]}`
          )
          .join("\n");
        navigator.clipboard
          .writeText(resultText)
          .then(() => {
            setMessage(message + " Result copied to clipboard!");
          })
          .catch((err) => {
            console.error("Could not copy text: ", err);
            setMessage(
              message +
                " Could not copy result to clipboard. Please copy manually."
            );
          });
      } else {
        setError(data.error || "Error submitting game.");
      }
    } catch (err) {
      setError("Failed to submit. Check console for details.");
      console.error(err);
    }
  };