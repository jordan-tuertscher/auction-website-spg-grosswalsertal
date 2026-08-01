import type { NextApiRequest, NextApiResponse } from "next";
import { createBackup } from "../../lib/store";
import type { ApiError } from "../../lib/types";

// Accepts two ways of authenticating, so this works both with Vercel's own
// Cron Jobs (which send `Authorization: Bearer ${CRON_SECRET}` automatically)
// and with a free external scheduler like cron-job.org (which can call this
// URL with `?secret=...` instead) - useful because Vercel's Hobby plan only
// allows cron jobs to run once per day, not every 4 hours.
function isAuthorized(req: NextApiRequest): boolean {
  const authHeader = req.headers["authorization"];
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }
  const secretParam = Array.isArray(req.query.secret) ? req.query.secret[0] : req.query.secret;
  if (process.env.BACKUP_SECRET && secretParam === process.env.BACKUP_SECRET) {
    return true;
  }
  return false;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: true; timestamp: string } | ApiError>
) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Nicht autorisiert." });
  }
  try {
    const snapshot = await createBackup();
    res.status(200).json({ ok: true, timestamp: snapshot.timestamp });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Backup fehlgeschlagen." });
  }
}
