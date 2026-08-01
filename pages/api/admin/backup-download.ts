import type { NextApiRequest, NextApiResponse } from "next";
import { getBackup } from "../../../lib/store";
import type { ApiError } from "../../../lib/types";

function checkAuth(req: NextApiRequest): boolean {
  return req.headers["x-admin-password"] === process.env.ADMIN_PASSWORD;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkAuth(req)) return res.status(401).json({ error: "Falsches Passwort." } as ApiError);
  if (req.method !== "GET") return res.status(405).end();
  try {
    const timestampParam = req.query.timestamp;
    const timestamp = Array.isArray(timestampParam) ? timestampParam[0] : timestampParam;
    if (!timestamp) return res.status(400).json({ error: "timestamp fehlt." } as ApiError);

    const snapshot = await getBackup(timestamp);
    if (!snapshot) return res.status(404).json({ error: "Backup nicht gefunden." } as ApiError);

    const filename = `trikot-auktion-backup-${timestamp.replace(/[:.]/g, "-")}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(JSON.stringify(snapshot, null, 2));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden." } as ApiError);
  }
}
