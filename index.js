const next = require("next");
const http = require("http");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || process.env.SERVER_PORT || 3000);

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = http.createServer((req, res) => handle(req, res));

  server.listen(port, hostname, () => {
    console.log(`BC Truck Works Live Companion listening on http://${hostname}:${port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received; shutting down BC Truck Works Live Companion.`);
    server.close(() => {
      app.close().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("Failed to start BC Truck Works Live Companion:", error);
  process.exit(1);
});
