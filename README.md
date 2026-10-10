# BC Truck Works Live Companion

**Drive · Build · Succeed.** A co-driver companion for American Truck Simulator (ATS), Euro Truck Simulator 2 (ETS2), and the wider trucking community.

## Open BC Truck Works

- **Live website:** https://bctruckworks.vercel.app/
- **GitHub source code:** https://github.com/dospatch/bc-truck-works-live-companion
- **Releases and public downloads:** https://github.com/dospatch/bc-truck-works-live-companion/releases
- **Telemetry integration notes:** [docs/TELEMETRY-INTEGRATION.md](docs/TELEMETRY-INTEGRATION.md)
- **Windows packaging checklist:** [docs/WINDOWS-RELEASES.md](docs/WINDOWS-RELEASES.md)
- **Release publishing checklist:** [docs/PUBLISHING-RELEASES.md](docs/PUBLISHING-RELEASES.md)

Do not download an installer from an unofficial mirror. No BC Truck Works installer is available for public download until a release asset is published on the official Releases page.

## Current V1

The current web dashboard includes:

- Co-driver chat with driving-related prompt shortcuts
- Browser text-to-speech, optional microphone input, and voice controls
- Selectable co-driver personalities
- Customizable callout preferences
- ATS, ETS2, and custom app profiles
- Browser-saved preferences
- A visible telemetry connection status

**Important:** the current dashboard is a browser V1. The desktop edition includes an initial local SCS telemetry bridge implementation, but it has not yet been tested end-to-end on a real Windows PC. Live readings require a compatible game telemetry plugin. Eco score and automatic driving alert rules remain unavailable. Co-driver responses are rule-based, not a connected cloud AI service.

## Windows desktop edition

The Electron desktop package is configured to bundle the Next.js dashboard and run it locally, so the desktop dashboard does not depend on the hosted site being online. See [Desktop Edition setup and limitations](docs/DESKTOP-EDITION.md).

GitHub Actions has built a Windows setup executable and uploaded it as a temporary workflow artifact. New pushes rebuild it, and version tags are configured to publish release assets automatically after the workflow succeeds.

**Important:** the local telemetry bridge has not yet been validated on a real Windows PC. The hosted website cannot directly read local game data; telemetry is a desktop-only feature and requires a compatible SCS plugin. The installer has not yet been tested end-to-end on a real Windows PC. The Releases page remains the official place for public downloads.

## Safety and project status

- This is an independent community project and is not affiliated with or endorsed by SCS Software.
- Do not disable Windows Security or antivirus to install unofficial software.
- For each published installer, release notes should include the version, supported Windows/game versions, known limitations, and a SHA-256 checksum.
- An unsigned installer may trigger Windows SmartScreen or browser reputation warnings. Signing status will be stated in the release notes.

## Development

This repository currently contains a Next.js web app.

```powershell
npm install
npm run dev
```

Open http://localhost:3000 in your browser. See the telemetry integration notes before attempting to connect game data.
