# Windows Desktop Edition

The desktop package now builds the Next.js dashboard into the installer instead of relying on a hosted dashboard URL. Once packaged, the Electron app starts a local copy of the dashboard bound to `127.0.0.1` and opens it in an isolated desktop window.

## Build on Windows

Install Node.js 20, then run from the repository folder:

```powershell
npm install
npm run desktop:dist
```

The installer is generated in `release/` as `BC-Truck-Works-Companion-Setup-1.0.0.exe` (version may change). The command builds the Next.js standalone output first, then packages it with Electron Builder.

## Build with GitHub Actions

Open **Actions → Build Windows Installer → Run workflow**. On success, download the Windows installer from the workflow run's Artifacts section. The artifact is temporary (14 days); it is not automatically published as a GitHub Release.

## What works in this desktop scaffold

- The bundled dashboard runs locally; it no longer needs the Vercel site to be online.
- Co-driver prompt/chat, browser/device text-to-speech, optional browser speech recognition, voice settings, profiles, and saved preferences are available as implemented in the web dashboard.
- A local health endpoint can verify that the bundled dashboard server started.

## Important limitation: real game telemetry is not implemented yet

This desktop package does **not** currently read ATS or ETS2 live telemetry. The status endpoint intentionally reports `not_connected`; speed, fuel, gear, RPM, destination distance, delivery deadline, fatigue/rest, and automatic telemetry-based callouts must not be shown as live. Making these work requires a compatible SCS telemetry plugin plus a tested local bridge and game-version validation. See [TELEMETRY-INTEGRATION.md](TELEMETRY-INTEGRATION.md).

Before calling this a public release, run the workflow and test installation, launch, local health endpoint, microphone permissions, voice output, and uninstall on a Windows machine. Confirm the installer SHA-256 checksum and document signing status. The installer is not available for download until a successful build is reviewed and published.
