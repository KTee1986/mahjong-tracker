import { google } from "googleapis";

const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const sheetName = "Sheet1";

async function getSheetValues() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z1000`,
  });
  return response.data.values || [];
}

async function findRowIndexByGameId(gameId) {
  const values = await getSheetValues();
  const header = values[0];
  const idIndex = header.indexOf("Game ID");

  for (let i = 1; i < values.length; i++) {
    if (values[i][idIndex] === gameId) return i + 1;
  }
  return -1;
}

export default async function handler(req, res) {
  const method = req.method;

  try {
    if (method === "GET") {
      const values = await getSheetValues();
      res.status(200).json({ data: values });
    } else if (method === "POST") {
      const { players, scores } = req.body;
      if (!players || !scores) {
        return res.status(400).json({ error: "Missing players or scores" });
      }

      const timestamp = new Date().toISOString();
      const gameId = `GM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const row = [
        gameId,
        timestamp,
        players.East || "",
        scores.East || "",
        players.South || "",
        scores.South || "",
        players.West || "",
        scores.West || "",
        players.North || "",
        scores.North || "",
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      });

      res.status(201).json({ message: "Game recorded", gameId, timestamp });
    } else if (method === "PUT") {
      const { gameId, updatedRow } = req.body;
      if (!gameId || !Array.isArray(updatedRow)) {
        return res.status(400).json({ error: "Missing gameId or updatedRow" });
      }

      const rowIndex = await findRowIndexByGameId(gameId);
      if (rowIndex === -1) {
        return res.status(404).json({ error: "Game ID not found." });
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${rowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [updatedRow] },
      });

      res.status(200).json({ message: "Row updated." });
    } else if (method === "DELETE") {
      const { gameId } = req.body;
      if (!gameId) {
        return res.status(400).json({ error: "Missing gameId" });
      }

      const rowIndex = await findRowIndexByGameId(gameId);
      if (rowIndex === -1) {
        return res.status(404).json({ error: "Game ID not found." });
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: 0,
                  dimension: "ROWS",
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex,
                },
              },
            },
          ],
        },
      });

      res.status(200).json({ message: "Row deleted." });
    } else {
      res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
      res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error("Google Sheets API error:", error);
    res.status(500).json({ error: error.message });
  }
}
