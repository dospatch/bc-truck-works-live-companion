import { NextResponse } from "next/server";
import { createPairing, makeCode } from "../../../lib/convoy-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:32145",
  "http://localhost:32145",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
]);

function corsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  const headers = { "Cache-Control": "no-store", "Vary": "Origin" };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  return headers;
}

export async function OPTIONS(request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request) {
  try {
    const origin = request.headers.get("origin") || "";
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return NextResponse.json({ error: "This origin is not allowed to generate desktop pairing codes." }, { status: 403, headers: corsHeaders(request) });
    }
    const code = makeCode();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    await createPairing(code, expiresAt);
    return NextResponse.json({ code, expiresAt }, { headers: corsHeaders(request) });
  } catch {
    return NextResponse.json({ error: "Pairing is temporarily unavailable. Configure Redis for persistent pairing." }, { status: 503, headers: corsHeaders(request) });
  }
}
