import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";

const seats = ["East", "South", "West", "North"];

export default function ScoreEntry() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(null);

  const [players, setPlayers] = useState({ East: "", South: "", West: "", North: "" });
  const [scores, setScores] = useState({ East: "", South: "", West: "", North: "" });
  const [suggestions, setSuggestions] = useState([]);
  const [allNames, setAllNames] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const admin = sessionStorage.getItem("admin");
    if (admin !== "true") router.replace("/login");
    else setIsAdmin(true);
  }, []);

  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        const names = new Set();
        data.slice(1).forEach((row) => {
          for (let i = 2; i <= 8; i += 2) {
            if (row[i]) names.add(row[i]);
          }
        });
        setAllNames([...names]);
      });
  }, []);

  const handleInput = (seat, type, value) => {
    if (type === "player") {
      setPlayers((prev) => ({ ...prev, [seat]: value }));
      setSuggestions(
        value.length > 0
          ? allNames.filter((n) => n.toLowerCase().startsWith(value.toLowerCase()))
          : []
      );
    } else {
      setScores((prev) => ({ ...prev, [seat]: value }));
    }
  };

  const calculateTotal = () =>
    Object.values(scores).reduce((sum, val) => sum + Number(val || 0), 0);

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    const total = calculateTotal();

    if (total !== 0) {
      setError("Scores must sum to 0.");
      return;
    }

    const filled = seats.filter((s) => players[s] && scores[s] !== "");
    if (filled.length < 2) {
      setError("At least two seats must be filled.");
      return;
    }

    const res = await fetch("/api/sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
