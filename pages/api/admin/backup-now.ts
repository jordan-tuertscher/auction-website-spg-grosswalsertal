import type { NextApiRequest, NextApiResponse } from "next";
import { createBackup } from "../../../lib/store";
import type { ApiError } from "../../../lib/types";

function checkAuth(req: NextApiRequest): boolean {
  return req.headers["x-admin-password"] === process.env.ADMIN_PASSWORD;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: true; timestamp: string } | ApiError>
) {
  if (!checkAuth(req)) return res.status(401).json({ error: "Falsches Passwort." });
  if (req.method !== "POST") return res.status(405).end();
  try {
    const snapshot = await createBackup();
    res.status(200).json({ ok: true, timestamp: snapshot.timestamp });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Backup fehlgeschlagen." });
  }
}
