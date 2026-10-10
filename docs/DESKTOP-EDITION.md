# Windows Desktop Edition (Initial Scaffold)

This repository now includes an Electron desktop wrapper and a Windows installer build workflow.

## What this first desktop scaffold does

- Packages the companion into a Windows NSIS setup executable.
- Provides a desktop window, Start-menu shortcut, and uninstall support.
- Loads the hosted web dashboard in an isolated Electron window.
- Opens external links in the user's normal browser.
- Produces a GitHub Actions artifact when the workflow is run.

## Important current limitations

This is a desktop wrapper around the web dashboard, not yet a fully offline bundled app. It needs the dashboard URL to be deployed and reachable. The current default is `https://bc-truck-works-live-companion.vercel.app`; change `BC_COMPANION_URL` in `electron/main.cjs` if the actual Vercel deployment uses a different domain.

This scaffold does **not** include a local ATS/ETS2 telemetry bridge and does not make the existing placeholder telemetry status live. Do not advertise telemetry, speed/fuel/job data, or automatic alerts as working until the local bridge is implemented and tested with the games.

## Build locally on Windows

Install Node.js 20 and Git, then run:

```powershell
npm ci
npm run desktop:dist
```

The setup executable should be generated under `release/`.

## Build in GitHub Actions

Open the repository's **Actions** tab, select **Build Windows Installer**, and choose **Run workflow**. The resulting installer is uploaded as a workflow artifact for 14 days. A tagged release (for example, `v1.0.0`) also triggers a build, but this workflow does not automatically publish a GitHub Release.

Before public release, verify the URL, install/uninstall behavior, Windows Security reputation, and that all dashboard functions work inside Electron. A production installer should be code-signed when a certificate is available.
