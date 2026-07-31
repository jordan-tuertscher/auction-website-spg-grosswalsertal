import { Redis } from "@upstash/redis";
import type { AuctionConfig, BidEntry, BidsMap, Jersey } from "./types";

const kv = Redis.fromEnv();

export function defaultConfig(): AuctionConfig {
  const jerseys: Jersey[] = [];
  for (let i = 1; i <= 24; i++) {
    jerseys.push({
      id: "j" + i,
      number: i,
      name: "Spieler " + i,
      start: 20,
      jerseyPhoto: "",
      facePhoto: "",
    });
  }
  const end = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  return {
    clubName: "Unser Verein",
    ended: false,
    endTime: end.toISOString(),
    jerseys,
  };
}

export async function getConfig(): Promise<AuctionConfig> {
  let config = await kv.get<AuctionConfig>("config");
  if (!config) {
    config = defaultConfig();
    await kv.set("config", config);
  }
  return config;
}

export async function setConfig(config: AuctionConfig): Promise<AuctionConfig> {
  await kv.set("config", config);
  return config;
}

export async function getHistory(jerseyId: string): Promise<BidEntry[]> {
  const history = await kv.get<BidEntry[]>("history:" + jerseyId);
  return history || [];
}

export async function setHistory(jerseyId: string, history: BidEntry[]): Promise<BidEntry[]> {
  await kv.set("history:" + jerseyId, history);
  return history;
}

export async function appendBid(jerseyId: string, entry: BidEntry): Promise<BidEntry[]> {
  const history = await getHistory(jerseyId);
  history.push(entry);
  await setHistory(jerseyId, history);
  return history;
}

export function computeCurrent(history: BidEntry[] | null | undefined): BidEntry | null {
  const active = (history || []).filter((e) => !e.removed);
  if (active.length === 0) return null;
  return active.reduce((a, b) => (b.amount > a.amount ? b : a));
}

/**
 * Fetches the config plus the current highest bid for every jersey in ONE
 * batched round-trip (mget) instead of one request per jersey. With ~24
 * jerseys, sequential calls added multiple seconds of latency; mget fetches
 * everything in a single network round-trip.
 */
export async function getConfigWithBids(): Promise<{ config: AuctionConfig; bids: BidsMap }> {
  const config = await getConfig();
  if (config.jerseys.length === 0) {
    return { config, bids: {} };
  }
  const keys = config.jerseys.map((j) => "history:" + j.id);
  const histories = await kv.mget<(BidEntry[] | null)[]>(...keys);
  const bids: BidsMap = {};
  config.jerseys.forEach((j, idx) => {
    bids[j.id] = computeCurrent(histories[idx]);
  });
  return { config, bids };
}
