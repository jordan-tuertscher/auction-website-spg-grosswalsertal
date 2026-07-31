import { useEffect, useState, useCallback, useRef, memo } from "react";
import type { AuctionConfig, BidsMap, BidEntry, Jersey, ConfigResponse, ApiError } from "../lib/types";

function fmtEUR(n: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function ShirtIcon() {
  return (
    <svg className="shirt" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M22,14 L36,10 L42,0 L58,0 L64,10 L78,14 L92,30 L76,40 L76,92 L24,92 L24,40 L8,30 Z" fill="none" stroke="#962121" strokeWidth="2.5" opacity="0.9" />
      <path d="M36,10 L42,0 L58,0 L64,10 L58,18 L42,18 Z" fill="#962121" opacity="0.5" />
    </svg>
  );
}

function FaceIcon() {
  return (
    <svg className="face-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="50" cy="38" r="20" fill="none" stroke="#962121" strokeWidth="2.5" opacity="0.9" />
      <path d="M15,92 C15,66 30,56 50,56 C70,56 85,66 85,92" fill="none" stroke="#962121" strokeWidth="2.5" opacity="0.9" />
    </svg>
  );
}

function useCountdown(endTime: string | undefined, ended: boolean | undefined) {
  const [text, setText] = useState("--:--:--");
  const [isOver, setIsOver] = useState(false);
  useEffect(() => {
    function tick() {
      if (ended) { setText("00:00:00"); setIsOver(true); return; }
      if (!endTime) return;
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) { setText("00:00:00"); setIsOver(true); return; }
      setIsOver(false);
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      setText((d > 0 ? d + "T " : "") + pad(h) + ":" + pad(m) + ":" + pad(s));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime, ended]);
  return { text, isOver };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; data: T }> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T;
  return { ok: res.ok, data };
}

