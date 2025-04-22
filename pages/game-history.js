import Layout from "../components/Layout";
import { useState, useEffect } from "react";

export default function GameHistory() {
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;
  const [totalPages, setTotalPages] = useState(1);
  const [invalidDateRows, setInvalidDateRows] = useState([]); // To store rows with invalid dates

  useEffect(() => {
    fetch("/api/sheet")
      .then((res) => res.json())
      .then(({ data }) => {
        const slicedData = data.slice(1); // Ignore header row
        const validRows = [];
        const invalidRows = [];

        slicedData.forEach((row) => {
          try {
            new Date(row[1]); // Try creating a Date object
            validRows.push(row);
          } catch (error) {
            console.error("Invalid date in row:", row);
            invalidRows.push(row);
          }
        });

        setData(validRows);
        setTotalPages(Math.ceil(validRows.length / rowsPerPage));
        setInvalidDateRows(invalidRows); // Store the invalid rows
      });
  }, []);

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toISOString().split("T")[0]; // Format to YYYY-MM-DD
    } catch (error) {
      console.error("Error formatting date:", dateStr);
      return "Invalid Date"; // Or some other placeholder
    }
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const currentData = data.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Game History</h1>

      {invalidDateRows.length > 0 && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
          <p className="font-bold">Warning: Some rows have invalid dates:</p>
          <ul>
            {invalidDateRows.map((row, index) => (
              <li key={index}>
                Row ID: {row[0]}, Date: {row[1]}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto text-sm">
        <table className="w-full border-collapse border border-gray-700">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th>ID</th><th>Time</th><th>East</th><th>South</th><th>West</th><th>North</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map((row, i) => (
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
      <div className="flex justify-between mt-4">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="bg-gray-500 text-white p-2 rounded"
        >
          Previous
        </button>
        <div className="flex items-center">
          Page {currentPage} of {totalPages}
        </div>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className="bg-gray-500 text-white p-2 rounded"
        >
          Next
        </button>
      </div>
    </Layout>
  );
}