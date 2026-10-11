# ATS / ETS2 Live Telemetry Integration Roadmap

This document tracks the implementation plan for adding simulator telemetry to BC Truck Works Live Companion without replacing the existing dashboard or desktop installer.

## Goals

- Support American Truck Simulator (ATS) and Euro Truck Simulator 2 (ETS2).
- Preserve the current browser dashboard, configurable co-driver callouts, and Windows desktop packaging.
- Add an optional compact overlay that can remain visible while the simulator runs.
- Keep telemetry processing local to the player's PC. Do not require Vercel or a cloud service for live in-game telemetry.
- Treat unavailable values as unknown instead of inventing or displaying stale readings as live.

## Architecture

1. **Simulator telemetry source** — use the official SCS telemetry SDK/plugin interface or a compatible, maintained implementation. Confirm the SDK's current license, supported game versions, and distribution requirements before bundling anything.
2. **Local telemetry bridge** — a Windows-side component receives simulator data and exposes a documented, loopback-only interface to the companion app. It must validate input, bind to localhost only, and report connection/staleness state.
3. **Shared telemetry model** — normalize the supported ATS and ETS2 fields into one versioned schema. Keep game-specific fields optional.
4. **Dashboard and overlay** — both views consume the same local telemetry model. The overlay is an optional Electron window with transparent/compact presentation and always-on-top behavior; it must not claim to be an in-game injected HUD.
5. **Packaging and install** — include only components whose licensing and build process are verified. Provide a clean install/uninstall path and keep the existing desktop installer workflow working.

## Phased implementation

### Phase 1 — Repository and compatibility review
- Inspect current package scripts, Electron entry points, dashboard components, and GitHub Actions.
- Confirm the existing default branch and preserve the current app behavior.
- Record the actual installed game locations and Windows build-tool availability when the developer PC is available.

### Phase 2 — Telemetry contract and simulator detection
- Define a versioned telemetry shape for game name, connection state, last-update timestamp, speed, fuel, engine state, truck damage, cargo, and trip data where provided by the SDK.
- Add explicit disconnected, connecting, live, and stale states.
- Detect ATS and ETS2 independently; do not assume both are installed.

### Phase 3 — Local bridge
- Implement and test the local receiver after selecting and verifying the telemetry SDK/plugin transport.
- Bind only to loopback; reject unexpected origins/requests and avoid exposing telemetry publicly.
- Add health and diagnostic output without logging sensitive information.

### Phase 4 — Dashboard and overlay
- Replace placeholder telemetry values only when backed by live data.
- Add an optional compact Electron overlay with adjustable size, opacity, and always-on-top toggle.
- Keep a clear demo/test mode separate from live simulator status.

### Phase 5 — Validation and release
- Test no-game, game-launch, game-exit, stale-data, unsupported-version, and missing-plugin cases.
- Build the Windows installer in GitHub Actions and inspect the artifact before publishing.
- Document installation, troubleshooting, supported versions, and uninstall steps.

## Acceptance criteria

- No telemetry is labelled live unless it has a recent update from the selected simulator.
- ATS and ETS2 are independently detected and their available fields are normalized.
- Closing the game or bridge returns the UI to a clear disconnected state.
- The existing dashboard and desktop installer continue to build.
- The overlay is optional and can be closed without stopping the main companion app.
- No SDK/plugin binary is redistributed until its license and packaging requirements are checked.

## Current status

Planning and repository branch are in place. The native telemetry bridge and overlay are **not implemented yet**; they require verification of the SDK transport and Windows build/test environment.
