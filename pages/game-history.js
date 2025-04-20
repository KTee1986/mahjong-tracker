
import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function GameHistory() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        setData(data.slice(1)); // Skip header row
      });
  }, []);

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
              <th>ID</th><th>Time</th><th>East</th><th>East Score</th>
              <th>South Player</th><th>South Score</th><th>West Player</th><th>West Score</th><th>North Player</th><th>North Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-t border-gray-700">
                <td>{row[0]}</td>
                <td>{formatDate(row[1])}</td>
                <td>{row[2]} ({row[3]})</td>
                <td>{row[4]} ({row[5]})</td>
                <td>{row[6]} ({row[7]})</td>
                <td>{row[8]} ({row[9]})</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}