# BC Truck Works Live Companion

**Drive · Build · Succeed.** A co-driver companion for American Truck Simulator (ATS), Euro Truck Simulator 2 (ETS2), and the wider trucking community.

## Get BC Truck Works

**Windows installer: not published yet.** A real, tested Windows installer will be attached to the repository's GitHub Releases when the desktop package and local telemetry bridge are ready.

- **Releases/downloads:** https://github.com/dospatch/bc-truck-works-live-companion/releases
- **Source code:** https://github.com/dospatch/bc-truck-works-live-companion
- **Telemetry integration notes:** [docs/TELEMETRY-INTEGRATION.md](docs/TELEMETRY-INTEGRATION.md)
- **Windows packaging checklist:** [docs/WINDOWS-RELEASES.md](docs/WINDOWS-RELEASES.md)

Do not download an installer from an unofficial mirror. No BC Truck Works installer is available from this repository until a release asset is published here.

## Current V1

The current web dashboard includes:

- Co-driver chat with driving-related prompt shortcuts
- Browser text-to-speech, optional microphone input, and voice controls
- Selectable co-driver personalities
- Customizable callout preferences
- ATS, ETS2, and custom app profiles
- Browser-saved preferences
- A visible telemetry connection status

**Important:** the current dashboard is a browser V1. It does not yet read live game telemetry. Speed, fuel, destination distance, job deadline, rest planning, eco score, and automatic driving alerts remain unavailable until a compatible telemetry bridge is implemented and connected. Co-driver responses are rule-based, not a connected cloud AI service.

## Windows desktop edition

The Electron desktop package is configured to bundle the Next.js dashboard and run it locally, so the desktop dashboard does not depend on the hosted site being online. See [Desktop Edition setup and limitations](docs/DESKTOP-EDITION.md). GitHub Actions can build a Windows setup executable and upload it as a temporary workflow artifact.

**Important:** real ATS/ETS2 telemetry is still not connected. The current status endpoint deliberately reports `not_connected`; the desktop wrapper alone cannot read game telemetry. The installer has not yet been built and tested on Windows. The Releases page remains the official place for public downloads.

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
