
import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function GameHistory() {
  const [data, setData] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        setData(data.slice(1)); // Skip header row
      });
  }, []);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const startEdit = (i) => {
    const row = data[i];
    setForm({
      id: row[0],
      timestamp: row[1],
      eastPlayer1: row[2], eastPlayer2: row[3], eastScore: row[4],
      southPlayer1: row[5], southPlayer2: row[6], southScore: row[7],
      westPlayer1: row[8], westPlayer2: row[9], westScore: row[10],
      northPlayer1: row[11], northPlayer2: row[12], northScore: row[13],
    });
    setEditIndex(i);
  };

  const cancelEdit = () => {
    setEditIndex(null);
    setForm({});
  };

  const saveEdit = () => {
    const updated = [...data];
    updated[editIndex] = [
      form.id, form.timestamp,
      form.eastPlayer1, form.eastPlayer2, form.eastScore,
      form.southPlayer1, form.southPlayer2, form.southScore,
      form.westPlayer1, form.westPlayer2, form.westScore,
      form.northPlayer1, form.northPlayer2, form.northScore
    ];
    setData(updated);
    cancelEdit();
  };

  const deleteRow = (i) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      const updated = data.filter((_, idx) => idx !== i);
      setData(updated);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toISOString().split("T")[0]; // Format to YYYY-MM-DD
  };

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Game History</h1>
      <div className="overflow-x-auto text-sm">
        <table className="w-full border-collapse border border-gray-700">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th>ID</th><th>Time</th><th>East Player 1</th><th>East Player 2</th><th>East Score</th>
              <th>South Player 1</th><th>South Player 2</th><th>South Score</th><th>West Player 1</th>
              <th>West Player 2</th><th>West Score</th><th>North Player 1</th><th>North Player 2</th><th>North Score</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-t border-gray-700">
                {editIndex === i ? (
                  <>
                    <td>{row[0]}</td>
                    <td>{formatDate(row[1])}</td>
                    <td>
                      <input 
                        value={form.eastPlayer1} 
                        onChange={(e) => handleChange("eastPlayer1", e.target.value)} 
                        placeholder="Player 1" 
                      />
                      <input 
                        value={form.eastPlayer2} 
                        onChange={(e) => handleChange("eastPlayer2", e.target.value)} 
                        placeholder="Player 2" 
                      />
                      <input 
                        value={form.eastScore} 
                        onChange={(e) => handleChange("eastScore", e.target.value)} 
                        placeholder="Score" 
                      />
                    </td>
                    <td>
                      <input 
                        value={form.southPlayer1} 
                        onChange={(e) => handleChange("southPlayer1", e.target.value)} 
                        placeholder="Player 1" 
                      />
                      <input 
                        value={form.southPlayer2} 
                        onChange={(e) => handleChange("southPlayer2", e.target.value)} 
                        placeholder="Player 2" 
                      />
                      <input 
                        value={form.southScore} 
                        onChange={(e) => handleChange("southScore", e.target.value)} 
                        placeholder="Score" 
                      />
                    </td>
                    <td>
                      <input 
                        value={form.westPlayer1} 
                        onChange={(e) => handleChange("westPlayer1", e.target.value)} 
                        placeholder="Player 1" 
                      />
                      <input 
                        value={form.westPlayer2} 
                        onChange={(e) => handleChange("westPlayer2", e.target.value)} 
                        placeholder="Player 2" 
                      />
                      <input 
                        value={form.westScore} 
                        onChange={(e) => handleChange("westScore", e.target.value)} 
                        placeholder="Score" 
                      />
                    </td>
                    <td>
                      <input 
                        value={form.northPlayer1} 
                        onChange={(e) => handleChange("northPlayer1", e.target.value)} 
                        placeholder="Player 1" 
                      />
                      <input 
                        value={form.northPlayer2} 
                        onChange={(e) => handleChange("northPlayer2", e.target.value)} 
                        placeholder="Player 2" 
                      />
                      <input 
                        value={form.northScore} 
                        onChange={(e) => handleChange("northScore", e.target.value)} 
                        placeholder="Score" 
                      />
                    </td>
                    <td>
                      <button onClick={saveEdit}>✅</button>
                      <button onClick={cancelEdit}>❌</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{row[0]}</td>
                    <td>{formatDate(row[1])}</td>
                    <td>{row[2]} & {row[3]} ({row[4]})</td>
                    <td>{row[5]} & {row[6]} ({row[7]})</td>
                    <td>{row[8]} & {row[9]} ({row[10]})</td>
                    <td>{row[11]} & {row[12]} ({row[13]})</td>
                    <td>
                      <button onClick={() => startEdit(i)}>✏️</button>
                      <button onClick={() => deleteRow(i)}>🗑️</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
