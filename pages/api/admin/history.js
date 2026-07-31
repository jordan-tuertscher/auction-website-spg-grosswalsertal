import { getHistory } from "../../../lib/store";

function checkAuth(req) {
  return req.headers["x-admin-password"] === process.env.ADMIN_PASSWORD;
}

export default async function handler(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ error: "Falsches Passwort." });
  if (req.method !== "GET") return res.status(405).end();
  try {
    const { jerseyId } = req.query;
    if (!jerseyId) return res.status(400).json({ error: "jerseyId fehlt." });
    const history = await getHistory(jerseyId);
    res.status(200).json({ history });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden." });
  }
}
