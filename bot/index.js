const {
  Client,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;
const roleId = (process.env.DISCORD_RELEASE_ROLE_ID || "").trim();
const repository = process.env.GITHUB_REPOSITORY || "dospatch/bc-truck-works-live-companion";
const pollIntervalMs = Math.max(30, Number(process.env.RELEASE_POLL_SECONDS || 60)) * 1000;

if (!token) {
  console.error("Missing DISCORD_TOKEN environment variable.");
  process.exit(1);
}
if (!/^\d{17,20}$/.test(channelId || "")) {
  console.error("Missing or invalid DISCORD_CHANNEL_ID. Use the numeric ID of the Discord text channel for release announcements.");
  process.exit(1);
}
if (roleId && !/^\d{17,20}$/.test(roleId)) {
  console.error("DISCORD_RELEASE_ROLE_ID must be a numeric Discord role ID or left blank.");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let lastSeenReleaseId = null;
let isChecking = false;

async function getLatestRelease() {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "BC-Truck-Works-Discord-Bot",
    },
  });

  if (response.status === 404) {
    console.log("No published GitHub release found yet.");
    return null;
  }
  if (!response.ok) {
    throw new Error(`GitHub release lookup failed: HTTP ${response.status}`);
  }
  return response.json();
}

async function checkForRelease() {
  if (isChecking || !client.isReady()) return;
  isChecking = true;
  try {
    const release = await getLatestRelease();
    if (!release || release.draft || release.prerelease) return;

    // Treat the current latest release as the starting point on first boot.
    // This prevents an old release from being reposted every time the bot starts.
    if (lastSeenReleaseId === null) {
      lastSeenReleaseId = release.id;
      console.log(`Release watcher initialized at ${release.tag_name || release.name}.`);
      return;
    }
    if (release.id === lastSeenReleaseId) return;

    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || typeof channel.send !== "function") {
      throw new Error("The configured release channel was not found or is not a text channel.");
    }

    const tag = release.tag_name || "New release";
    const title = (release.name || tag).slice(0, 250);
    const notes = (release.body || "A new version is available. Open the release page for details.").slice(0, 3800);
    const embed = new EmbedBuilder()
      .setColor(0x43a6ff)
      .setTitle(`🚀 ${title}`)
      .setURL(release.html_url)
      .setDescription(notes)
      .addFields(
        { name: "Version", value: tag.slice(0, 1024), inline: true },
        { name: "Repository", value: repository, inline: true },
        { name: "Release link", value: `[Open ${tag}](${release.html_url})`, inline: false },
      )
      .setFooter({ text: "BC Truck Works Live Companion · Release announcements" })
      .setTimestamp(release.published_at ? new Date(release.published_at) : new Date());

    const content = roleId
      ? `🚛 <@&${roleId}> — a new BC Truck Works Live Companion version is out!`
      : "🚛 A new BC Truck Works Live Companion version is out!";

    await channel.send({
      content,
      embeds: [embed],
      allowedMentions: roleId
        ? { parse: [], roles: [roleId] }
        : { parse: [] },
    });

    lastSeenReleaseId = release.id;
    console.log(`Posted Discord announcement for ${tag}.`);
  } catch (error) {
    console.error("Release check failed:", error.message || error);
  } finally {
    isChecking = false;
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}.`);
  await checkForRelease();
  setInterval(checkForRelease, pollIntervalMs);
});

client.on(Events.Error, (error) => console.error("Discord client error:", error));
client.login(token).catch((error) => {
  console.error("Discord login failed:", error.message || error);
  process.exit(1);
});
