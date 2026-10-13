# BC Truck Works Live Companion

A Next.js 15 / React 19 browser dashboard and optional Windows Electron desktop companion for ATS and ETS2.

## Current features

- Existing co-driver dashboard, voice-command prompts, alerts/settings, and browser-based controls.
- Electron Windows wrapper with a local-only `trucksim-telemetry` bridge and NSIS installer workflow.
- Phase 1 convoy pages: `/connect-my-game` creates a one-time 6-character pairing code; `/convoy` shows live driver cards and relative truck positions.
- `POST /api/telemetry` accepts validated telemetry only when a driver token is supplied; `GET /api/convoy` is read-only.
- PWA manifest, service worker and offline fallback page.

## Windows desktop installer

The Windows installer is built by GitHub Actions on pushes to `main` and tags starting with `v`.

1. Open the [Windows installer workflow](https://github.com/dospatch/bc-truck-works-live-companion/actions/workflows/windows-installer.yml).
2. Open the latest successful run and download `BC-Truck-Works-Companion-Windows-Installer`.
3. For local Windows builds, use Node.js 22+ and run:

```powershell
npm install
npm run build
npx electron-builder --win nsis
```

The installer is produced in `release/`.

## Local development

```powershell
npm install
npm run dev
```

For the four-driver convoy simulator, run the site in one terminal, then:

```powershell
$env:CONVOY_BASE_URL="http://localhost:3000"
node scripts/simulate-convoy.mjs
```

The simulator seeds four fake drivers with one telemetry update each. Since the API marks data offline after 15 seconds, repeat the command to refresh the simulated feed while testing. Simulator tokens are generated per driver and are not hard-coded.

## Environment variables

Names only; never commit values:

- `UPSTASH_REDIS_REST_URL` — Upstash Redis REST endpoint (recommended for persistent pairing and convoy data).
- `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST token.
- `KV_REST_API_URL` — alternative Vercel/Upstash REST endpoint name.
- `KV_REST_API_TOKEN` — alternative Vercel/Upstash REST token name.
- `CONVOY_BASE_URL` — optional simulator target URL; defaults to `http://localhost:3000`.
- `PORT` — web server port (defaults to `3000`).
- `SERVER_PORT` — fallback web server port for hosting panels.
- `HOSTNAME` — web server bind host.
- `BC_COMPANION_PORT` — Electron local dashboard port.
- `BC_TELEMETRY_PORT` — local telemetry bridge port.
- `NODE_ENV` — Node.js runtime mode.

## Storage and deployment notes

Pairing codes expire after 10 minutes and are single-use. Redis stores pairing records and per-driver token hashes/server-side driver records. If Redis variables are absent, the API falls back to process memory; that is only suitable for local development because serverless instances do not share memory and it resets on restart. Configure Upstash before using hosted multi-driver convoy.

The hosted website cannot directly access local game telemetry. The desktop app must make an authenticated outbound HTTPS request to the website after pairing. The current local bridge remains loopback-only. Review [telemetry integration notes](docs/TELEMETRY-INTEGRATION.md) for the SCS plugin prerequisites and validation limits.

## Manual setup still required

1. Create an Upstash Redis database and add the two Upstash variables above to Vercel for the production deployment and any preview environment you want to test.
2. Redeploy after changing Vercel environment variables.
3. Install a compatible SCS telemetry SDK plugin for ATS/ETS2 on each driver's PC; the game plugin is not bundled or silently installed.
4. Pairing and convoy endpoints are ready for server-side token storage, but Discord OAuth/member-only access and the Electron pairing input/outbound uploader must be wired and end-to-end tested before describing the entire pairing workflow as complete.
