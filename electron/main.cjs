const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const COMPANION_URL = process.env.BC_COMPANION_URL || "https://bc-truck-works-live-companion.vercel.app";
function createWindow() {
  const win = new BrowserWindow({ width: 1440, height: 940, minWidth: 980, minHeight: 680, title: "BC Truck Works Live Companion", backgroundColor: "#0b1118", autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url); return { action: "deny" }; });
  win.loadURL(COMPANION_URL).catch(() => win.loadFile(path.join(__dirname, "startup-error.html")));
}
app.whenReady().then(() => { createWindow(); app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
