import type { NextApiRequest, NextApiResponse } from "next";
import { getHistory } from "../../../lib/store";
import type { BidEntry, ApiError } from "../../../lib/types";

function checkAuth(req: NextApiRequest): boolean {
  return req.headers["x-admin-password"] === process.env.ADMIN_PASSWORD;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ history: BidEntry[] } | ApiError>
) {
  if (!checkAuth(req)) return res.status(401).json({ error: "Falsches Passwort." });
  if (req.method !== "GET") return res.status(405).end();
  try {
    const jerseyId = Array.isArray(req.query.jerseyId) ? req.query.jerseyId[0] : req.query.jerseyId;
    if (!jerseyId) return res.status(400).json({ error: "jerseyId fehlt." });
    const history = await getHistory(jerseyId);
    res.status(200).json({ history });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden." });
  }
}
