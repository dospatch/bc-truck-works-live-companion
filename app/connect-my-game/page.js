"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export default function ConnectMyGame() {
  const [pair, setPair] = useState(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function generate() {
    setBusy(true); setError("");
    try { const r = await fetch("/api/pair", { method: "POST", cache: "no-store" }); const data = await r.json(); if (!r.ok) throw new Error(data.error || "Could not create code."); setPair(data); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { generate(); }, []);
  const remaining = pair ? Math.max(0, Math.ceil((pair.expiresAt - Date.now()) / 1000)) : 0;
  return <main className="convoy-page"><header className="convoy-header"><div><p className="eyebrow">BC TRUCK WORKS</p><h1>Connect my game</h1><p>Pair your Windows companion to share live ATS/ETS2 telemetry with your convoy.</p></div><Link className="convoy-link" href="/convoy">View convoy</Link></header><section className="pair-panel"><h2>Your pairing code</h2>{pair && remaining > 0 ? <><div className="pair-code">{pair.code}</div><p>This code expires in 10 minutes. Enter it in the desktop companion. Keep it private until pairing is complete.</p><button className="convoy-button" onClick={generate} disabled={busy}>Generate new code</button></> : <><p>{pair ? "This code has expired." : "Preparing a secure one-time code…"}</p><button className="convoy-button" onClick={generate} disabled={busy}>{busy ? "Please wait…" : "Get pairing code"}</button></>}{error && <p role="alert" className="convoy-error">{error}</p>}</section></main>;
}
