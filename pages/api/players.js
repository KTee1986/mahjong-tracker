// pages/api/players.js
import { google } from "googleapis";

// Assuming your sheet has headers: Name (Column A), SettleUpMemberID (Column B or C?)
// Adjust column indices below (PLAYER_NAME_COL_INDEX, MEMBER_ID_COL_INDEX) if needed.
const PLAYER_NAME_COL_INDEX = 0; // Column A
const MEMBER_ID_COL_INDEX = 1;   // <<<< IMPORTANT: Update this index based on your sheet column (e.g., 1 for B, 2 for C)

const SHEET_ID = process.env.SHEET_ID;
const SHEET_NAME = "Players"; // Or whatever you name your sheet

const getSheet = async () => {
  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY, // ✅ direct use, no .replace
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });
    return sheets;
  } catch (error) {
    console.error("Error getting sheet:", error);
    throw error; // Re-throw the error to be caught by the main handler
  }
};

export default async function handler(req, res) {
  try {
    const sheets = await getSheet();

    if (req.method === "GET") {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        // Reading A:Z should be fine to include the new column
        range: `${SHEET_NAME}!A1:Z1000`,
      });

      const data = response.data.values;

      // --- MODIFICATION START (GET) ---
      const players = data
        ? data.slice(1).map((row, index) => ({
            // Assuming ID is row index + 1 (relative to data start after header)
            id: index + 1,
            name: row[PLAYER_NAME_COL_INDEX] || null, // Get name from specified column index
            settleUpMemberId: row[MEMBER_ID_COL_INDEX] || null // Get Member ID from specified column index
          }))
        : [];
      // --- MODIFICATION END (GET) ---

      res.status(200).json({ data: players });

    } else if (req.method === "POST") {
      // --- MODIFICATION START (POST) ---
      // Extract both name and settleUpMemberId from body
      const { name, settleUpMemberId } = req.body;

      // Validate both fields
      if (!name || !settleUpMemberId) {
        return res.status(400).json({ error: "Name and SettleUpMemberID are required." });
      }

      // Prepare the row data according to your column order
      // Example: If Name is Col A, SettleUpMemberID is Col B
      const newRowData = [];
      newRowData[PLAYER_NAME_COL_INDEX] = name;
      newRowData[MEMBER_ID_COL_INDEX] = settleUpMemberId;
      // Fill other columns with null or empty strings if needed to maintain structure,
      // although append usually handles sparse arrays okay if appending to the end.
      // Example: If you had 3 columns total (A, B, C) and B was unused:
      // const newRowData = [name, null, settleUpMemberId];

      const appendResponse = await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        // Append after the last row with data in the specified sheet/range
        range: `${SHEET_NAME}!A1`, // Append will find the next empty row
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS", // Recommended for adding new rows
        requestBody: {
            values: [newRowData] // Pass the array containing both values in correct order
        },
      });

      if (appendResponse.status === 200) {
        // Try to determine the new row index if possible (append response structure can vary)
        // This method is less reliable than using google-spreadsheet's addRow which returns the row object.
        // For simplicity, we'll just return the data we sent.
         const range = appendResponse.data.updates?.updatedRange; // Use optional chaining
         let newPlayerId = Date.now(); // Fallback ID
         if (range) {
             // Try parsing row number from range like 'Players!A10:B10'
             const match = range.match(/![A-Z]+(\d+):/);
             if (match && match[1]) {
                 newPlayerId = parseInt(match[1], 10); // Use the actual row number if possible
             }
         }

        // Include settleUpMemberId in the response object
        res.status(201).json({
            player: {
                id: newPlayerId, // Note: ID determination here might be fragile
                name: name,
                settleUpMemberId: settleUpMemberId
            }
        });
        // --- MODIFICATION END (POST) ---
      } else {
        console.error("Error appending data:", appendResponse);
        res.status(appendResponse.status || 500).json({ error: "Error adding player to sheet." });
      }
    } else {
        // Added handling for other methods
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error("Error in handler:", error);
    // Provide more specific error message if possible
    const message = error.message || "Server error.";
    const status = error.response?.status || 500; // Use status from Google API error if available
    res.status(status).json({ error: message });
  }
}