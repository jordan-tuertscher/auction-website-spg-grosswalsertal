import type { NextApiRequest, NextApiResponse } from "next";
import { setConfig } from "../../../lib/store";
import type { AuctionConfig, ApiError } from "../../../lib/types";

function checkAuth(req: NextApiRequest): boolean {
  return req.headers["x-admin-password"] === process.env.ADMIN_PASSWORD;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: true } | ApiError>
) {
  if (!checkAuth(req)) return res.status(401).json({ error: "Falsches Passwort." });
  if (req.method !== "POST") return res.status(405).end();
  try {
    const config = req.body as AuctionConfig;
    if (!config || !Array.isArray(config.jerseys)) {
      return res.status(400).json({ error: "Ungültige Konfiguration." });
    }
    await setConfig(config);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Speichern." });
  }
}
