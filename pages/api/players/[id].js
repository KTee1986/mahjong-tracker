// pages/api/players/[id].js
import { google } from "googleapis";

const SHEET_ID = process.env.SHEET_ID;
const SHEET_NAME = "Players";

const getSheet = async () => {
  try {
      const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY, // ✅ direct use, no .replace
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });
    return sheets;
  } catch (error) {
    console.error("Error getting sheet:", error);
    throw error; // Re-throw the error to be caught by the main handler
  }
};


export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method === "DELETE") {
    try {
      const sheets = await getSheet();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: "Players!A1:Z1000",
      });
      const data = response.data.values;
      if (!data || id > data.length) {
        return res.status(404).json({ error: "Player not found" });
      }

      // Create a new array without the player to delete
      const newData = data.filter((row, index) => index !== parseInt(id));
      newData.shift(); // Remove header row

      // Clear the sheet
      await sheets.spreadsheets.values.clear({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: "Players!A1:Z1000",
      });

      // Append the modified data back to the sheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: "Players!A1:Z1000",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: newData },
      });

      res.status(200).json({ message: "Player deleted" });
    } catch (error) {
      console.error("Error deleting player:", error);
      res.status(500).json({ error: "Server error" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}