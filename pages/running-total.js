
import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function RunningTotal() {
  const [data, setData] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filteredData, setFilteredData] = useState([]);

  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        setData(data.slice(1)); // Ignore header row
        setFilteredData(data.slice(1)); // Initialize with all data
      });
  }, []);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toISOString().split("T")[0]; // Format to YYYY-MM-DD
  };

  const handleApplyFilter = () => {
    const filtered = data.filter((row) => {
      const gameDate = new Date(row[1]);
      if (
        (fromDate && gameDate < new Date(fromDate)) ||
        (toDate && gameDate > new Date(toDate))
      ) {
        return false; // Exclude rows outside the selected date range
      }
      return true; // Include rows that fall within the date range
    });
    setFilteredData(filtered);
  };

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Running Total</h1>
      <div className="mb-4">
        <label>From Date:</label>
        <input 
          type="date" 
          value={fromDate} 
          onChange={(e) => setFromDate(e.target.value)} 
        />
        <label>To Date:</label>
        <input 
          type="date" 
          value={toDate} 
          onChange={(e) => setToDate(e.target.value)} 
        />
        <button 
          onClick={handleApplyFilter} 
          className="bg-blue-500 text-white p-2 mt-2"
        >
          Apply Date Filter
        </button>
      </div>
      <div className="overflow-x-auto text-sm">
        <table className="w-full border-collapse border border-gray-700">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th>ID</th><th>Time</th><th>East</th><th>South</th><th>West</th><th>North</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, i) => (
              <tr key={i} className="border-t border-gray-700">
                <td>{row[0]}</td>
                <td>{formatDate(row[1])}</td>
                <td>{row[2]} & {row[3]} ({row[4]})</td>
                <td>{row[5]} & {row[6]} ({row[7]})</td>
                <td>{row[8]} & {row[9]} ({row[10]})</td>
                <td>{row[11]} & {row[12]} ({row[13]})</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
