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

// ---- Backups -------------------------------------------------------------
// Simple safety net stored right in the same Redis database: periodically
// dump the full config + every jersey's complete bid history into one
// snapshot, keyed by timestamp. A rolling index keeps track of which
// snapshots exist so old ones can be trimmed automatically.
//
// Note: this protects against application-level mistakes (an admin edit
// gone wrong, an accidental removal, a bug). It does NOT protect against
// the Upstash database itself being deleted or lost - for that you'd need
// a copy stored somewhere else entirely (e.g. a separate service).

const BACKUP_INDEX_KEY = "backup:index";
const BACKUP_RETENTION = 100; // keep the most recent 100 snapshots

export interface BackupSnapshot {
  timestamp: string;
  config: AuctionConfig;
  histories: Record<string, BidEntry[]>;
}

export async function createBackup(): Promise<BackupSnapshot> {
  const config = await getConfig();
  const histories: Record<string, BidEntry[]> = {};
  if (config.jerseys.length > 0) {
    const keys = config.jerseys.map((j) => "history:" + j.id);
    const results = await kv.mget<(BidEntry[] | null)[]>(...keys);
    config.jerseys.forEach((j, idx) => {
      histories[j.id] = results[idx] || [];
    });
  }
  const timestamp = new Date().toISOString();
  const snapshot: BackupSnapshot = { timestamp, config, histories };

  await kv.set("backup:" + timestamp, snapshot);
  await kv.lpush(BACKUP_INDEX_KEY, timestamp);
  await kv.ltrim(BACKUP_INDEX_KEY, 0, BACKUP_RETENTION - 1);

  // Clean up any snapshot keys that fell off the end of the retention window.
  const kept = await kv.lrange<string>(BACKUP_INDEX_KEY, 0, -1);
  const keptSet = new Set(kept);
  // Only bother scanning for stragglers occasionally-ish: cheap check first.
  if (kept.length >= BACKUP_RETENTION) {
    const older = await kv.lrange<string>(BACKUP_INDEX_KEY, BACKUP_RETENTION, BACKUP_RETENTION + 20);
    for (const ts of older) {
      if (!keptSet.has(ts)) await kv.del("backup:" + ts);
    }
  }

  return snapshot;
}

export async function listBackups(): Promise<string[]> {
  return kv.lrange<string>(BACKUP_INDEX_KEY, 0, BACKUP_RETENTION - 1);
}

export async function getBackup(timestamp: string): Promise<BackupSnapshot | null> {
  return kv.get<BackupSnapshot>("backup:" + timestamp);
}
