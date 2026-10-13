import { NextResponse } from "next/server";
import { consumePairing } from "../../../../lib/convoy-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request) {
  try {
    const body = await request.json();
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const name = typeof body.name === "string" ? body.name : "Truck driver";
    if (!/^[A-HJ-NP-Z2-9]{6}$/i.test(code)) return NextResponse.json({ error: "Enter the 6-character pairing code." }, { status: 400 });
    const result = await consumePairing(code, name);
    if (!result) return NextResponse.json({ error: "That code is invalid or expired. Generate a new code on the website." }, { status: 410 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Pairing service unavailable." }, { status: 503 });
  }
}
