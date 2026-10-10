/**
 * NexusHost / Node-panel startup entry point.
 *
 * Configure the panel to run: node index.js
 * Requires a successful production build before startup (npm run build).
 * The server binds to the host and PORT supplied by the hosting panel.
 */
const next = require("next");
const http = require("http");

const dev = process.env.NODE_ENV === "development";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || process.env.SERVER_PORT || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("Invalid PORT. Set PORT to a number between 1 and 65535.");
  process.exit(1);
}

async function main() {
  const app = next({
    dev,
    hostname,
    port,
    // Keep the runtime predictable on small shared hosts.
    conf: {
      poweredByHeader: false,
      compress: true,
    },
  });
  await app.prepare();
  const handle = app.getRequestHandler();
  const server = http.createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify({ ok: true, service: "bc-truck-works-live-companion" }));
      return;
    }
    handle(req, res);
  });

  server.listen(port, hostname, () => {
    console.log(`BC Truck Works Live Companion listening on http://${hostname}:${port} (NODE_ENV=${process.env.NODE_ENV || "production"})`);
  });

  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.log(`${signal} received; shutting down gracefully.`);
    const forceExit = setTimeout(() => process.exit(1), 8000);
    forceExit.unref();
    server.close(async () => {
      try {
        await app.close();
        clearTimeout(forceExit);
        process.exit(0);
      } catch (error) {
        console.error("Error while closing Next.js:", error);
        process.exit(1);
      }
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("Failed to start BC Truck Works Live Companion:", error);
  process.exit(1);
});
