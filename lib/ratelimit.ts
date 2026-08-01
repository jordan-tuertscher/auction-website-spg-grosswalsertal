import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextApiRequest } from "next";

const redis = Redis.fromEnv();

/**
 * Protects the backend from being overwhelmed by a burst of requests
 * (bug, bot, someone hammering the button, etc.) - caps total bid
 * submissions across ALL visitors combined at 10 per second.
 */
export const globalBidLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 s"),
  analytics: false,
  prefix: "ratelimit:bid:global",
});

/**
 * Protects against a single visitor (or a script) spamming the bid button.
 * A real person bidding by hand never needs more than this - one bid every
 * few seconds is already generous.
 */
export const perIpBidLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "5 s"),
  analytics: false,
  prefix: "ratelimit:bid:ip",
});

export function getClientIp(req: NextApiRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0];
  return req.socket.remoteAddress || "unknown";
}
