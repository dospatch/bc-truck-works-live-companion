import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const submissions = new Map();

function clean(value, max) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max)
    : "";
}

export async function POST(request) {
  const webhook = process.env.DISCORD_IDEAS_WEBHOOK_URL;
  if (!webhook) {
    return NextResponse.json({ error: "Idea submissions are not configured yet. Please try again later." }, { status: 503 });
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
  }

  let body;
  try {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 12000) return NextResponse.json({ error: "Submission is too large." }, { status: 413 });
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please submit a valid idea form." }, { status: 400 });
  }

  if (clean(body?.website, 200)) return NextResponse.json({ ok: true });

  const title = clean(body?.title, 100);
  const description = clean(body?.description, 1500);
  const category = clean(body?.category, 40);
  const name = clean(body?.name, 60) || "Community member";
  const allowedCategories = new Set(["Feature request", "Website idea", "Desktop companion", "ATS / ETS2", "Discord / community", "Bug report", "Other"]);

  if (title.length < 5) return NextResponse.json({ error: "Idea title must be at least 5 characters." }, { status: 400 });
  if (description.length < 15) return NextResponse.json({ error: "Please add a little more detail (at least 15 characters)." }, { status: 400 });
  if (!allowedCategories.has(category)) return NextResponse.json({ error: "Please choose a valid category." }, { status: 400 });

  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = clean(forwarded.split(",")[0], 80) || "unknown";
  const now = Date.now();
  const entry = submissions.get(ip);
  if (entry && now - entry.startedAt < WINDOW_MS && entry.count >= MAX_PER_WINDOW) {
    return NextResponse.json({ error: "You've sent several ideas recently. Please wait a little before sending another." }, { status: 429 });
  }
  if (!entry || now - entry.startedAt >= WINDOW_MS) submissions.set(ip, { startedAt: now, count: 1 });
  else entry.count += 1;

  let target;
  try {
    target = new URL(webhook);
    if (target.protocol !== "https:" || !["discord.com", "discordapp.com"].includes(target.hostname)) throw new Error("Invalid Discord webhook host");
    target.searchParams.set("wait", "true");
    // Discord Forum channels require a thread name when creating a new post.
    target.searchParams.set("thread_name", title);
  } catch {
    return NextResponse.json({ error: "The Discord ideas destination is misconfigured." }, { status: 503 });
  }

  const payload = {
    username: "BC Truck Works Ideas",
    allowed_mentions: { parse: [] },
    embeds: [{
      title: "💡 " + title,
      description,
      color: 4436735,
      fields: [
        { name: "Category", value: category, inline: true },
        { name: "Submitted by", value: name, inline: true },
        { name: "Status", value: "🟡 New idea — awaiting community/staff review", inline: false },
      ],
      footer: { text: "BC Truck Works Live Companion · Community Ideas" },
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error("Discord ideas webhook returned HTTP", response.status);
      return NextResponse.json({ error: "Discord could not accept the idea right now. Please try again later." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, message: "Your idea was sent to the BC Truck Works Discord ideas channel." });
  } catch (error) {
    console.error("Discord ideas webhook failed:", String(error?.message || error).slice(0, 160));
    return NextResponse.json({ error: "Could not reach Discord. Please try again later." }, { status: 502 });
  }
}
