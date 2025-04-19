
import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function GameHistory() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => setData(data.slice(1)));
  }, []);

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Game History</h1>
      {data.length === 0 ? (
        <p className="text-gray-400">No records found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-700 text-sm">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="border border-gray-700 px-2 py-1">Game ID</th>
                <th className="border border-gray-700 px-2 py-1">Time</th>
                <th className="border border-gray-700 px-2 py-1">East</th>
                <th className="border border-gray-700 px-2 py-1">South</th>
                <th className="border border-gray-700 px-2 py-1">West</th>
                <th className="border border-gray-700 px-2 py-1">North</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-t border-gray-700">
                  <td className="px-2 py-1">{row[0]}</td>
                  <td className="px-2 py-1">{row[1]}</td>
                  <td className="px-2 py-1">{row[2]} ({row[3]})</td>
                  <td className="px-2 py-1">{row[4]} ({row[5]})</td>
                  <td className="px-2 py-1">{row[6]} ({row[7]})</td>
                  <td className="px-2 py-1">{row[8]} ({row[9]})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
