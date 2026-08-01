import type { NextApiRequest, NextApiResponse } from "next";
import { getConfig, getHistory, appendBid, computeCurrent } from "../../lib/store";
import { globalBidLimiter, perIpBidLimiter, getClientIp } from "../../lib/ratelimit";
import type { BidEntry, ApiError } from "../../lib/types";

interface BidResponse {
  ok: true;
  current: BidEntry | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BidResponse | ApiError>
) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    // Global cap: protects the backend from being overwhelmed if something
    // sends a burst of requests (bug, bot, accidental flood, etc.).
    const globalCheck = await globalBidLimiter.limit("bids");
    if (!globalCheck.success) {
      return res.status(429).json({ error: "Gerade sehr viel Andrang. Bitte in ein paar Sekunden nochmal versuchen." });
    }

    // Per-visitor cap: stops a single script or accidental double-clicking
    // from spamming the bid button. Generous for a real human bidder.
    const ip = getClientIp(req);
    const ipCheck = await perIpBidLimiter.limit(ip);
    if (!ipCheck.success) {
      return res.status(429).json({ error: "Bitte kurz warten, bevor du erneut bietest." });
    }

    const { jerseyId, amount, bidder, phone, email } = req.body || {};

    if (!jerseyId || !bidder || !amount) {
      return res.status(400).json({ error: "Bitte Name und Gebot ausfüllen." });
    }
    const phoneTrimmed = phone ? String(phone).trim() : "";
    const emailTrimmed = email ? String(email).trim() : "";
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      return res.status(400).json({ error: "Ungültige E-Mail-Adresse." });
    }
    if (phoneTrimmed && phoneTrimmed.replace(/[^0-9]/g, "").length < 6) {
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

    const entry: BidEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      amount: amountNum,
      bidder: String(bidder).trim(),
      phone: phoneTrimmed,
      email: emailTrimmed,
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
