import Layout from "../components/Layout";
import { useEffect, useState } from "react";

export default function RunningTotal() {
  const [data, setData] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filteredData, setFilteredData] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Optional: loading state
  const [error, setError] = useState(null); // Optional: error state for display

  useEffect(() => {
    setIsLoading(true); // Start loading
    setError(null); // Reset error on new fetch

    fetch("/api/sheet")
      .then((res) => {
        if (!res.ok) {
          // If response is not OK, throw an error to be caught below
          // Try to get text for more details, but don't fail if that doesn't work
          return res.text().then(text => {
             console.error("API Error Response Text:", text);
             throw new Error(`API request failed: ${res.status} ${res.statusText}`);
          }).catch(() => {
             throw new Error(`API request failed: ${res.status} ${res.statusText}`);
          });
        }
        // Only parse JSON if response is OK
        return res.json();
      })
      .then((responseData) => {
        // Check if responseData has a 'data' property and it's an array
        if (!responseData || !Array.isArray(responseData.data)) {
           console.error("API response missing 'data' array:", responseData);
           throw new Error("Invalid data structure received from API.");
        }

        console.log("Data received from API:", responseData.data); // Log received data
        // Ensure slice doesn't fail if data has 0 rows
        const sheetData = responseData.data.length > 0 ? responseData.data.slice(1) : [];
        setData(sheetData); // Ignore header row
        setFilteredData(sheetData); // Initialize with all data
      })
      .catch((error) => {
        // Catch network errors or errors thrown above
        console.error("Failed to fetch or process sheet data:", error);
        setError(error.message || "Failed to load data."); // Set error state for display
        setData([]); // Ensure data is empty on error
        setFilteredData([]);
      })
      .finally(() => {
         setIsLoading(false); // Stop loading regardless of success/failure
      });

  }, []); // Empty dependency array means this runs once on mount

  // Safer date formatting
  const formatDate = (dateStr) => {
    if (!dateStr) return ""; // Handle empty/null date strings
    const date = new Date(dateStr);
    // Check if the date is valid before trying to format
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date string encountered: ${dateStr}`);
      return "Invalid Date"; // Or return empty string: ""
    }
    // Format to YYYY-MM-DD
    return date.toISOString().split("T")[0];
  };

  const handleApplyFilter = () => {
    setError(null); // Clear previous errors
    try {
      const filtered = data.filter((row) => {
        // Basic check for row structure (optional but recommended)
        if (!Array.isArray(row) || row.length < 2) {
            console.warn("Skipping invalid row structure:", row);
            return false;
        }

        const gameDateStr = row[1];
        if (!gameDateStr) return true; // Include rows with no date if no filter applied

        const gameDate = new Date(gameDateStr);
        // Check if gameDate is valid
         if (isNaN(gameDate.getTime())) {
             console.warn(`Invalid game date in row, skipping filter check: ${gameDateStr}`, row);
             return true; // Decide whether to include/exclude rows with invalid dates
         }

        // Parse filter dates safely
        const fromDateObj = fromDate ? new Date(fromDate) : null;
        const toDateObj = toDate ? new Date(toDate) : null;

        // Ensure filter dates are valid if they exist
        if (fromDateObj && isNaN(fromDateObj.getTime())) {
            console.error("Invalid 'From Date' selected");
            setError("Invalid 'From Date' selected.");
            return true; // Don't filter based on invalid input
        }
         if (toDateObj && isNaN(toDateObj.getTime())) {
            console.error("Invalid 'To Date' selected");
            setError("Invalid 'To Date' selected.");
            return true; // Don't filter based on invalid input
        }

        // Adjust To Date to include the entire day
        if (toDateObj) {
            toDateObj.setHours(23, 59, 59, 999);
        }

        // Apply filter logic
        if (fromDateObj && gameDate < fromDateObj) {
          return false; // Exclude rows before the 'from' date
        }
        if (toDateObj && gameDate > toDateObj) {
          return false; // Exclude rows after the 'to' date (inclusive)
        }

        return true; // Include rows that fall within the date range or if filters are invalid/not set
      });
      setFilteredData(filtered);
    } catch (filterError) {
        console.error("Error during filtering:", filterError);
        setError("An error occurred while applying filters.");
    }
  };

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-4">Running Total</h1>

      {/* Filter Section */}
      <div className="mb-4 p-4 border border-gray-600 rounded">
        <h2 className="text-lg font-semibold mb-2">Filter by Date</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label htmlFor="fromDate" className="block text-sm font-medium text-gray-300 mb-1">From Date:</label>
            <input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="p-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
          </div>
          <div>
            <label htmlFor="toDate" className="block text-sm font-medium text-gray-300 mb-1">To Date:</label>
            <input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="p-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
          </div>
          <button
            onClick={handleApplyFilter}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition duration-150 ease-in-out"
          >
            Apply Filter
          </button>
        </div>
      </div>

      {/* Loading and Error Display */}
      {isLoading && <p className="text-center my-4">Loading data...</p>}
      {error && <p className="text-center my-4 text-red-500">Error: {error}</p>}

      {/* Data Table */}
      {!isLoading && !error && (
        <div className="overflow-x-auto text-sm">
          <table className="min-w-full border-collapse border border-gray-700">
            <thead className="bg-gray-800 text-white sticky top-0">
              <tr>
                {/* Adjust indices based on your actual sheet columns */}
                <th className="p-2 border border-gray-600">ID</th>
                <th className="p-2 border border-gray-600">Date</th>
                <th className="p-2 border border-gray-600">East (Player & Score)</th>
                <th className="p-2 border border-gray-600">South (Player & Score)</th>
                <th className="p-2 border border-gray-600">West (Player & Score)</th>
                <th className="p-2 border border-gray-600">North (Player & Score)</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? (
                filteredData.map((row, i) => (
                  // Basic check for row validity before rendering
                  Array.isArray(row) && row.length >= 14 ? (
                    <tr key={row[0] || i} className="border-t border-gray-700 hover:bg-gray-700">
                      <td className="p-2 border border-gray-600">{row[0]}</td>
                      <td className="p-2 border border-gray-600">{formatDate(row[1])}</td>
                      {/* Ensure data exists before rendering using nullish coalescing */}
                      <td className="p-2 border border-gray-600">{row[2] ?? ''} & {row[3] ?? ''} ({row[4] ?? ''})</td>
                      <td className="p-2 border border-gray-600">{row[5] ?? ''} & {row[6] ?? ''} ({row[7] ?? ''})</td>
                      <td className="p-2 border border-gray-600">{row[8] ?? ''} & {row[9] ?? ''} ({row[10] ?? ''})</td>
                      <td className="p-2 border border-gray-600">{row[11] ?? ''} & {row[12] ?? ''} ({row[13] ?? ''})</td>
                    </tr>
                   ) : (
                    // Render placeholder or log error for invalid rows if needed
                     <tr key={`invalid-${i}`} className="border-t border-gray-700">
                       <td colSpan="6" className="p-2 text-center text-red-400">Invalid row data encountered</td>
                    </tr>
                   )
                ))
              ) : (
                 <tr>
                   <td colSpan="6" className="text-center p-4">No data available for the selected period.</td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
