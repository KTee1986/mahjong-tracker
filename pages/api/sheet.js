
import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY, // ✅ direct use, no .replace
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    if (req.method === "GET") {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: "Sheet1!A1:Z1000",
      });
      res.status(200).json({ data: response.data.values });
    } else if (req.method === "POST") {
      const { players, scores } = req.body;

      const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const timestamp = new Date().toISOString();

      const row = [
        gameId,
        timestamp,
        players.East,
        scores.East,
        players.South,
        scores.South,
        players.West,
        scores.West,
        players.North,
        scores.North,
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: "Sheet1!A1",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [row],
        },
      });

      res.status(200).json({ success: true, gameId });
    }else if (method === "DELETE") {
    const { id } = req.query; // Assuming the ID is passed as part of the URL
    
    try {
      const sheetId = process.env.GOOGLE_SHEET_ID; // Replace with your actual sheet ID
      const range = `Sheet1!A:A`; // Column A stores your IDs, adjust if necessary
      const response = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: sheetId,
        range: range,
      });
      
      const rows = response.data.values;
      const rowIndex = rows.findIndex(row => row[0] === id); // Find row with matching ID
      
      if (rowIndex !== -1) {
        // Delete the row (in this case rowIndex + 1, as Sheet rows are 1-based)
        await sheets.spreadsheets.values.clear({
          auth,
          spreadsheetId: sheetId,
          range: `Sheet1!A${rowIndex + 1}:Z${rowIndex + 1}`,
        });

        res.status(200).json({ message: "Record deleted successfully" });
      } else {
        res.status(404).json({ error: "Record not found" });
      }
    } catch (error) {
      console.error("Error deleting record from Google Sheets:", error);
      res.status(500).json({ error: "Failed to delete record" });
    }
  }	else {
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error("API ERROR:", error);
    res.status(500).json({ error: error.message });
  }
}
