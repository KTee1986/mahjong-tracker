
import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
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
    } else {
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error("API ERROR:", error);
    res.status(500).json({ error: error.message });
  }
}
