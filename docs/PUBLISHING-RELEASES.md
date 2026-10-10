# Publishing a Windows Release

The Windows installer is built by GitHub Actions. A normal push to `main` creates a temporary workflow artifact for validation; these artifacts expire after 14 days and are not a permanent public download.

## Create a public release

1. Confirm the current `main` branch builds successfully in Actions.
2. Confirm the desktop app has been tested on a Windows PC. Do not publish a build as stable solely because CI completed.
3. Create and push a version tag, for example `v1.0.1`.
4. The **Build Windows Installer** workflow will build the installer, calculate its SHA-256 checksum, and publish both files to GitHub Releases.
5. Open the release page and verify the setup executable and `.sha256` file are attached.

The release workflow uses the repository's built-in `GITHUB_TOKEN`; no personal access token should be added as a secret for this purpose.

## Test checklist before a stable release

- Install on a clean supported Windows 10/11 PC.
- Launch the app from the Start menu and desktop shortcut.
- Confirm the dashboard opens without the hosted website being available.
- Close and reopen the app; verify its local server exits and starts correctly.
- Verify browser speech features work on the target Windows environment.
- Confirm telemetry clearly remains disconnected until a compatible local bridge and game plugin are installed.
- Check uninstall behavior and that user preferences are not unexpectedly removed.
- Compare the downloaded installer SHA-256 with the published checksum.

## Current limitation

CI has successfully packaged the Windows setup executable, but CI packaging is not the same as a full end-to-end test on a real Windows desktop. The app does not yet receive live ATS/ETS2 telemetry. Do not advertise telemetry or the installer as fully tested until both are validated.
