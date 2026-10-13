# BC Truck Works Live Companion

A Next.js 15 / React 19 browser dashboard and optional Windows Electron desktop companion for American Truck Simulator (ATS) and Euro Truck Simulator 2 (ETS2).

## Current features

- Co-driver dashboard, voice-command prompts, alerts/settings, and browser-based controls.
- Optional Electron Windows wrapper with a local-only `trucksim-telemetry` bridge and NSIS installer workflow.
- Phase 1 convoy pages: `/connect-my-game` creates a one-time six-character pairing code; `/convoy` shows driver cards and relative truck positions.
- `POST /api/telemetry` accepts validated telemetry only when a driver token is supplied; `GET /api/convoy` is read-only.
- PWA manifest, service worker, and offline fallback page.

## Run in GitHub Codespaces

This repository includes a development container in `.devcontainer/devcontainer.json`.

1. Open the [Codespaces-ready branch](https://github.com/dospatch/bc-truck-works-live-companion/tree/codespaces-ready).
2. Select **Code → Codespaces → Create codespace on codespaces-ready**.
3. Wait for setup and dependency installation to finish.
4. In the Codespaces terminal, run:

```bash
npm run dev
```

5. Open forwarded port **3000** when prompted.

If dependencies did not install, run `npm install` first. Check the API at `/api/health`.

### Test the four-driver convoy simulator

Keep the development server running in one terminal. In a second terminal, run:

```bash
CONVOY_BASE_URL="http://localhost:3000" node scripts/simulate-convoy.mjs
```

The simulator seeds four fake drivers with one telemetry update each. The API marks data offline after 15 seconds, so rerun the simulator to refresh the feed. Simulator tokens are generated per driver and are not hard-coded.

**Codespaces limitation:** Codespaces can run the dashboard and simulator, but cannot directly read ATS/ETS2 telemetry from a game running on your Windows PC. Real telemetry requires the Windows desktop companion and a compatible game telemetry plugin.

## Local development

Use Node.js 22 or newer.

```bash
npm install
npm run dev
```

## Windows desktop installer

The Windows installer workflow runs on pushes to `main` and tags starting with `v`.

1. Open the [Windows installer workflow](https://github.com/dospatch/bc-truck-works-live-companion/actions/workflows/windows-installer.yml).
2. Open a successful run and download the `BC-Truck-Works-Companion-Windows-Installer` artifact.
3. To build locally on Windows, run:

```powershell
npm install
npm run build
npx electron-builder --win nsis
```

The installer is produced in `release/`. Use GitHub Actions or a Windows PC to build the Windows installer; Codespaces is a Linux environment.

## Environment variables

Copy `.env.example` to `.env.local` for local development. Never commit secret values.

- `UPSTASH_REDIS_REST_URL` — Upstash Redis REST endpoint; recommended for persistent pairing and convoy data.
- `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST token; keep secret.
- `KV_REST_API_URL` — alternative Vercel/Upstash REST endpoint variable name.
- `KV_REST_API_TOKEN` — alternative Vercel/Upstash REST token variable name; keep secret.
- `CONVOY_BASE_URL` — optional simulator target; defaults to `http://localhost:3000`.
- `PORT` — web server port; defaults to `3000`.
- `SERVER_PORT` — fallback web server port for hosting panels.
- `HOSTNAME` — web server bind host.
- `BC_COMPANION_PORT` — Electron local dashboard port.
- `BC_TELEMETRY_PORT` — local telemetry bridge port.
- `NODE_ENV` — Node.js runtime mode.

## Storage and deployment notes

Pairing codes expire after 10 minutes and are single-use. When configured, Redis stores pairing records and per-driver token hashes/server-side driver records. Without Redis variables, the API falls back to process memory. This is suitable only for local development because serverless instances do not share memory and data resets on restart.

Before using hosted multi-driver convoy, configure an Upstash Redis database and add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel for production and any preview environments you intend to test. Redeploy after changing environment variables.

The hosted website cannot directly access telemetry on a driver's computer. The desktop app must make an authenticated outbound HTTPS request to the website after pairing. The current local telemetry bridge remains loopback-only. See the [telemetry integration notes](docs/TELEMETRY-INTEGRATION.md) for SCS plugin prerequisites and validation limits.

## Manual setup still required

Before treating hosted multiplayer telemetry as production-ready:

1. Configure Upstash Redis and redeploy.
2. Install a compatible SCS telemetry SDK plugin for ATS/ETS2 on each driver's PC. The plugin is not bundled or silently installed.
3. Connect and test the Electron pairing input and authenticated outbound telemetry uploader.
4. Implement and test Discord OAuth/member-only access before claiming the site is restricted to authorized Discord members.
5. Test pairing-code expiration and single use, driver-token validation, telemetry uploads, Redis persistence, offline status, and convoy updates end to end with real game telemetry.
6. Build and test the Windows installer on a Windows PC with ATS or ETS2 before publishing it as release-ready.

## Optional telemetry overlay (development branch)

The `/overlay` route and **Ctrl+Shift+O** desktop shortcut belong to the `feature/ats-ets2-live-telemetry` development branch. Unless that branch has been merged, the overlay is not included in `main` or the published installer. A Windows build and in-game validation are required before calling it release-ready.

## Project links

- [GitHub repository](https://github.com/dospatch/bc-truck-works-live-companion)
- [Codespaces-ready branch](https://github.com/dospatch/bc-truck-works-live-companion/tree/codespaces-ready)
- [Windows installer workflow](https://github.com/dospatch/bc-truck-works-live-companion/actions/workflows/windows-installer.yml)
- [Telemetry integration notes](docs/TELEMETRY-INTEGRATION.md)
