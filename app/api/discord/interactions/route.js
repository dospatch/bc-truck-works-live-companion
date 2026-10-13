import { createPublicKey, verify } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISCORD_API = "https://discord.com/api/v10";
const APP_URL = () => (process.env.COMPANION_PUBLIC_URL || "https://bc-truck-works-live-companion.vercel.app").replace(/\/$/, "");
const LINK_BUTTON = (label, url) => ({
  type: 2,
  style: 5,
  label,
  url,
});

function validDiscordSignature(rawBody, signature, timestamp, publicKeyHex) {
  if (!signature || !timestamp || !/^[a-f0-9]{128}$/i.test(signature) || !/^[a-f0-9]{64}$/i.test(publicKeyHex || "")) return false;
  // Discord uses Ed25519 over timestamp + exact raw request body.
  const key = createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicKeyHex, "hex")]),
    format: "der",
    type: "spki",
  });
  return verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signature, "hex"));
}

const COMMANDS = {
  convoy: {
    content: "Open the live BC Truck Works convoy. Driver locations and telemetry are read-only on the website.",
    components: [{ type: 1, components: [LINK_BUTTON("Open Live Convoy", APP_URL() + "/convoy")] }],
  },
  connect: {
    content: "Pair your desktop companion with your website account. Open Connect My Game and enter the short-lived code in the desktop app.",
    components: [{ type: 1, components: [LINK_BUTTON("Connect My Game", APP_URL() + "/connect-my-game")] }],
  },
  help: {
    content: "BC Truck Works Live Companion help: install the Windows app, install a compatible SCS telemetry plugin, open Connect My Game to pair, then use the convoy page to see drivers. Never share your pairing code or driver token.",
    components: [{ type: 1, components: [LINK_BUTTON("Setup Guide", APP_URL() + "/connect-my-game"), LINK_BUTTON("Live Convoy", APP_URL() + "/convoy")] }],
  },
  support: {
    content: "Need help? Post in #companion-help or report bugs in #bug-reports-and-feedback. Include app version and steps to reproduce, but never post passwords, pairing codes, or tokens.",
    components: [],
  },
};

export async function POST(request) {
  const rawBody = await request.text();
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) return Response.json({ error: "Discord interactions are not configured." }, { status: 503 });

  let valid = false;
  try {
    valid = validDiscordSignature(
      rawBody,
      request.headers.get("x-signature-ed25519"),
      request.headers.get("x-signature-timestamp"),
      publicKey
    );
  } catch {
    valid = false;
  }
  if (!valid) return Response.json({ error: "Invalid Discord signature." }, { status: 401 });

  let interaction;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (interaction.type === 1) return Response.json({ type: 1 });
  if (interaction.type !== 2) return Response.json({ type: 4, data: { content: "This interaction is not supported.", flags: 64 } });

  const commandName = interaction.data?.name;
  const command = COMMANDS[commandName];
  if (!command) {
    return Response.json({ type: 4, data: { content: "Unknown command. Try /help.", flags: 64 } });
  }

  return Response.json({
    type: 4,
    data: {
      ...command,
      flags: commandName === "support" ? 64 : 0,
      allowed_mentions: { parse: [] },
    },
  });
}

export async function GET() {
  return Response.json({ ok: true, service: "discord-interactions" });
}
