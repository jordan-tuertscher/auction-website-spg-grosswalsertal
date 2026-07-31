import { useEffect, useState, useCallback, useRef } from "react";
import { upload } from "@vercel/blob/client";

function fmtEUR(n) {
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

function useCountdown(endTime, ended) {
  const [text, setText] = useState("--:--:--");
  const [isOver, setIsOver] = useState(false);
  useEffect(() => {
    function tick() {
      if (ended) { setText("00:00:00"); setIsOver(true); return; }
      const diff = new Date(endTime) - new Date();
      if (diff <= 0) { setText("00:00:00"); setIsOver(true); return; }
      setIsOver(false);
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const pad = (n) => String(n).padStart(2, "0");
      setText((d > 0 ? d + "T " : "") + pad(h) + ":" + pad(m) + ":" + pad(s));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime, ended]);
  return { text, isOver };
}

export default function Home() {
  const [config, setConfig] = useState(null);
  const [bids, setBids] = useState({});
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState("number");
  const [bidJerseyId, setBidJerseyId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [historyJerseyId, setHistoryJerseyId] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [status, setStatus] = useState("");
  const uploadBusyRef = useRef(false);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      setConfig(data.config);
      setBids(data.bids);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 8000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const { text: clockText, isOver } = useCountdown(config?.endTime, config?.ended);
  const ended = config ? (config.ended || isOver) : false;

  async function loadHistory(jerseyId) {
    if (!jerseyId) return;
    try {
      const res = await fetch("/api/admin/history?jerseyId=" + jerseyId, {
        headers: { "x-admin-password": adminPassword },
      });
      const data = await res.json();
      if (res.ok) setHistoryEntries(data.history || []);
      else setHistoryEntries([]);
    } catch (e) {
      setHistoryEntries([]);
    }
  }

  async function handleGearClick() {
    if (isAdmin) { setIsAdmin(false); return; }
    const pw = window.prompt("Vorstands-Passwort eingeben:");
    if (pw === null) return;
    const res = await fetch("/api/admin/ping", { headers: { "x-admin-password": pw } });
    if (res.ok) {
      setAdminPassword(pw);
      setIsAdmin(true);
      if (config?.jerseys?.length) {
        setHistoryJerseyId(config.jerseys[0].id);
        loadHistory(config.jerseys[0].id);
      }
    } else {
      window.alert("Falsches Passwort.");
    }
  }

  async function saveConfigToServer(newConfig) {
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify(newConfig),
      });
      if (!res.ok) { setStatus("Fehler beim Speichern."); return false; }
      setConfig(newConfig);
      return true;
    } catch (e) {
      setStatus("Fehler beim Speichern.");
      return false;
    }
  }

  function currentAmount(j) {
    const b = bids[j.id];
    return b ? b.amount : j.start;
  }

  function sortedJerseys() {
    if (!config) return [];
    const list = config.jerseys.slice();
    if (sortMode === "high") list.sort((a, b) => currentAmount(b) - currentAmount(a));
    else if (sortMode === "low") list.sort((a, b) => currentAmount(a) - currentAmount(b));
    else list.sort((a, b) => a.number - b.number);
    return list;
  }

  async function handleUploadFile(jerseyId, kind, file) {
    if (!file || uploadBusyRef.current) return;
    uploadBusyRef.current = true;
    setStatus("Bild wird hochgeladen …");
    try {
      const blob = await upload(`${kind}-${jerseyId}-${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        clientPayload: JSON.stringify({ password: adminPassword }),
      });
      const newJerseys = config.jerseys.map((j) =>
        j.id === jerseyId ? { ...j, [kind === "jersey" ? "jerseyPhoto" : "facePhoto"]: blob.url } : j
      );
      const newConfig = { ...config, jerseys: newJerseys };
      const ok = await saveConfigToServer(newConfig);
      setStatus(ok ? "Bild gespeichert." : "Fehler beim Speichern.");
    } catch (e) {
      console.error(e);
      setStatus("Upload fehlgeschlagen: " + e.message);
    } finally {
      uploadBusyRef.current = false;
    }
  }

  function updateJerseyField(jerseyId, field, value) {
    const newJerseys = config.jerseys.map((j) => (j.id === jerseyId ? { ...j, [field]: value } : j));
    setConfig({ ...config, jerseys: newJerseys });
  }

  async function saveAllJerseyEdits() {
    const ok = await saveConfigToServer(config);
    setStatus(ok ? "Trikots gespeichert." : "Fehler beim Speichern.");
  }

  async function removeJersey(jerseyId) {
    const j = config.jerseys.find((x) => x.id === jerseyId);
    if (!window.confirm(`Trikot #${j.number} ("${j.name}") wirklich entfernen? Die Gebotshistorie wird ebenfalls gelöscht.`)) return;
    const newJerseys = config.jerseys.filter((x) => x.id !== jerseyId);
    const newConfig = { ...config, jerseys: newJerseys };
    const ok = await saveConfigToServer(newConfig);
    if (ok) {
      const newBids = { ...bids };
      delete newBids[jerseyId];
      setBids(newBids);
      if (historyJerseyId === jerseyId) setHistoryJerseyId(newJerseys[0]?.id || null);
      setStatus("Trikot entfernt.");
    }
  }

  function addJersey() {
    const nextNum = Math.max(0, ...config.jerseys.map((j) => j.number)) + 1;
    const id = "j" + Date.now();
    const newConfig = { ...config, jerseys: [...config.jerseys, { id, number: nextNum, name: "Neuer Spieler", start: 20, jerseyPhoto: "", facePhoto: "" }] };
    saveConfigToServer(newConfig);
  }

  async function saveEndTime(value) {
    const newConfig = { ...config, endTime: new Date(value).toISOString(), ended: false };
    const ok = await saveConfigToServer(newConfig);
    setStatus(ok ? "Endzeit gespeichert." : "Fehler beim Speichern.");
  }

  async function toggleEnded(nextEnded) {
    if (nextEnded && !window.confirm("Auktion jetzt beenden?")) return;
    const newConfig = { ...config, ended: nextEnded };
    await saveConfigToServer(newConfig);
  }

  async function removeBidEntry(entryId) {
    if (!window.confirm("Dieses Gebot wirklich entfernen? Der nächstniedrigere Bieter rückt als Höchstgebot nach.")) return;
    try {
      const res = await fetch("/api/admin/remove-bid", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({ jerseyId: historyJerseyId, entryId }),
      });
      const data = await res.json();
      if (res.ok) {
        setBids({ ...bids, [historyJerseyId]: data.current });
        loadHistory(historyJerseyId);
        setStatus("Gebot entfernt.");
      } else {
        setStatus("Fehler beim Entfernen.");
      }
    } catch (e) {
      setStatus("Fehler beim Entfernen.");
    }
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
          <select id="sortSelect" value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
            <option value="number">Trikotnummer</option>
            <option value="high">Höchstes Gebot zuerst</option>
            <option value="low">Niedrigstes Gebot zuerst</option>
          </select>
        </div>
      </div>

      {isAdmin && (
        <AdminPanel
          config={config}
          setConfig={setConfig}
          onSaveEndTime={saveEndTime}
          onToggleEnded={toggleEnded}
          onUpdateField={updateJerseyField}
          onSaveJerseys={saveAllJerseyEdits}
          onAddJersey={addJersey}
          onRemoveJersey={removeJersey}
          onUploadFile={handleUploadFile}
          historyJerseyId={historyJerseyId}
          setHistoryJerseyId={(id) => { setHistoryJerseyId(id); loadHistory(id); }}
          historyEntries={historyEntries}
          onRemoveBidEntry={removeBidEntry}
          status={status}
          onClubNameChange={async (name) => {
            const newConfig = { ...config, clubName: name };
            const ok = await saveConfigToServer(newConfig);
            setStatus(ok ? "Gespeichert." : "Fehler beim Speichern.");
          }}
        />
      )}

      <div className="grid">
        {sortedJerseys().map((j) => {
          const bid = bids[j.id];
          const current = currentAmount(j);
          const label = bid ? "Höchstgebot" : "Startpreis";
          return (
            <div className="jcard" key={j.id}>
              <div className="avatar-corner">
                {j.facePhoto ? <img src={j.facePhoto} alt={j.name} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <FaceIcon />}
              </div>
              <div className="jcard-top">
                <div className="jnum">{j.number}</div>
                <div className="jname">{j.name}</div>
              </div>
              <div className="photo-wrap">
                {j.jerseyPhoto ? <img src={j.jerseyPhoto} alt={"Trikot " + j.name} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <ShirtIcon />}
              </div>
              <div className="bidrow">
                <div>
                  <div className="bidlabel">{label}</div>
                  <div className="bidamount">{fmtEUR(current)}</div>
                  {bid && <div className="bidder">von {bid.bidder}</div>}
                </div>
                {ended && (bid ? <span className="winner-tag">Gewonnen</span> : <span className="winner-tag" style={{ background: "#f3eded", color: "var(--muted)" }}>Kein Gebot</span>)}
              </div>
              <button className="bidbtn" disabled={ended} onClick={() => setBidJerseyId(j.id)}>
                {ended ? "Auktion beendet" : "Bieten"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="admin-gear" title="Vorstand" onClick={handleGearClick}>⚙</div>

      {bidJerseyId && (
        <BidModal
          jersey={config.jerseys.find((j) => j.id === bidJerseyId)}
          currentBid={bids[bidJerseyId]}
          onClose={() => setBidJerseyId(null)}
          onSuccess={(current) => { setBids({ ...bids, [bidJerseyId]: current }); setBidJerseyId(null); }}
        />
      )}
    </div>
  );
}

function BidModal({ jersey, currentBid, onClose, onSuccess }) {
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
      const res = await fetch("/api/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jerseyId: jersey.id, amount: Number(amount), bidder: name.trim(), phone: phone.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Fehler beim Speichern."); setBusy(false); return; }
      onSuccess(data.current);
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
        <div className="field"><label>Dein Gebot (EUR)</label><input type="number" min={minNext} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
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

function AdminPanel({
  config, onSaveEndTime, onToggleEnded, onUpdateField, onSaveJerseys, onAddJersey, onRemoveJersey,
  onUploadFile, historyJerseyId, setHistoryJerseyId, historyEntries, onRemoveBidEntry, status, onClubNameChange,
}) {
  const [endLocal, setEndLocal] = useState(() => toLocalInputValue(config.endTime));

  function toLocalInputValue(iso) {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  const activeHistory = historyEntries.filter((e) => !e.removed).slice().sort((a, b) => b.amount - a.amount);

  return (
    <div className="admin-panel">
      <h3>Vorstandsbereich</h3>
      <div>
        <label>Vereinsname</label>
        <input type="text" defaultValue={config.clubName} onBlur={(e) => onClubNameChange(e.target.value.trim() || "Unser Verein")} />
      </div>

      <div className="sec">
        <label>Ende der Auktion</label>
        <div className="admin-row">
          <input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
          <button className="admin-btn" onClick={() => onSaveEndTime(endLocal)}>Speichern</button>
        </div>
        <div className="admin-row">
          {config.ended
            ? <button className="admin-btn" onClick={() => onToggleEnded(false)}>Auktion wieder öffnen</button>
            : <button className="admin-btn danger" onClick={() => onToggleEnded(true)}>Auktion jetzt beenden</button>}
        </div>
      </div>

      <div className="sec">
        <label>Trikots (Nummer / Name / Startpreis / Fotos)</label>
        {config.jerseys.map((j) => (
          <div className="admin-row" key={j.id}>
            <input type="number" className="jn" value={j.number} onChange={(e) => onUpdateField(j.id, "number", Number(e.target.value) || 0)} />
            <input type="text" className="nm" value={j.name} onChange={(e) => onUpdateField(j.id, "name", e.target.value)} />
            <input type="number" className="pr" value={j.start} onChange={(e) => onUpdateField(j.id, "start", Number(e.target.value) || 0)} />
            {j.jerseyPhoto && <img className="thumb" src={j.jerseyPhoto} alt="Trikot" />}
            <label className="upload-label">
              Trikotbild
              <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && onUploadFile(j.id, "jersey", e.target.files[0])} />
            </label>
            {j.facePhoto && <img className="thumb" src={j.facePhoto} alt="Gesicht" />}
            <label className="upload-label">
              Gesichtsfoto
              <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && onUploadFile(j.id, "face", e.target.files[0])} />
            </label>
            <button className="admin-btn danger" style={{ margin: 0, padding: "6px 10px", fontSize: 12 }} onClick={() => onRemoveJersey(j.id)}>Entfernen</button>
          </div>
        ))}
        <button className="admin-btn" onClick={onSaveJerseys}>Änderungen speichern</button>{" "}
        <button className="admin-btn" onClick={onAddJersey}>Trikot hinzufügen</button>
      </div>

      <div className="sec">
        <label>Gebotshistorie einsehen & Fake-Gebote entfernen</label>
        <select value={historyJerseyId || ""} onChange={(e) => setHistoryJerseyId(e.target.value)} style={{ marginBottom: 10, padding: "6px 8px" }}>
          {config.jerseys.map((j) => (
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
                  <td><button className="admin-btn danger" style={{ margin: 0, padding: "4px 10px", fontSize: 12 }} onClick={() => onRemoveBidEntry(entry.id)}>Entfernen</button></td>
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
