import type { NextApiRequest, NextApiResponse } from "next";
import { listBackups } from "../../../lib/store";
import type { ApiError } from "../../../lib/types";

function checkAuth(req: NextApiRequest): boolean {
  return req.headers["x-admin-password"] === process.env.ADMIN_PASSWORD;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ backups: string[] } | ApiError>
) {
  if (!checkAuth(req)) return res.status(401).json({ error: "Falsches Passwort." });
  if (req.method !== "GET") return res.status(405).end();
  try {
    const backups = await listBackups();
    res.status(200).json({ backups });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden." });
  }
}
