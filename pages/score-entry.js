const handleSubmit = async () => {
    setError("");
    setMessage("");
    setCopySuccess(false); // Reset copy success state

    if (parseFloat(sumOfScores.toFixed(1)) !== 0) {
      setError("Sum of scores must be 0.");
      return;
    }

    const filled = seats.filter(
      (s) => players[s].length > 0 && parseFloat(scores[s]) !== -200
    );
    if (filled.length !== seats.length) {
      setError("All seats must be filled.");
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
              `${flatPlayers[seat] || "None"} : ${scores[seat]}`
          )
          .join("\n");

        const copySuccess = () => {
          setMessage(message + " Result copied to clipboard!");
          setCopySuccess(true);
        };

        const copyFailure = (err) => {
          console.error("Could not copy text: ", err);
          setMessage(message + " Could not copy result to clipboard. Please copy manually.");
          setCopySuccess(false);
        };

        const attemptCopy = async () => {
          if (navigator.clipboard) {
            try {
              await navigator.clipboard.writeText(resultText);
              copySuccess();
              return; // Exit if successful
            } catch (err) {
              console.error("Clipboard write failed:", err);
              // Fallback will be triggered below
            }
          }

          // Fallback for browsers that don't support navigator.clipboard or fail
          try {
            const textArea = document.createElement("textarea");
            textArea.value = resultText;
            textArea.style.position = "fixed"; // Avoid scrolling to bottom
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.width = "2em";
            textArea.style.height = "2em";
            textArea.style.padding = "0";
            textArea.style.border = "none";
            textArea.style.outline = "none";
            textArea.style.boxShadow = "none";
            textArea.style.background = "transparent";
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            copySuccess();
          } catch (err) {
            console.error("Fallback copy failed:", err);
            copyFailure(err);
          }
        };

        attemptCopy(); // Call the unified copy function

      } else {
        setError(data.error || "Error submitting game.");
      }
    } catch (err) {
      setError("Failed to submit. Check console for details.");
      console.error(err);
    }
  };