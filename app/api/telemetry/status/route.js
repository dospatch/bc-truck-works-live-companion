export const runtime = "nodejs";

const noCache = {
  "Cache-Control": "no-store, max-age=0",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: noCache });
}

export async function GET() {
  return Response.json({
    ok: true,
    app: "BC Truck Works Live Companion",
    version: "1.1.0",
    telemetry: {
      connected: false,
      source: null,
      status: "not_connected",
      message: "No local ATS/ETS2 telemetry bridge is connected to this website.",
      valuesAreLive: false,
    },
    features: {
      browserVoice: true,
      coDriverChat: true,
      savedBrowserSettings: true,
      liveGameTelemetry: false,
    },
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
