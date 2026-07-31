import type { NextApiRequest, NextApiResponse } from "next";
import { getConfigWithBids } from "../../lib/store";
import type { ConfigResponse, ApiError } from "../../lib/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConfigResponse | ApiError>
) {
  if (req.method !== "GET") return res.status(405).end();
  try {
    const { config, bids } = await getConfigWithBids();
    res.status(200).json({ config, bids });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden." });
  }
}
