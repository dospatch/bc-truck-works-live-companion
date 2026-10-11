const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");
const http = require("http");

let serverProcess;
let telemetryProcess;
let logStream;
const PORT = Number(process.env.BC_COMPANION_PORT || 32145);
const URL = `http://127.0.0.1:${PORT}`;

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(v => v instanceof Error ? (v.stack || v.message) : String(v)).join(" ")}\n`;
  try { logStream?.write(line); } catch {}
  console.log(...args);
}

function attachChildLogs(child, label) {
  child.stdout?.on("data", chunk => log(`[${label}:stdout]`, chunk.toString().trimEnd()));
  child.stderr?.on("data", chunk => log(`[${label}:stderr]`, chunk.toString().trimEnd()));
  child.on("error", err => log(`[${label}:error]`, err));
  child.on("exit", (code, signal) => log(`[${label}:exit]`, `code=${code}`, `signal=${signal}`));
}

function waitForServer(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let settled = false;
    const poll = () => {
      if (settled) return;
      const req = http.get(URL + "/api/health", res => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          settled = true;
          log("Dashboard health check succeeded with HTTP", res.statusCode);
          return resolve();
        }
        retry();
      });
      req.setTimeout(1000, () => req.destroy());
      req.on("error", retry);
      function retry() {
        if (settled) return;
        if (Date.now() - started > timeoutMs) {
          settled = true;
          return reject(new Error("Local dashboard server did not start within " + timeoutMs + "ms."));
        }
        setTimeout(poll, 400);
      }
    };
    poll();
  });
}

function startTelemetryBridge() {
  const bridge = path.join(__dirname, "telemetry-bridge.cjs");
  log("Starting telemetry bridge:", bridge);
  if (!fs.existsSync(bridge)) throw new Error("Telemetry bridge file is missing: " + bridge);
  telemetryProcess = fork(bridge, [], {
    cwd: __dirname,
    execPath: process.execPath,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", BC_TELEMETRY_PORT: "32146", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe", "ipc"]
  });
  attachChildLogs(telemetryProcess, "telemetry");
}

function startLocalDashboard() {
  const resources = process.resourcesPath || __dirname;
  const bundledServer = path.join(resources, "app", "server.js");
  log("Starting dashboard server:", bundledServer);
  log("Resources path:", resources);
  if (!fs.existsSync(bundledServer)) throw new Error("Bundled dashboard server is missing: " + bundledServer);
  serverProcess = fork(bundledServer, [], {
    cwd: path.dirname(bundledServer),
    execPath: process.execPath,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: String(PORT), HOSTNAME: "127.0.0.1", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe", "ipc"]
  });
  attachChildLogs(serverProcess, "dashboard");
  return waitForServer();
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 940, minWidth: 980, minHeight: 680,
    title: "BC Truck Works Live Companion", backgroundColor: "#0b1118",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.webContents.on("did-fail-load", (_event, code, description, validatedURL) => {
    log("Window failed to load:", code, description, validatedURL);
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    log("Renderer process exited:", JSON.stringify(details));
  });
  win.webContents.on("console-message", (_event, details) => {
    log("Renderer console:", details.message);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
    return { action: "deny" };
  });
  try {
    startTelemetryBridge();
    await startLocalDashboard();
    log("Loading dashboard URL:", URL);
    await win.loadURL(URL);
    log("Dashboard loaded.");
  } catch (err) {
    log("Startup failed:", err);
    try {
      await win.loadFile(path.join(__dirname, "startup-error.html"));
    } catch (loadErr) {
      log("Could not load startup error page:", loadErr);
    }
  }
}

app.whenReady().then(() => {
  try {
    const logPath = path.join(app.getPath("userData"), "startup.log");
    logStream = fs.createWriteStream(logPath, { flags: "a" });
    log("=== BC Truck Works Companion starting ===");
    log("App version:", app.getVersion());
    log("Executable:", process.execPath);
    log("App path:", app.getAppPath());
    log("Resources path:", process.resourcesPath);
    log("Log file:", logPath);
  } catch (err) {
    console.error("Could not initialize startup log:", err);
  }
  createWindow().catch(err => log("Window startup rejected:", err));
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow().catch(err => log("Window startup rejected:", err)); });
});
process.on("uncaughtException", err => log("Uncaught exception:", err));
process.on("unhandledRejection", reason => log("Unhandled rejection:", reason));
app.on("before-quit", () => {
  log("Application quitting.");
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
  if (telemetryProcess && !telemetryProcess.killed) telemetryProcess.kill();
  try { logStream?.end(); } catch {}
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
