# Windows Installer and Release Checklist

This document describes the release requirements for a KAW-style BC Truck Works Companion download page. It is a build checklist, not proof that an installer currently exists.

## Release assets

A public GitHub Release should include:

- `BC-Truck-Works-Companion-Setup-vX.Y.Z.exe` — the actual tested installer
- `SHA256SUMS.txt` — SHA-256 checksum for the installer
- Release notes listing the app version, supported Windows version, supported ATS/ETS2 versions, installation steps, and known limitations

Publish assets only after the Windows installer has been built and tested. Never add a placeholder or renamed file pretending to be an installer.

## Installer acceptance checklist

- [ ] Installs to a normal local Windows drive and creates a Start menu shortcut
- [ ] Provides a working uninstaller
- [ ] Does not require players to install Node.js, Python, npm, Visual Studio, or PM2 manually
- [ ] Starts without administrator privileges unless a specific, documented requirement makes elevation necessary
- [ ] Clearly displays telemetry disconnected, connected, and error states
- [ ] Does not show mock values as live readings
- [ ] Includes the approved telemetry bridge/plugin and its license notices, if redistribution is permitted
- [ ] Verifies the bridge communicates only with the local companion and exposes only required telemetry fields
- [ ] Handles the game not running, the bridge missing, stale data, and game shutdown without crashing
- [ ] Has been tested on a clean Windows user account and with Windows Security enabled
- [ ] Generates a SHA-256 checksum after the final installer is built
- [ ] Documents whether the installer is code-signed

## Required implementation work before the first public installer

1. Choose a desktop packaging approach and make the dashboard run reliably inside it.
2. Implement a Windows-local ATS/ETS2 telemetry bridge using a compatible telemetry source and confirm redistribution rights.
3. Define and validate a local telemetry schema, connection health checks, and stale-data handling.
4. Connect dashboard metrics and callouts to validated live readings.
5. Build the Windows installer in a clean Windows environment, test install/update/uninstall, and publish it as a GitHub Release asset.

## Safety guidance

Do not instruct users to turn off antivirus. If an unsigned first build triggers SmartScreen, explain the reason plainly and provide a checksum so users can verify that the downloaded file matches the published release. A checksum proves file integrity, not that software is safe or trustworthy.