export default function Home() {
  const [config, setConfig] = useState<AuctionConfig | null>(null);
  const [bids, setBids] = useState<BidsMap>({});
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<"number" | "high" | "low">("number");
  const [bidJerseyId, setBidJerseyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPasswordState] = useState("");
  const isAdminRef = useRef(false);

  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  const fetchAll = useCallback(async () => {
    try {
      const { ok, data } = await fetchJson<ConfigResponse>("/api/config");
      if (ok) {
        setConfig(data.config);
        setBids(data.bids);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for live updates, but SKIP while the admin panel is open (fixes the
  // "resets while typing" bug: a background refresh used to overwrite
  // in-progress, unsaved admin edits every 8 seconds) and skip while the
  // tab isn't visible.
  useEffect(() => {
    fetchAll();
    const id = setInterval(() => {
      if (!isAdminRef.current && document.visibilityState === "visible") fetchAll();
    }, 8000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const { text: clockText, isOver } = useCountdown(config?.endTime, config?.ended);
  const ended = config ? config.ended || isOver : false;

  async function handleGearClick() {
    if (isAdmin) { setIsAdmin(false); fetchAll(); return; }
    const pw = window.prompt("Vorstands-Passwort eingeben:");
    if (pw === null) return;
    const { ok } = await fetchJson<{ ok: true } | ApiError>("/api/admin/ping", {
      headers: { "x-admin-password": pw },
    });
    if (ok) {
      setAdminPasswordState(pw);
      setIsAdmin(true);
    } else {
      window.alert("Falsches Passwort.");
    }
  }

  function currentAmount(j: Jersey): number {
    const b = bids[j.id];
    return b ? b.amount : j.start;
  }

  function sortedJerseys(): Jersey[] {
    if (!config) return [];
    const list = config.jerseys.slice();
    if (sortMode === "high") list.sort((a, b) => currentAmount(b) - currentAmount(a));
    else if (sortMode === "low") list.sort((a, b) => currentAmount(a) - currentAmount(b));
    else list.sort((a, b) => a.number - b.number);
    return list;
  }

  if (loading || !config) {
    return <div className="wrap"><div className="loading">Auktion wird geladen …</div></div>;
  }

  return (
    <div className="wrap">
      <div className="scoreboard">
        <div>
          <div className="brand">{config.clubName} <span>Trikot-Auktion</span></div>
          <div className="subtitle">Der Erlös kommt direkt dem Nachwuchs zugute</div>
        </div>
        <div className="clock-block">
          <div className="clock-label">{ended ? "Auktion beendet" : "Endet in"}</div>
          <div className={"clock" + (ended ? " ended" : "")}>{clockText}</div>
        </div>
      </div>

      <div className="toolbar">
        <p className="intro">Jeder Kampfmannschaftsspieler stellt sein Trikot zur Versteigerung. Bietet auf euer Lieblingsdress – der Höchstbietende bekommt es am Ende der Auktion.</p>
        <div className="sort-block">
          <label htmlFor="sortSelect">Sortieren</label>
          <select id="sortSelect" value={sortMode} onChange={(e) => setSortMode(e.target.value as "number" | "high" | "low")}>
            <option value="number">Trikotnummer</option>
            <option value="high">Höchstes Gebot zuerst</option>
            <option value="low">Niedrigstes Gebot zuerst</option>
          </select>
        </div>
      </div>

      {isAdmin && (
        <AdminPanel
          initialConfig={config}
          adminPassword={adminPassword}
          onConfigSaved={(newConfig) => setConfig(newConfig)}
          onBidRemoved={(jerseyId, current) => setBids((prev) => ({ ...prev, [jerseyId]: current }))}
        />
      )}

      <div className="grid">
        {sortedJerseys().map((j) => (
          <JerseyCard
            key={j.id}
            jersey={j}
            bid={bids[j.id] || null}
            ended={ended}
            onBid={() => setBidJerseyId(j.id)}
          />
        ))}
      </div>

      <div className="admin-gear" title="Vorstand" onClick={handleGearClick}>⚙</div>

      {bidJerseyId && (
        <BidModal
          jersey={config.jerseys.find((j) => j.id === bidJerseyId)!}
          currentBid={bids[bidJerseyId] || null}
          onClose={() => setBidJerseyId(null)}
          onSuccess={(current) => {
            setBids((prev) => ({ ...prev, [bidJerseyId]: current }));
            setBidJerseyId(null);
          }}
        />
      )}
    </div>
  );
}

const JerseyCard = memo(function JerseyCard({
  jersey, bid, ended, onBid,
}: { jersey: Jersey; bid: BidEntry | null; ended: boolean; onBid: () => void }) {
  const current = bid ? bid.amount : jersey.start;
  const label = bid ? "Höchstgebot" : "Startpreis";
  return (
    <div className="jcard">
      <div className="avatar-corner">
        {jersey.facePhoto
          ? <img src={jersey.facePhoto} alt={jersey.name} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          : <FaceIcon />}
      </div>
      <div className="jcard-top">
        <div className="jnum">{jersey.number}</div>
        <div className="jname">{jersey.name}</div>
      </div>
      <div className="photo-wrap">
        {jersey.jerseyPhoto
          ? <img src={jersey.jerseyPhoto} alt={"Trikot " + jersey.name} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          : <ShirtIcon />}
      </div>
      <div className="bidrow">
        <div>
          <div className="bidlabel">{label}</div>
          <div className="bidamount">{fmtEUR(current)}</div>
          {bid && <div className="bidder">von {bid.bidder}</div>}
        </div>
        {ended && (bid
          ? <span className="winner-tag">Gewonnen</span>
          : <span className="winner-tag" style={{ background: "#f3eded", color: "var(--muted)" }}>Kein Gebot</span>)}
      </div>
      <button className="bidbtn" disabled={ended} onClick={onBid}>
        {ended ? "Auktion beendet" : "Bieten"}
      </button>
    </div>
  );
});

function BidModal({
  jersey, currentBid, onClose, onSuccess,
}: { jersey: Jersey; currentBid: BidEntry | null; onClose: () => void; onSuccess: (current: BidEntry | null) => void }) {
  const minNext = (currentBid ? currentBid.amount : jersey.start - 5) + 5;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(minNext);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    if (!name.trim()) { setError("Bitte gib deinen Namen ein."); return; }
    if (phone.replace(/[^0-9]/g, "").length < 6) { setError("Bitte gib eine gültige Telefonnummer ein."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Bitte gib eine gültige E-Mail-Adresse ein."); return; }
    if (!amount || Number(amount) < minNext) { setError("Gebot muss mindestens " + fmtEUR(minNext) + " sein."); return; }
    setBusy(true);
    try {
      const { ok, data } = await fetchJson<{ ok: true; current: BidEntry | null } | ApiError>("/api/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jerseyId: jersey.id, amount: Number(amount), bidder: name.trim(), phone: phone.trim(), email: email.trim() }),
      });
      if (!ok) { setError((data as ApiError).error || "Fehler beim Speichern."); setBusy(false); return; }
      onSuccess((data as { ok: true; current: BidEntry | null }).current);
    } catch (e) {
      setError("Fehler beim Speichern. Bitte erneut versuchen.");
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>{jersey.name} &ndash; Trikot #{jersey.number}</h3>
        <p className="hint">Mindestgebot: {fmtEUR(minNext)}</p>
        <div className="field"><label>Dein Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vor- und Nachname" /></div>
        <div className="field"><label>Telefonnummer</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="z. B. 0664 1234567" /></div>
        <div className="field"><label>E-Mail-Adresse</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@beispiel.at" /></div>
        <div className="field"><label>Dein Gebot (EUR)</label><input type="number" min={minNext} step={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
        <p className="hint" style={{ marginTop: "-6px" }}>Telefonnummer und E-Mail werden nur für Rückfragen zur Trikot-Übergabe genutzt, nicht öffentlich angezeigt.</p>
        <div className="error-msg">{error}</div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Abbrechen</button>
          <button className="btn-confirm" onClick={submit} disabled={busy}>{busy ? "…" : "Gebot abgeben"}</button>
        </div>
      </div>
    </div>
  );
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function AdminPanel({
  initialConfig, adminPassword, onConfigSaved, onBidRemoved,
}: {
  initialConfig: AuctionConfig;
  adminPassword: string;
  onConfigSaved: (config: AuctionConfig) => void;
  onBidRemoved: (jerseyId: string, current: BidEntry | null) => void;
}) {
  // IMPORTANT: seeded once on mount only. Never re-synced from props on
  // later renders, so background refreshes elsewhere on the page can never
  // wipe out an edit that hasn't been saved yet.
  const [draft, setDraft] = useState<AuctionConfig>(() => structuredCloneConfig(initialConfig));
  const [endLocal, setEndLocal] = useState(() => toLocalInputValue(initialConfig.endTime));
  const [historyJerseyId, setHistoryJerseyIdState] = useState<string | null>(initialConfig.jerseys[0]?.id ?? null);
  const [historyEntries, setHistoryEntries] = useState<BidEntry[]>([]);
  const [status, setStatus] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (historyJerseyId) loadHistory(historyJerseyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function authHeaders(extra?: Record<string, string>) {
    return { "x-admin-password": adminPassword, ...(extra || {}) };
  }

  async function loadHistory(jerseyId: string) {
    const { ok, data } = await fetchJson<{ history: BidEntry[] } | ApiError>(
      "/api/admin/history?jerseyId=" + jerseyId,
      { headers: authHeaders() }
    );
    setHistoryEntries(ok ? (data as { history: BidEntry[] }).history : []);
  }

  function setHistoryJerseyId(id: string) {
    setHistoryJerseyIdState(id);
    loadHistory(id);
  }

  async function persist(newConfig: AuctionConfig): Promise<boolean> {
    const { ok } = await fetchJson<{ ok: true } | ApiError>("/api/admin/config", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(newConfig),
    });
    if (ok) {
      setDraft(newConfig);
      onConfigSaved(newConfig);
    }
    return ok;
  }

  function updateDraftJerseyField<K extends keyof Jersey>(jerseyId: string, field: K, value: Jersey[K]) {
    setDraft((prev) => ({
      ...prev,
      jerseys: prev.jerseys.map((j) => (j.id === jerseyId ? { ...j, [field]: value } : j)),
    }));
  }

  async function saveAllJerseyEdits() {
    const ok = await persist(draft);
    setStatus(ok ? "Trikots gespeichert." : "Fehler beim Speichern.");
  }

  async function handleUploadFile(jerseyId: string, kind: "jersey" | "face", file: File) {
    const key = jerseyId + ":" + kind;
    setUploadingKey(key);
    setStatus("Bild wird hochgeladen …");
    try {
      const filename = `${kind}-${jerseyId}-${Date.now()}-${file.name}`;
      const res = await fetch(`/api/upload?filename=${encodeURIComponent(filename)}`, {
        method: "POST",
        headers: authHeaders({ "content-type": file.type }),
        body: file,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload fehlgeschlagen.");
      const field: keyof Jersey = kind === "jersey" ? "jerseyPhoto" : "facePhoto";
      const newConfig: AuctionConfig = {
        ...draft,
        jerseys: draft.jerseys.map((j) => (j.id === jerseyId ? { ...j, [field]: data.url } : j)),
      };
      const ok = await persist(newConfig);
      setStatus(ok ? "Bild gespeichert." : "Fehler beim Speichern.");
    } catch (e) {
      setStatus("Upload fehlgeschlagen: " + (e instanceof Error ? e.message : "Unbekannter Fehler"));
    } finally {
      setUploadingKey(null);
    }
  }

  async function removeJersey(jerseyId: string) {
    const j = draft.jerseys.find((x) => x.id === jerseyId);
    if (!j) return;
    if (!window.confirm(`Trikot #${j.number} ("${j.name}") wirklich entfernen? Die Gebotshistorie wird ebenfalls gelöscht.`)) return;
    const newConfig: AuctionConfig = { ...draft, jerseys: draft.jerseys.filter((x) => x.id !== jerseyId) };
    const ok = await persist(newConfig);
    if (ok) {
      setStatus("Trikot entfernt.");
      if (historyJerseyId === jerseyId) {
        const next = newConfig.jerseys[0]?.id ?? null;
        setHistoryJerseyIdState(next);
        if (next) loadHistory(next); else setHistoryEntries([]);
      }
    }
  }

  async function addJersey() {
    const nextNum = Math.max(0, ...draft.jerseys.map((j) => j.number)) + 1;
    const id = "j" + Date.now();
    const newJersey: Jersey = { id, number: nextNum, name: "Neuer Spieler", start: 20, jerseyPhoto: "", facePhoto: "" };
    const newConfig: AuctionConfig = { ...draft, jerseys: [...draft.jerseys, newJersey] };
    await persist(newConfig);
  }

  async function saveEndTime() {
    const newConfig: AuctionConfig = { ...draft, endTime: new Date(endLocal).toISOString(), ended: false };
    const ok = await persist(newConfig);
    setStatus(ok ? "Endzeit gespeichert." : "Fehler beim Speichern.");
  }

  async function toggleEnded(nextEnded: boolean) {
    if (nextEnded && !window.confirm("Auktion jetzt beenden?")) return;
    await persist({ ...draft, ended: nextEnded });
  }

  async function saveClubName(name: string) {
    const clean = name.trim() || "Unser Verein";
    const ok = await persist({ ...draft, clubName: clean });
    setStatus(ok ? "Gespeichert." : "Fehler beim Speichern.");
  }

  async function removeBidEntry(entryId: string) {
    if (!historyJerseyId) return;
    if (!window.confirm("Dieses Gebot wirklich entfernen? Der nächstniedrigere Bieter rückt als Höchstgebot nach.")) return;
    const { ok, data } = await fetchJson<{ ok: true; current: BidEntry | null } | ApiError>("/api/admin/remove-bid", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ jerseyId: historyJerseyId, entryId }),
    });
    if (ok) {
      const current = (data as { ok: true; current: BidEntry | null }).current;
      onBidRemoved(historyJerseyId, current);
      loadHistory(historyJerseyId);
      setStatus("Gebot entfernt.");
    } else {
      setStatus("Fehler beim Entfernen.");
    }
  }

  const activeHistory = historyEntries.filter((e) => !e.removed).slice().sort((a, b) => b.amount - a.amount);

  return (
    <div className="admin-panel">
      <h3>Vorstandsbereich</h3>
      <div>
        <label>Vereinsname</label>
        <input type="text" defaultValue={draft.clubName} onBlur={(e) => saveClubName(e.target.value)} />
      </div>

      <div className="sec">
        <label>Ende der Auktion</label>
        <div className="admin-row">
          <input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
          <button className="admin-btn" onClick={saveEndTime}>Speichern</button>
        </div>
        <div className="admin-row">
          {draft.ended
            ? <button className="admin-btn" onClick={() => toggleEnded(false)}>Auktion wieder öffnen</button>
            : <button className="admin-btn danger" onClick={() => toggleEnded(true)}>Auktion jetzt beenden</button>}
        </div>
      </div>

      <div className="sec">
        <label>Trikots (Nummer / Name / Startpreis / Fotos)</label>
        {draft.jerseys.map((j) => (
          <div className="admin-row" key={j.id}>
            <input type="number" className="jn" value={j.number} onChange={(e) => updateDraftJerseyField(j.id, "number", Number(e.target.value) || 0)} />
            <input type="text" className="nm" value={j.name} onChange={(e) => updateDraftJerseyField(j.id, "name", e.target.value)} />
            <input type="number" className="pr" value={j.start} onChange={(e) => updateDraftJerseyField(j.id, "start", Number(e.target.value) || 0)} />
            {j.jerseyPhoto && <img className="thumb" src={j.jerseyPhoto} alt="Trikot" />}
            <label className="upload-label">
              {uploadingKey === j.id + ":jersey" ? "Lädt hoch …" : "Trikotbild"}
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUploadFile(j.id, "jersey", e.target.files[0])} />
            </label>
            {j.facePhoto && <img className="thumb" src={j.facePhoto} alt="Gesicht" />}
            <label className="upload-label">
              {uploadingKey === j.id + ":face" ? "Lädt hoch …" : "Gesichtsfoto"}
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUploadFile(j.id, "face", e.target.files[0])} />
            </label>
            <button className="admin-btn danger" style={{ margin: 0, padding: "6px 10px", fontSize: 12 }} onClick={() => removeJersey(j.id)}>Entfernen</button>
          </div>
        ))}
        <button className="admin-btn" onClick={saveAllJerseyEdits}>Änderungen speichern</button>{" "}
        <button className="admin-btn" onClick={addJersey}>Trikot hinzufügen</button>
      </div>

      <div className="sec">
        <label>Gebotshistorie einsehen & Fake-Gebote entfernen</label>
        <select value={historyJerseyId || ""} onChange={(e) => setHistoryJerseyId(e.target.value)} style={{ marginBottom: 10, padding: "6px 8px" }}>
          {draft.jerseys.map((j) => (
            <option key={j.id} value={j.id}>#{j.number} {j.name}</option>
          ))}
        </select>
        {activeHistory.length === 0 ? (
          <p className="status-line">Für dieses Trikot liegen noch keine Gebote vor.</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr><th>Zeit</th><th>Bieter</th><th>Telefon</th><th>E-Mail</th><th>Gebot</th><th></th></tr>
            </thead>
            <tbody>
              {activeHistory.map((entry, idx) => (
                <tr key={entry.id} style={idx === 0 ? { background: "#fbeaea" } : {}}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(entry.time).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{entry.bidder}{idx === 0 && <span style={{ color: "var(--red)", fontSize: 11 }}> (höchstes)</span>}</td>
                  <td>{entry.phone || "-"}</td>
                  <td>{entry.email || "-"}</td>
                  <td style={{ fontFamily: "Space Mono, monospace" }}>{fmtEUR(entry.amount)}</td>
                  <td><button className="admin-btn danger" style={{ margin: 0, padding: "4px 10px", fontSize: 12 }} onClick={() => removeBidEntry(entry.id)}>Entfernen</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="status-line">{status}</div>
    </div>
  );
}

function structuredCloneConfig(config: AuctionConfig): AuctionConfig {
  return {
    ...config,
    jerseys: config.jerseys.map((j) => ({ ...j })),
  };
}
