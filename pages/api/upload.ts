import type { NextApiRequest, NextApiResponse } from "next";
import { put } from "@vercel/blob";
import type { ApiError } from "../../lib/types";

// The browser uploads have failed before with a CORS error, because the
// old approach (@vercel/blob/client) makes the browser PUT the file
// directly to Vercel's blob storage domain, which is sensitive to token/
// environment-scope mismatches. Uploading through our own API route instead
// avoids the browser ever making a cross-origin request: the browser only
// talks to our own domain, and our server talks to Vercel Blob server-to-server.
export const config = {
  api: {
    bodyParser: false,
    // Small profile photos only - keep this generous but bounded.
    responseLimit: "8mb",
  },
};

interface UploadResponse {
  url: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse | ApiError>
) {
  if (req.method !== "POST") return res.status(405).end();
  if (req.headers["x-admin-password"] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Falsches Passwort." });
  }

  const filenameParam = req.query.filename;
  const filename = Array.isArray(filenameParam) ? filenameParam[0] : filenameParam;
  if (!filename) {
    return res.status(400).json({ error: "Dateiname fehlt." });
  }

  const contentType = req.headers["content-type"] || "application/octet-stream";
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  if (!allowed.includes(contentType)) {
    return res.status(400).json({ error: "Nur PNG, JPEG, WEBP oder GIF erlaubt." });
  }

  try {
    const blob = await put(filename, req, {
      access: "public",
      addRandomSuffix: true,
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    res.status(200).json({ url: blob.url });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Upload fehlgeschlagen.";
    res.status(400).json({ error: message });
  }
}
