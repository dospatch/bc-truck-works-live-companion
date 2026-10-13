import { NextResponse } from "next/server";
import { findDriverByToken, saveTelemetry } from "../../../lib/convoy-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const clamp = (value, min, max) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : null;
const str = (value, max = 80) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : null;
const wear = (value) => clamp(value, 0, 1);
function validate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const placement = input.placement && typeof input.placement === "object" ? input.placement : {};
  return {
    speedKmh: clamp(input.speedKmh, 0, 300),
    speedLimitKmh: clamp(input.speedLimitKmh, 0, 200),
    fuel: clamp(input.fuel, 0, 5000),
    fuelCapacity: clamp(input.fuelCapacity, 0, 5000),
    engineWear: wear(input.engineWear), transmissionWear: wear(input.transmissionWear),
    cabinWear: wear(input.cabinWear), chassisWear: wear(input.chassisWear),
    wheelWear: wear(input.wheelWear), cargoWear: wear(input.cargoWear),
    sourceCity: str(input.sourceCity), destinationCity: str(input.destinationCity),
    cargo: str(input.cargo, 120), navigationDistanceKm: clamp(input.navigationDistanceKm, 0, 100000),
    etaMinutes: clamp(input.etaMinutes, 0, 100000),
    placement: { x: clamp(placement.x, -10000000, 10000000), z: clamp(placement.z, -10000000, 10000000) },
    driving: typeof input.driving === "boolean" ? input.driving : null,
    updatedAt: Date.now(),
  };
}
export async function POST(request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("x-driver-token");
  if (!token || token.length > 256) return NextResponse.json({ error: "Driver token required." }, { status: 401 });
  try {
    const driver = await findDriverByToken(token);
    if (!driver) return NextResponse.json({ error: "Invalid driver token." }, { status: 401 });
    const payload = validate(await request.json());
    if (!payload) return NextResponse.json({ error: "Invalid telemetry payload." }, { status: 400 });
    await saveTelemetry(driver.id, payload);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Telemetry service unavailable." }, { status: 503 });
  }
}
