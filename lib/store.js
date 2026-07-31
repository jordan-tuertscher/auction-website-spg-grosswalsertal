import { kv } from "@vercel/kv";

export function defaultConfig() {
  const jerseys = [];
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

export async function getConfig() {
  let config = await kv.get("config");
  if (!config) {
    config = defaultConfig();
    await kv.set("config", config);
  }
  return config;
}

export async function setConfig(config) {
  await kv.set("config", config);
  return config;
}

export async function getHistory(jerseyId) {
  const history = await kv.get("history:" + jerseyId);
  return history || [];
}

export async function setHistory(jerseyId, history) {
  await kv.set("history:" + jerseyId, history);
  return history;
}

export async function appendBid(jerseyId, entry) {
  const history = await getHistory(jerseyId);
  history.push(entry);
  await setHistory(jerseyId, history);
  return history;
}

export async function deleteHistory(jerseyId) {
  await kv.del("history:" + jerseyId);
}

export function computeCurrent(history) {
  const active = (history || []).filter((e) => !e.removed);
  if (active.length === 0) return null;
  return active.reduce((a, b) => (b.amount > a.amount ? b : a));
}
