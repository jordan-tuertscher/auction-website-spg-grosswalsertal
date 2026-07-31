import type { NextApiRequest, NextApiResponse } from "next";
import type { ApiError } from "../../../lib/types";

function checkAuth(req: NextApiRequest): boolean {
  return req.headers["x-admin-password"] === process.env.ADMIN_PASSWORD;
}

export default function handler(req: NextApiRequest, res: NextApiResponse<{ ok: true } | ApiError>) {
  if (!checkAuth(req)) return res.status(401).json({ error: "Falsches Passwort." });
  res.status(200).json({ ok: true });
}
