# BC Truck Works Live Companion — Telemetry Integration

## Current status

The deployed Next.js site is a browser dashboard. It does not currently receive live ATS or ETS2 telemetry. Do not label placeholder values as live readings.

## Why a local companion is required

The game runs on the driver's Windows PC, while the website is hosted on Vercel. The hosted website cannot directly read local game files or Windows shared memory. A local companion process must read a supported SCS telemetry plugin and securely provide selected readings to the browser.

SCS's official Telemetry SDK supports third-party telemetry plugins for Euro Truck Simulator 2 and American Truck Simulator. Community implementations include shared-memory plugins, but compatibility must be checked against the installed game and SDK versions.

## Planned architecture

1. **Game plugin:** an SCS-compatible ATS/ETS2 telemetry plugin installed on the player's PC.
2. **Local bridge:** a Windows companion process reads telemetry locally and exposes a narrowly scoped local endpoint.
3. **Browser client:** the Live Companion connects to the local bridge only after the user explicitly enables it and grants permission.
4. **Normalized data:** convert plugin-specific fields into a stable schema, with timestamps and a connected/stale status.
5. **Dashboard:** display real speed, fuel, gear, RPM, truck damage, cargo damage, job destination, remaining distance, and rest information only when relevant fields are present.
6. **Callouts:** trigger voice alerts from real telemetry changes, with thresholds and cooldowns to prevent repeated alerts.

## Security requirements

- Never put private API keys or bridge secrets in client-side JavaScript or a public repository.
- Bind a local bridge to loopback (`127.0.0.1`) by default, not all network interfaces.
- Validate every incoming telemetry field and include a last-updated timestamp.
- Do not accept arbitrary remote commands from a public website.
- Show `Disconnected`, `Connected`, or `Stale` status honestly; never substitute demo values while claiming telemetry is live.
- Handle browser HTTPS, localhost permissions, CORS, and mixed-content restrictions deliberately.
- Keep user account sync or cloud history separate from local telemetry until authentication and privacy rules are implemented.

## Suggested normalized payload

```json
{
  "source": "ats",
  "connected": true,
  "updatedAt": "2026-01-01T12:00:00.000Z",
  "truck": {
    "speedMph": 0,
    "fuelPercent": 0,
    "gear": 0,
    "engineRpm": 0,
    "truckDamagePercent": 0,
    "cargoDamagePercent": 0
  },
  "job": {
    "active": false,
    "destination": null,
    "remainingDistanceMiles": null,
    "deadline": null
  },
  "rest": { "minutesUntilRequired": null }
}
```

This is a proposed app schema, not a direct copy of the SCS plugin's native data structure. Missing values should remain `null`, not be fabricated.

## Validation checklist before calling the integration live

- Test ATS and ETS2 separately on supported game versions.
- Confirm values update while driving and stop updating when the game closes or pauses.
- Confirm units and conversions (m/s to mph, liters/gallons as configured).
- Test stale data, disconnects, game pause, no active job, and damaged cargo.
- Verify the browser can reach the local bridge from the deployed HTTPS site.
- Test voice callouts for thresholds, cooldowns, and disabled settings.

## References

- SCS Telemetry SDK documentation: https://modding.scssoft.com/wiki/Documentation/Engine/SDK/Telemetry
- SCS Software overview of telemetry: https://blog.scssoft.com/2015/02/a-look-on-technical-side-telemetry-sdk.html
- Community shared-memory plugin reference (review compatibility before using): https://github.com/RenCloud/scs-sdk-plugin
