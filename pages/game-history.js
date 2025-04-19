
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
        setData(data.slice(1));
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
      east: row[2], eastScore: row[3],
      south: row[4], southScore: row[5],
      west: row[6], westScore: row[7],
      north: row[8], northScore: row[9],
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
      form.east, form.eastScore,
      form.south, form.southScore,
      form.west, form.westScore,
      form.north, form.northScore
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

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Game History</h1>
      <div className="overflow-x-auto text-sm">
        <table className="w-full border-collapse border border-gray-700">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th>ID</th><th>Time</th><th>East</th><th>South</th><th>West</th><th>North</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-t border-gray-700">
                {editIndex === i ? (
                  <>
                    <td>{row[0]}</td>
                    <td>{row[1]}</td>
                    <td><input value={form.east} onChange={(e) => handleChange("east", e.target.value)} /></td>
                    <td><input value={form.south} onChange={(e) => handleChange("south", e.target.value)} /></td>
                    <td><input value={form.west} onChange={(e) => handleChange("west", e.target.value)} /></td>
                    <td><input value={form.north} onChange={(e) => handleChange("north", e.target.value)} /></td>
                    <td>
                      <button onClick={saveEdit}>✅</button>
                      <button onClick={cancelEdit}>❌</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{row[0]}</td>
                    <td>{row[1]}</td>
                    <td>{row[2]} ({row[3]})</td>
                    <td>{row[4]} ({row[5]})</td>
                    <td>{row[6]} ({row[7]})</td>
                    <td>{row[8]} ({row[9]})</td>
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
