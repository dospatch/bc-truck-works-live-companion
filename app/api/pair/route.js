import { NextResponse } from "next/server";
import { createPairing, makeCode } from "../../../lib/convoy-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST() {
  try {
    const code = makeCode();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    await createPairing(code, expiresAt);
    return NextResponse.json({ code, expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Pairing is temporarily unavailable. Configure Redis for persistent pairing." }, { status: 503 });
  }
}
