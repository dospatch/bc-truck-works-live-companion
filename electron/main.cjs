const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");
const http = require("http");

let serverProcess;
let telemetryProcess;
const PORT = Number(process.env.BC_COMPANION_PORT || 32145);
const URL = `http://127.0.0.1:${PORT}`;

function waitForServer(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      const req = http.get(URL + "/api/health", res => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve();
        retry();
      });
      req.setTimeout(1000, () => req.destroy());
      req.on("error", retry);
      function retry() {
        if (Date.now() - started > timeoutMs) return reject(new Error("Local dashboard server did not start."));
        setTimeout(poll, 400);
      }
    };
    poll();
  });
}

function startTelemetryBridge() {
  const bridge = path.join(__dirname, "telemetry-bridge.cjs");
  telemetryProcess = fork(bridge, [], {
    cwd: __dirname,
    execPath: process.execPath,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", BC_TELEMETRY_PORT: "32146", NODE_ENV: "production" },
    stdio: "ignore"
  });
  telemetryProcess.on("error", err => console.error("Telemetry bridge error:", err));
}

function startLocalDashboard() {
  const resources = process.resourcesPath || __dirname;
  const bundledServer = path.join(resources, "app", "server.js");
  if (!fs.existsSync(bundledServer)) throw new Error("Bundled dashboard server is missing: " + bundledServer);
  serverProcess = fork(bundledServer, [], {
    cwd: path.dirname(bundledServer),
    execPath: process.execPath,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: String(PORT), HOSTNAME: "127.0.0.1", NODE_ENV: "production" },
    stdio: "ignore"
  });
  serverProcess.on("error", err => console.error("Dashboard server error:", err));
  return waitForServer();
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 940, minWidth: 980, minHeight: 680,
    title: "BC Truck Works Live Companion", backgroundColor: "#0b1118",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
    return { action: "deny" };
  });
  try {
    startTelemetryBridge();
    await startLocalDashboard();
    await win.loadURL(URL);
  } catch (err) {
    console.error(err);
    await win.loadFile(path.join(__dirname, "startup-error.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("before-quit", () => { if (serverProcess && !serverProcess.killed) serverProcess.kill(); if (telemetryProcess && !telemetryProcess.killed) telemetryProcess.kill(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
