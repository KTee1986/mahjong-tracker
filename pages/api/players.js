// pages/api/players.js
import { google } from "googleapis";

const SHEET_ID = process.env.SHEET_ID;
const SHEET_NAME = "Players"; // Or whatever you name your sheet

const getSheet = async () => {
  const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY, // ✅ direct use, no .replace
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });
  return sheets;
};

export default async function handler(req, res) {
  try {
    const sheets = await getSheet();

    if (req.method === "GET") {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: "Players!A1:Z1000",
      });

      const data = response.data.values;
      const players = data ? data.slice(1).map((row, index) => ({ id: index + 1, name: row[0] })) : []; // Assuming player names are in the first column
      res.status(200).json({ data: players });
    } else if (req.method === "POST") {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Name is required." });
      }

      const appendResponse = await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: "Players!A1:Z1000",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[name]] },
      });

      if (appendResponse.status === 200) {
        const newPlayerId = appendResponse.data.updates.updatedRange.split("!")[1].split(":")[0].replace(/\D/g, "");
        res.status(201).json({ player: { id: newPlayerId, name } });
      } else {
        res.status(500).json({ error: "Error adding player." });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error." });
  }
}