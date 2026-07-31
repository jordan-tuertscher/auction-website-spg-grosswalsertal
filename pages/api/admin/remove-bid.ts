import type { NextApiRequest, NextApiResponse } from "next";
import { getHistory, setHistory, computeCurrent } from "../../../lib/store";
import type { BidEntry, ApiError } from "../../../lib/types";

function checkAuth(req: NextApiRequest): boolean {
  return req.headers["x-admin-password"] === process.env.ADMIN_PASSWORD;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: true; current: BidEntry | null } | ApiError>
) {
  if (!checkAuth(req)) return res.status(401).json({ error: "Falsches Passwort." });
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { jerseyId, entryId } = req.body || {};
    if (!jerseyId || !entryId) return res.status(400).json({ error: "Angaben fehlen." });
    const history = await getHistory(jerseyId);
    const idx = history.findIndex((e) => e.id === entryId);
    if (idx >= 0) history[idx].removed = true;
    await setHistory(jerseyId, history);
    res.status(200).json({ ok: true, current: computeCurrent(history) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Entfernen." });
  }
}
