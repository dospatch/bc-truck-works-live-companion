const { app, BrowserWindow, shell, utilityProcess } = require("electron");
const path = require("path");
const fs = require("fs");
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
  // Packaged builds keep executable child-process scripts outside app.asar.
  // This avoids trying to launch a script from Electron's virtual archive path.
  const resources = process.resourcesPath || __dirname;
  const bridgeCandidates = app.isPackaged
    ? [path.join(resources, "telemetry", "telemetry-bridge.cjs")]
    : [path.join(__dirname, "telemetry-bridge.cjs"), path.join(resources, "telemetry", "telemetry-bridge.cjs")];
  const bridge = bridgeCandidates.find(candidate => fs.existsSync(candidate));
  log("Telemetry bridge candidates:", bridgeCandidates.join(" | "));
  if (!bridge) throw new Error("Telemetry bridge file is missing. Checked: " + bridgeCandidates.join(" | "));
  const telemetryModules = path.join(resources, "telemetry", "node_modules");
  const dashboardModules = path.join(resources, "app", "node_modules");
  const nodePath = [telemetryModules, dashboardModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  log("Starting telemetry bridge:", bridge);
  log("Telemetry module search path:", nodePath);
  telemetryProcess = utilityProcess.fork(bridge, [], {
    cwd: path.dirname(bridge),
    env: { ...process.env, NODE_PATH: nodePath, BC_TELEMETRY_PORT: "32146", BC_USER_DATA_DIR: app.getPath("userData"), NODE_ENV: "production" },
    stdio: "pipe",
    serviceName: "BC Truck Works Telemetry Bridge"
  });
  attachChildLogs(telemetryProcess, "telemetry");
}

function startLocalDashboard() {
  const resources = process.resourcesPath || __dirname;
  // Packaged builds use the standalone Next.js runtime copied to resources/app.
  // Development runs use the generated standalone runtime inside the repository.
  const candidates = app.isPackaged
    ? [path.join(resources, "app", "server.js")]
    : [path.join(__dirname, "..", ".next", "standalone", "server.js"), path.join(resources, "app", "server.js")];
  const bundledServer = candidates.find(candidate => fs.existsSync(candidate));
  log("Dashboard server candidates:", candidates.join(" | "));
  log("Resources path:", resources);
  if (!bundledServer) throw new Error("Next.js standalone server is missing. Run npm run build and verify .next/standalone/server.js exists.");
  const dashboardDir = path.dirname(bundledServer);
  const nodeModules = path.join(dashboardDir, "node_modules");
  if (!fs.existsSync(path.join(nodeModules, "next", "package.json"))) {
    throw new Error("Next.js runtime dependency is missing from " + nodeModules + ". Rebuild the standalone dashboard and installer.");
  }
  log("Starting dashboard server:", bundledServer);
  serverProcess = utilityProcess.fork(bundledServer, [], {
    cwd: dashboardDir,
    env: { ...process.env, NODE_PATH: [nodeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter), PORT: String(PORT), HOSTNAME: "127.0.0.1", NODE_ENV: "production" },
    stdio: "pipe",
    serviceName: "BC Truck Works Dashboard Server"
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
