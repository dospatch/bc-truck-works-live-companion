const http = require("http");

const HOST = "127.0.0.1";
const PORT = Number(process.env.BC_TELEMETRY_PORT || 32146);
const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:32145",
  "http://localhost:32145",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
]);

let telemetry = null;
let latestTelemetry = null;
let connected = false;
let lastUpdateAt = null;
let initError = null;

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function fractionPercent(value) {
  const n = numberOrNull(value);
  return n === null ? null : Math.round(Math.max(0, Math.min(1, n)) * 100);
}
function snapshot() {
  const d = latestTelemetry || telemetry?.data?.current;
  const fresh = connected && lastUpdateAt && Date.now() - lastUpdateAt < 3000;
  if (!d || !fresh || !d.sdkActive) {
    return {
      ok: true,
      connected: false,
      source: null,
      status: initError ? "reader_unavailable" : "not_connected",
      message: initError
        ? "Telemetry reader could not start. Check the desktop installation and telemetry plugin."
        : "Waiting for ATS/ETS2 and a compatible SCS telemetry plugin.",
      valuesAreLive: false,
      updatedAt: lastUpdateAt ? new Date(lastUpdateAt).toISOString() : null,
      error: initError,
      truck: null,
      job: null,
    };
  }
  const game = d.game === 1 ? "ets2" : d.game === 2 ? "ats" : "unknown";
  const capacity = numberOrNull(d.fuelCapacity);
  const fuel = numberOrNull(d.fuel);
  const routeDistance = numberOrNull(d.routeDistance);
  const restStop = numberOrNull(d.restStop);
  const damage = [d.wearEngine, d.wearTransmission, d.wearCabin, d.wearChassis, d.wearWheels]
    .filter(v => typeof v === "number" && Number.isFinite(v));
  const truckDamage = damage.length ? damage.reduce((sum, v) => sum + v, 0) / damage.length : null;
  return {
    ok: true,
    connected: true,
    source: game,
    status: d.paused ? "paused" : "connected",
    message: d.paused ? "Game telemetry is connected; the game is paused." : "Live game telemetry is connected.",
    valuesAreLive: true,
    updatedAt: new Date(lastUpdateAt).toISOString(),
    truck: {
      name: d.truckName || null,
      brand: d.truckBrand || null,
      speedMph: numberOrNull(d.speed) === null ? null : Math.round(d.speed * 2.236936),
      fuelLitres: fuel,
      fuelPercent: fuel !== null && capacity > 0 ? Math.round((fuel / capacity) * 100) : null,
      gear: numberOrNull(d.gearDashboard ?? d.gear),
      engineRpm: numberOrNull(d.engineRpm),
      engineOn: typeof d.engineEnabled === "boolean" ? d.engineEnabled : null,
      truckDamagePercent: truckDamage === null ? null : Math.round(truckDamage * 100),
      cargoDamagePercent: fractionPercent(d.cargoDamage),
      odometerMiles: numberOrNull(d.truckOdometer) === null ? null : Math.round(d.truckOdometer * 0.621371),
      fuelRangeMiles: numberOrNull(d.fuelRange) === null ? null : Math.round(d.fuelRange * 0.621371),
      speedLimitMph: numberOrNull(d.speedLimit) === null ? null : Math.round(d.speedLimit * 2.236936),
    },
    job: {
      active: Boolean(d.onJob),
      cargo: d.cargo || null,
      sourceCity: d.citySrc || null,
      destination: d.cityDst || null,
      destinationCompany: d.compDst || null,
      remainingDistanceMiles: routeDistance === null ? null : Math.round((routeDistance / 1000) * 0.621371),
      deadlineGameMinutes: numberOrNull(d.timeAbsDelivery),
      restMinutes: restStop,
    },
  };
}

function startReader() {
  try {
    const { truckSimTelemetry } = require("trucksim-telemetry");
    telemetry = truckSimTelemetry({
      onUpdate: (data) => {
        if (data && typeof data === "object") latestTelemetry = data;
        else latestTelemetry = telemetry?.data?.current || null;
        lastUpdateAt = Date.now();
      }
    });
    telemetry.on("connected", () => { connected = true; latestTelemetry = telemetry?.data?.current || latestTelemetry; lastUpdateAt = Date.now(); initError = null; });
    telemetry.on("disconnected", () => { connected = false; latestTelemetry = null; });
    // The reader updates the shared-memory snapshot at 60 Hz; use its timestamp
    // only while the plugin is active, and report stale data as disconnected.
  } catch (error) {
    initError = String(error?.message || error).slice(0, 300);
    console.error("BC telemetry reader unavailable:", initError);
  }
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    res.writeHead(403, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ ok: false, error: "Origin not allowed." }));
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (origin && ALLOWED_ORIGINS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  if (req.method !== "GET" || (req.url !== "/status" && req.url !== "/health")) {
    res.writeHead(404);
    return res.end(JSON.stringify({ ok: false, error: "Not found." }));
  }
  res.writeHead(200);
  if (req.url === "/health") {
    return res.end(JSON.stringify({
      ok: true,
      service: "bc-truck-works-telemetry-bridge",
      readerLoaded: Boolean(telemetry),
      connected: Boolean(snapshot().connected),
      status: snapshot().status
    }));
  }
  res.end(JSON.stringify(snapshot()));
});

startReader();
server.listen(PORT, HOST, () => console.log(`BC telemetry bridge listening on http://${HOST}:${PORT}`));
server.on("error", error => {
  initError = String(error?.message || error).slice(0, 300);
  console.error("BC telemetry bridge server error:", initError);
});

function shutdown(signal) {
  console.log(`${signal} received; stopping telemetry bridge.`);
  server.close(() => {
    try { telemetry?.close?.(); } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
