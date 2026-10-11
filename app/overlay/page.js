"use client";
import { useEffect, useState } from "react";
import "./overlay.css";
const EMPTY = { connected: false, valuesAreLive: false, status: "connecting", source: null, truck: null, job: null, message: "Waiting for game telemetry" };
function value(v, suffix = "") { return v === null || v === undefined || v === "" ? "—" : String(v) + suffix; }
export default function OverlayPage() {
  const [data, setData] = useState(EMPTY);
  useEffect(() => {
    let stopped = false, timer;
    const poll = async () => {
      try { const response = await fetch("http://127.0.0.1:32146/status", { cache: "no-store", signal: AbortSignal.timeout(1200) }); if (!response.ok) throw new Error("bridge unavailable"); const next = await response.json(); if (!stopped) setData(next); }
      catch { if (!stopped) setData({ ...EMPTY, status: "bridge_unavailable", message: "Desktop telemetry bridge unavailable" }); }
      finally { if (!stopped) timer = window.setTimeout(poll, 500); }
    }; poll(); return () => { stopped = true; window.clearTimeout(timer); };
  }, []);
  const live = data.connected && data.valuesAreLive, truck = data.truck || {}, job = data.job || {};
  return <main className="bc-overlay">
    <header className="bc-overlay-head"><div className="bc-brand"><b>BC</b><div><strong>TRUCK WORKS</strong><small>LIVE COMPANION</small></div></div><span className={live ? "bc-state live" : "bc-state"}>{live ? String(data.source || "GAME").toUpperCase() + " LIVE" : "NOT CONNECTED"}</span></header>
    <section className="bc-speed"><div><small>ROAD SPEED</small><strong>{value(truck.speedMph)}<em> MPH</em></strong></div><div className="bc-limit"><small>SPEED LIMIT</small><b>{value(truck.speedLimitMph)} MPH</b></div></section>
    <section className="bc-grid">
      <div><small>FUEL</small><b>{value(truck.fuelPercent, "%")}</b><span>{value(truck.fuelLitres, " L")}</span></div>
      <div><small>GEAR / RPM</small><b>{value(truck.gear)}</b><span>{value(truck.engineRpm, " RPM")}</span></div>
      <div><small>TRUCK WEAR</small><b>{value(truck.truckDamagePercent, "%")}</b><span>Truck condition</span></div>
      <div><small>CARGO DAMAGE</small><b>{value(truck.cargoDamagePercent, "%")}</b><span>Delivery condition</span></div>
    </section>
    <section className="bc-route"><small>ACTIVE DELIVERY</small><strong>{job.active ? (job.destination || "Destination unavailable") : "No active delivery"}</strong><span>{job.active ? value(job.remainingDistanceMiles, " mi remaining") : "Load a job to see route information"}</span>{job.cargo ? <span className="bc-cargo">{job.cargo}</span> : null}</section>
    <footer><span>{data.message || "Telemetry status unknown"}</span><b>{live ? "DATA LIVE" : "WAITING"}</b></footer>
  </main>;
}