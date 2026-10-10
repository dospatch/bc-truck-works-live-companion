# BC Truck Works Live Companion

A browser dashboard and optional Windows desktop wrapper for a configurable co-driver experience.

## Build the Windows desktop installer

The Windows installer is built by GitHub Actions on pushes to `main` and when manually dispatched.

1. Open the [Windows installer workflow](https://github.com/dospatch/bc-truck-works-live-companion/actions/workflows/windows-installer.yml).
2. Open the latest successful run.
3. Download the `BC-Truck-Works-Companion-Windows-Installer` artifact.

The artifact is a temporary Actions download and expires according to GitHub's artifact retention period. Create a version tag to publish a GitHub Release installer when release publishing is enabled.

For local Windows builds, use Node.js 22 and run:

```powershell
npm install
npm run build
npx electron-builder --win nsis
```

The installer is produced in `release/`.

## Telemetry status

The hosted website can show website availability, but it cannot directly access a game's local telemetry feed. Real ATS/ETS2 readings require the Windows desktop companion, a supported SCS telemetry plugin, and the local telemetry bridge. The dashboard intentionally shows unavailable values rather than inventing live speed, fuel, route, or alert data.

See [telemetry integration notes](docs/TELEMETRY-INTEGRATION.md) before testing in-game.
