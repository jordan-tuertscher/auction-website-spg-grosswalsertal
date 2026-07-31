import { getConfig, getHistory, computeCurrent } from "../../lib/store";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  try {
    const config = await getConfig();
    const bids = {};
    for (const j of config.jerseys) {
      const history = await getHistory(j.id);
      bids[j.id] = computeCurrent(history);
    }
    res.status(200).json({ config, bids });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Laden." });
  }
}
