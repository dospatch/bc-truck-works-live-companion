# Live ATS / ETS2 Telemetry — Desktop Bridge

## What is implemented

The Windows desktop app now starts a loopback-only telemetry bridge at http://127.0.0.1:32146/status. It uses the open-source trucksim-telemetry Node native addon to read the SCS SDK shared-memory stream, then exposes a small, normalized, read-only JSON response. The desktop dashboard polls this bridge and displays live speed, fuel, route distance, gear, RPM, truck/cargo wear, odometer, destination and rest-stop values when the reader reports active data.

The bridge is deliberately local-only. It binds to 127.0.0.1, allows only the desktop dashboard/dev origins, exposes only GET/OPTIONS, and has no remote control endpoint. A hosted HTTPS website cannot read this local service; live telemetry is a desktop feature.

## Prerequisites

- Windows 10/11 x64.
- American Truck Simulator or Euro Truck Simulator 2.
- An SCS telemetry SDK plugin installed for the correct game and compatible with the installed game version.
- The desktop companion build with the native trucksim-telemetry dependency included.

The reader package documents support for SCS SDK plugin revision 1.12.1 and requires Node.js 22 or newer for development. The current plugin source and game versions must be checked before declaring a given ATS/ETS2 version supported. A telemetry plugin is a separate component; it is not silently installed by the app.

## Install the game telemetry plugin

1. Close ATS/ETS2 and the companion.
2. Obtain a trusted x64 Windows build of the SCS SDK telemetry plugin from the upstream project: https://github.com/RenCloud/scs-sdk-plugin
3. Check that the plugin release explicitly supports your installed game version. Do not assume an older plugin release supports the latest game patch.
4. Extract the plugin DLL and its required files from the trusted release archive.
5. Copy the plugin into the correct game's bin/win_x64/plugins directory. For example:
   - ATS: <American Truck Simulator install>\\bin\\win_x64\\plugins\\
   - ETS2: <Euro Truck Simulator 2 install>\\bin\\win_x64\\plugins\\
6. If the plugins folder is absent, create it. Do not overwrite unrelated files.
7. Launch the game and confirm the game/plugin reports that telemetry is active, if the plugin release provides such a confirmation.
8. Launch BC Truck Works Live Companion. Start driving or load a profile, then look for LIVE TELEMETRY in the dashboard status.

Only install a plugin from a trusted upstream release. Do not disable antivirus or Windows Security.

## Development and packaging

The native telemetry addon is a runtime dependency. Use Node.js 22+ and a Windows build environment with the required C++ build tools available to compile native modules. Electron packaging must rebuild native dependencies for the Electron ABI; a successful Next.js build alone does not validate the native reader.

```powershell
npm install
npm run build
npx electron-builder --win nsis
```

## Honest status behavior

- connected: true is reported only when the reader reports the SDK active and updates remain fresh.
- Missing values stay null; the dashboard must not substitute demo numbers.
- If the game is closed, the plugin is missing/incompatible, or the reader is stale, the bridge reports disconnected.
- Fuel percent and route distance are converted from the SDK's litres/metres and m/s units.
- Eco score and automatic alert rules are not implemented yet. They are explicitly shown as unavailable instead of fabricated.

## Validation still required

The current code is a first bridge implementation. It still needs end-to-end testing on a real Windows PC with current ATS and ETS2 builds, including confirmation that the selected plugin's SDK revision matches the native reader. Validate live updates, game pause/exit, missing plugin, stale data, and app shutdown before advertising telemetry as production-ready.

## References

- SCS Telemetry SDK: https://modding.scssoft.com/wiki/Documentation/Engine/SDK/Telemetry
- Reader package and compatibility notes: https://github.com/kniffen/TruckSim-Telemetry
- Shared-memory plugin: https://github.com/RenCloud/scs-sdk-plugin
