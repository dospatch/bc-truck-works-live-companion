import { NextResponse } from "next/server";
import { listDrivers } from "../../../lib/convoy-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const now = Date.now();
    const drivers = (await listDrivers()).map((driver) => {
      const t = driver.telemetry;
      const age = t ? now - t.updatedAt : Infinity;
      const status = age > 15000 ? "Offline" : t?.driving ? "Driving" : "Stopped";
      const damageValues = [t?.engineWear,t?.transmissionWear,t?.cabinWear,t?.chassisWear,t?.wheelWear,t?.cargoWear].filter(v => typeof v === "number");
      const damage = damageValues.length ? Math.round(Math.max(...damageValues) * 100) : null;
      return {
        id: driver.id, name: driver.name, status, lastSeenAt: driver.updatedAt,
        speedMph: t?.speedKmh == null ? null : Math.round(t.speedKmh * 0.621371),
        speedLimitMph: t?.speedLimitKmh == null ? null : Math.round(t.speedLimitKmh * 0.621371),
        route: [t?.sourceCity, t?.destinationCity].filter(Boolean).join(" → ") || "Route unavailable",
        cargo: t?.cargo || "No cargo reported",
        distanceMiles: t?.navigationDistanceKm == null ? null : Math.round(t.navigationDistanceKm * 0.621371),
        etaMinutes: t?.etaMinutes ?? null,
        fuelPercent: t?.fuelCapacity > 0 && t?.fuel != null ? Math.round(Math.min(100, t.fuel / t.fuelCapacity * 100)) : null,
        damagePercent: damage, placement: t?.placement || { x: null, z: null },
      };
    });
    return NextResponse.json({ drivers, updatedAt: now }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ error: "Convoy storage unavailable." }, { status: 503 });
  }
}
