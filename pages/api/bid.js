import { getConfig, getHistory, appendBid, computeCurrent } from "../../lib/store";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { jerseyId, amount, bidder, phone, email } = req.body || {};

    if (!jerseyId || !bidder || !phone || !email || !amount) {
      return res.status(400).json({ error: "Bitte alle Felder ausfüllen." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Ungültige E-Mail-Adresse." });
    }
    if (String(phone).replace(/[^0-9]/g, "").length < 6) {
      return res.status(400).json({ error: "Ungültige Telefonnummer." });
    }

    const config = await getConfig();
    const jersey = config.jerseys.find((j) => j.id === jerseyId);
    if (!jersey) return res.status(404).json({ error: "Trikot nicht gefunden." });

    const ended = config.ended || new Date() >= new Date(config.endTime);
    if (ended) return res.status(400).json({ error: "Die Auktion ist bereits beendet." });

    const history = await getHistory(jerseyId);
    const current = computeCurrent(history);
    const minNext = (current ? current.amount : jersey.start - 5) + 5;

    const amountNum = Number(amount);
    if (!amountNum || amountNum < minNext) {
      return res.status(400).json({ error: "Gebot zu niedrig.", minNext });
    }

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      amount: amountNum,
      bidder: String(bidder).trim(),
      phone: String(phone).trim(),
      email: String(email).trim(),
      time: new Date().toISOString(),
      removed: false,
    };

    const updated = await appendBid(jerseyId, entry);
    res.status(200).json({ ok: true, current: computeCurrent(updated) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Fehler beim Speichern des Gebots." });
  }
}
