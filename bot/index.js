const {
  Client,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID || "";
const roleId = (process.env.DISCORD_RELEASE_ROLE_ID || "").trim();
const suggestionChannelId = (process.env.DISCORD_SUGGESTION_CHANNEL_ID || "").trim();
const issueChannelId = (process.env.DISCORD_ISSUE_CHANNEL_ID || "").trim();
const ticketStaffRoleId = (process.env.DISCORD_TICKET_STAFF_ROLE_ID || "").trim();
const ticketCategoryId = (process.env.DISCORD_TICKET_CATEGORY_ID || "").trim();
const guildId = (process.env.DISCORD_GUILD_ID || "").trim();
const repository = process.env.GITHUB_REPOSITORY || "dospatch/bc-truck-works-live-companion";
const pollIntervalMs = Math.max(30, Number(process.env.RELEASE_POLL_SECONDS || 60)) * 1000;
const startedAt = Date.now();

if (!token) {
  console.error("Missing DISCORD_TOKEN environment variable.");
  process.exit(1);
}
if (channelId && !/^\d{17,20}$/.test(channelId)) {
  console.error("DISCORD_CHANNEL_ID must be a numeric Discord text channel ID, or left blank.");
  process.exit(1);
}
if (roleId && !/^\d{17,20}$/.test(roleId)) {
  console.error("DISCORD_RELEASE_ROLE_ID must be a numeric Discord role ID or left blank.");
  process.exit(1);
}
if (suggestionChannelId && !/^\d{17,20}$/.test(suggestionChannelId)) {
  console.error("DISCORD_SUGGESTION_CHANNEL_ID must be a numeric channel ID or left blank.");
  process.exit(1);
}
if (ticketCategoryId && !/^\d{17,20}$/.test(ticketCategoryId)) {
  console.error("DISCORD_TICKET_CATEGORY_ID must be a numeric Discord category ID or left blank.");
  process.exit(1);
}
if (ticketStaffRoleId && !/^\d{17,20}$/.test(ticketStaffRoleId)) {
  console.error("DISCORD_TICKET_STAFF_ROLE_ID must be a numeric Discord role ID or left blank.");
  process.exit(1);
}
if (guildId && !/^\d{17,20}$/.test(guildId)) {
  console.error("DISCORD_GUILD_ID must be a numeric Discord server ID or left blank.");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder().setName("version").setDescription("Show the latest BC Truck Works Live Companion release"),
  new SlashCommandBuilder().setName("status").setDescription("Check the bot and GitHub release monitor status"),
  new SlashCommandBuilder().setName("convoy").setDescription("Post a BC Truck Works convoy announcement")
    .addStringOption(o => o.setName("title").setDescription("Convoy name").setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName("date").setDescription("Date and time, including time zone").setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName("meeting_point").setDescription("Starting location or server").setRequired(true).setMaxLength(150))
    .addStringOption(o => o.setName("details").setDescription("Route, game, rules, or extra details").setRequired(false).setMaxLength(1000)),
  new SlashCommandBuilder().setName("support").setDescription("Show how to get help with BC Truck Works"),
  new SlashCommandBuilder().setName("reportissue").setDescription("Open the issue-report menu and submit a problem report"),
  new SlashCommandBuilder().setName("supportpanel").setDescription("Post the BC Truck Works help panel with options for members"),
  new SlashCommandBuilder().setName("suggest").setDescription("Submit an idea for BC Truck Works")
    .addStringOption(o => o.setName("idea").setDescription("Describe your suggestion").setRequired(true).setMaxLength(1000)),
  new SlashCommandBuilder().setName("updates").setDescription("Learn how to receive BC Truck Works update notifications"),
  new SlashCommandBuilder().setName("channelcheck").setDescription("Check the bot's channel permissions in this server"),
  new SlashCommandBuilder().setName("fixchannelperms").setDescription("Owner-only: grant the bot access to all text channels in this server"),
].map(command => command.toJSON());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let lastSeenReleaseId = null;
let isChecking = false;
let latestReleaseCache = null;

async function getLatestRelease() {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "BC-Truck-Works-Discord-Bot" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub release lookup failed: HTTP ${response.status}`);
  return response.json();
}

async function getReleaseSafely() {
  try {
    latestReleaseCache = await getLatestRelease();
    return latestReleaseCache;
  } catch (error) {
    console.error("Could not fetch latest release:", error.message || error);
    return latestReleaseCache;
  }
}

async function checkForRelease() {
  if (isChecking || !client.isReady()) return;
  isChecking = true;
  try {
    const release = await getLatestRelease();
    if (!release || release.draft || release.prerelease) return;
    if (lastSeenReleaseId === null) {
      lastSeenReleaseId = release.id;
      latestReleaseCache = release;
      console.log(`Release watcher initialized at ${release.tag_name || release.name}.`);
      return;
    }
    if (release.id === lastSeenReleaseId) return;

    if (!channelId) {
      console.warn("New release detected but DISCORD_CHANNEL_ID is not configured; set it to enable automatic announcements.");
      lastSeenReleaseId = release.id;
      latestReleaseCache = release;
      return;
    }
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || typeof channel.send !== "function") {
      throw new Error("The configured release channel was not found or is not a text channel.");
    }

    const tag = release.tag_name || "New release";
    const title = (release.name || tag).slice(0, 250);
    const notes = (release.body || "A new version is available. Open the release page for details.").slice(0, 3800);
    const embed = new EmbedBuilder().setColor(0x43a6ff).setTitle(`🚀 ${title}`)
      .setURL(release.html_url).setDescription(notes)
      .addFields(
        { name: "Version", value: tag.slice(0, 1024), inline: true },
        { name: "Repository", value: repository, inline: true },
        { name: "Release link", value: `[Open ${tag}](${release.html_url})`, inline: false },
      )
      .setFooter({ text: "BC Truck Works Live Companion · Release announcements" })
      .setTimestamp(release.published_at ? new Date(release.published_at) : new Date());

    await channel.send({
      content: roleId ? `🚛 <@&${roleId}> — a new BC Truck Works Live Companion version is out!` : "🚛 A new BC Truck Works Live Companion version is out!",
      embeds: [embed],
      allowedMentions: roleId ? { parse: [], roles: [roleId] } : { parse: [] },
    });
    lastSeenReleaseId = release.id;
    latestReleaseCache = release;
    console.log(`Posted Discord announcement for ${tag}.`);
  } catch (error) {
    console.error("Release check failed:", error.message || error);
  } finally {
    isChecking = false;
  }
}

function formatUptime(ms) {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", `${minutes}m`].filter(Boolean).join(" ");
}

async function handleCommand(interaction) {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === "bc_helpdesk_category") {
      const category = interaction.values[0];
      const formSettings = {
        "General Support": {
          title: "General Support Request",
          summaryLabel: "What is your question?",
          summaryPlaceholder: "Briefly describe what you need help with",
          detailsLabel: "Explain your question",
          detailsPlaceholder: "Tell the team what you need help with and what you have tried.",
          areaPlaceholder: "Optional: Discord, website, ATS/ETS2"
        },
        "Bug / Problem": {
          title: "Report a Bug",
          summaryLabel: "What is broken?",
          summaryPlaceholder: "Short description of the bug",
          detailsLabel: "What happened?",
          detailsPlaceholder: "Include what you expected, what happened, and any error message.",
          areaPlaceholder: "Where did the problem happen?"
        },
        "Account / Access": {
          title: "Account and Access Help",
          summaryLabel: "What can't you access?",
          summaryPlaceholder: "Briefly describe the access problem",
          detailsLabel: "Describe the access issue",
          detailsPlaceholder: "Explain what you are trying to access. Never include passwords or codes.",
          areaPlaceholder: "Account, role, website, or server"
        },
        "Discord Bot Help": {
          title: "Discord Bot Help",
          summaryLabel: "Which bot or command?",
          summaryPlaceholder: "Name the bot or command",
          detailsLabel: "What is the bot doing?",
          detailsPlaceholder: "Explain what you tried and include any error message.",
          areaPlaceholder: "Bot name or command"
        },
        "ATS / ETS2 Companion": {
          title: "ATS / ETS2 Companion Help",
          summaryLabel: "What needs help?",
          summaryPlaceholder: "Briefly describe the companion issue",
          detailsLabel: "Describe the game or app issue",
          detailsPlaceholder: "Include your game, what you were doing, and any error message.",
          areaPlaceholder: "ATS, ETS2, telemetry, or companion app"
        },
        "Website / Dashboard": {
          title: "Website and Dashboard Help",
          summaryLabel: "Which page has a problem?",
          summaryPlaceholder: "Name the page or feature",
          detailsLabel: "Describe the website issue",
          detailsPlaceholder: "Explain what you clicked and what happened.",
          areaPlaceholder: "Website page or dashboard"
        },
        "Suggestion": {
          title: "Submit a Suggestion",
          summaryLabel: "What's your idea?",
          summaryPlaceholder: "Give your idea a short title",
          detailsLabel: "Describe your suggestion",
          detailsPlaceholder: "Explain your idea and how it could improve BC Truck Works.",
          areaPlaceholder: "Which part of BC Truck Works?"
        },
        "Other Request": {
          title: "Other Request",
          summaryLabel: "What do you need?",
          summaryPlaceholder: "Give your request a short title",
          detailsLabel: "Tell us about your request",
          detailsPlaceholder: "Explain what you need help with.",
          areaPlaceholder: "Optional related area"
        }
      };
      const settings = formSettings[category] || formSettings["Other Request"];
      const modal = new ModalBuilder()
        .setCustomId(`bc_issue_modal:${category}`)
        .setTitle(settings.title.slice(0, 45));
      const summary = new TextInputBuilder().setCustomId("issue_summary").setLabel(settings.summaryLabel)
        .setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)
        .setPlaceholder(settings.summaryPlaceholder);
      const details = new TextInputBuilder().setCustomId("issue_details").setLabel(settings.detailsLabel)
        .setStyle(TextInputStyle.Paragraph).setMaxLength(1500).setRequired(true)
        .setPlaceholder(settings.detailsPlaceholder);
      const affected = new TextInputBuilder().setCustomId("issue_area").setLabel("Related area (optional)")
        .setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(false)
        .setPlaceholder(settings.areaPlaceholder);
      modal.addComponents(
        new ActionRowBuilder().addComponents(summary),
        new ActionRowBuilder().addComponents(details),
        new ActionRowBuilder().addComponents(affected)
      );
      await interaction.showModal(modal);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "bc_issue_category") {
      const category = interaction.values[0];
      const modal = new ModalBuilder()
        .setCustomId(`bc_issue_modal:${category}`)
        .setTitle("Report a BC Truck Works Issue");
      const summary = new TextInputBuilder().setCustomId("issue_summary").setLabel("Short issue summary")
        .setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)
        .setPlaceholder("Example: Convoy command does not open");
      const details = new TextInputBuilder().setCustomId("issue_details").setLabel("What happened? Include steps and error text")
        .setStyle(TextInputStyle.Paragraph).setMaxLength(1500).setRequired(true)
        .setPlaceholder("Describe what you tried and what you expected.");
      const affected = new TextInputBuilder().setCustomId("issue_area").setLabel("Where did it happen? (optional)")
        .setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(false)
        .setPlaceholder("Discord, website, desktop companion, ATS/ETS2");
      modal.addComponents(
        new ActionRowBuilder().addComponents(summary),
        new ActionRowBuilder().addComponents(details),
        new ActionRowBuilder().addComponents(affected)
      );
      await interaction.showModal(modal);
      return;
    }

    if (interaction.isButton() && interaction.customId === "bc_ticket_close") {
      await interaction.deferReply({ ephemeral: true });
      if (!interaction.guild || !interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
        return interaction.editReply("This close button can only be used inside a ticket channel.");
      }
      const isStaff = ticketStaffRoleId && interaction.member && interaction.member.roles && interaction.member.roles.cache && interaction.member.roles.cache.has(ticketStaffRoleId);
      const isOpener = Boolean(interaction.channel.topic && interaction.channel.topic.includes(`(${interaction.user.id})`));
      const isManager = interaction.memberPermissions && interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels);
      if (!isStaff && !isOpener && !isManager) {
        return interaction.editReply("Only the ticket opener or support staff can close this ticket.");
      }
      await interaction.editReply("Ticket closed. This channel will be deleted in 10 seconds.");
      await interaction.channel.send({ content: `🔒 Ticket closed by <@${interaction.user.id}>. This channel will be deleted in 10 seconds.`, allowedMentions: { parse: [], users: [interaction.user.id] } });
      setTimeout(() => interaction.channel.delete("BC Truck Works support ticket closed").catch(error => console.error("Could not delete closed ticket:", error.message || error)), 10000);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("bc_issue_modal:")) {
      await interaction.deferReply({ ephemeral: true });
      const category = interaction.customId.slice("bc_issue_modal:".length);
      const summary = interaction.fields.getTextInputValue("issue_summary");
      const details = interaction.fields.getTextInputValue("issue_details");
      const affected = interaction.fields.getTextInputValue("issue_area") || "Not specified";
      if (!interaction.guild) {
        return interaction.editReply("Please submit help requests from inside the BC Truck Works Discord server.");
      }

      if (!ticketCategoryId) {
        return interaction.editReply("Tickets are not configured yet. Please ask a server moderator to set DISCORD_TICKET_CATEGORY_ID to the Discord category ID where tickets should be created.");
      }
      const parentCategory = await interaction.guild.channels.fetch(ticketCategoryId).catch(() => null);
      if (!parentCategory || parentCategory.type !== ChannelType.GuildCategory) {
        return interaction.editReply("The configured ticket category could not be found. Ask a moderator to check DISCORD_TICKET_CATEGORY_ID.");
      }

      const safeCategory = category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 18) || "support";
      const safeUser = (interaction.user.username || "member").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "member";
      const channelName = `ticket-${safeCategory}-${safeUser}`.slice(0, 90);
      const overwrites = [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks] },
      ];
      if (ticketStaffRoleId) {
        overwrites.push({ id: ticketStaffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] });
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: ticketCategoryId,
        topic: `BC Truck Works support ticket | Category: ${category} | Opened by ${interaction.user.tag} (${interaction.user.id})`,
        permissionOverwrites: overwrites,
        reason: `Support ticket opened by ${interaction.user.tag}`,
      });

      const requestEmbed = new EmbedBuilder().setColor(0x43a6ff)
        .setTitle(category === "Suggestion" ? "💡 BC Truck Works Suggestion Ticket" : "🆘 BC Truck Works Support Ticket")
        .setDescription("Please keep all discussion about this request in this channel. Do not share passwords, bot tokens, or private keys.")
        .addFields(
          { name: "Category", value: category, inline: true },
          { name: "Opened by", value: `<@${interaction.user.id}>`, inline: true },
          { name: "Summary", value: summary, inline: false },
          { name: "Details", value: details, inline: false },
          { name: "Related area", value: affected, inline: true }
        )
        .setFooter({ text: `User ID: ${interaction.user.id} · BC Truck Works Support` })
        .setTimestamp();
      const closeButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("bc_ticket_close").setLabel("Close Ticket").setStyle(ButtonStyle.Danger).setEmoji("🔒")
      );
      await ticketChannel.send({
        content: ticketStaffRoleId ? `Welcome <@${interaction.user.id}> — <@&${ticketStaffRoleId}>, a new ticket needs attention.` : `Welcome <@${interaction.user.id}> — a new support ticket has been opened.`,
        embeds: [requestEmbed],
        components: [closeButton],
        allowedMentions: ticketStaffRoleId ? { parse: [], users: [interaction.user.id], roles: [ticketStaffRoleId] } : { parse: [], users: [interaction.user.id] },
      });
      return interaction.editReply(`Your ticket has been created: <#${ticketChannel.id}>. Please continue the conversation there.`);
    }

    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === "version") {
      await interaction.deferReply();
      const release = await getReleaseSafely();
      if (!release) return interaction.editReply(`No published GitHub release was found yet. Check the releases page: https://github.com/${repository}/releases`);
      const tag = release.tag_name || release.name || "Latest release";
      const embed = new EmbedBuilder().setColor(0x43a6ff).setTitle(`🚛 BC Truck Works Live Companion — ${tag}`)
        .setURL(release.html_url).setDescription((release.body || "Open the release page for details.").slice(0, 3800))
        .addFields({ name: "Version", value: tag, inline: true }, { name: "Published", value: release.published_at ? new Date(release.published_at).toLocaleDateString("en-US", { dateStyle: "medium" }) : "Not provided", inline: true })
        .addFields({ name: "Release link", value: `[Open ${tag}](${release.html_url})` })
        .setFooter({ text: "BC Truck Works Live Companion" });
      return interaction.editReply({ embeds: [embed] });
    }

    if (interaction.commandName === "status") {
      await interaction.deferReply({ ephemeral: true });
      const release = await getReleaseSafely();
      const embed = new EmbedBuilder().setColor(0x43a6ff).setTitle("🟦 BC Truck Works Bot Status")
        .addFields(
          { name: "Discord connection", value: client.isReady() ? "Online" : "Connecting", inline: true },
          { name: "Uptime", value: formatUptime(Date.now() - startedAt), inline: true },
          { name: "GitHub releases", value: release ? "Reachable" : "No release found / temporarily unavailable", inline: false },
          { name: "Release announcements", value: channelId ? "Channel configured" : "Not configured — set DISCORD_CHANNEL_ID", inline: false },
        ).setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (interaction.commandName === "convoy") {
      const title = interaction.options.getString("title", true);
      const date = interaction.options.getString("date", true);
      const meetingPoint = interaction.options.getString("meeting_point", true);
      const details = interaction.options.getString("details") || "More details will be shared by the convoy organizer.";
      const embed = new EmbedBuilder().setColor(0x43a6ff).setTitle(`🚛 ${title}`)
        .setDescription(details).addFields(
          { name: "Date & time", value: date, inline: false },
          { name: "Meeting point", value: meetingPoint, inline: false },
          { name: "Organized by", value: interaction.user.tag, inline: true },
        ).setFooter({ text: "BC Truck Works · Convoy announcement" }).setTimestamp();
      await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
      return;
    }

    if (interaction.commandName === "support") {
      const embed = new EmbedBuilder().setColor(0x43a6ff).setTitle("🛠️ BC Truck Works Support")
        .setDescription("Need help with the Live Companion or a release?")
        .addFields(
          { name: "1. Describe the issue", value: "Include what you were doing and any error message. Never share passwords, tokens, or private keys.", inline: false },
          { name: "2. Check the project", value: `[GitHub repository](https://github.com/${repository}) · [Releases](https://github.com/${repository}/releases)`, inline: false },
          { name: "3. Ask the community", value: "Post in the server's designated support channel so the team can help.", inline: false },
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.commandName === "supportpanel") {
      if (!interaction.inGuild()) return interaction.reply({ content: "Use this command inside your Discord server.", ephemeral: true });
      const menu = new StringSelectMenuBuilder()
        .setCustomId("bc_helpdesk_category")
        .setPlaceholder("Choose what you need help with")
        .addOptions(
          { label: "Get Support / Ask a Question", value: "General Support", description: "Ask for help or get an answer", emoji: "🆘" },
          { label: "Report a Bug or Problem", value: "Bug / Problem", description: "Something is broken or not working", emoji: "🐛" },
          { label: "Account / Access Help", value: "Account / Access", description: "Login, permissions, or access issues", emoji: "🔐" },
          { label: "Discord Bot Help", value: "Discord Bot Help", description: "Commands, bot responses, or permissions", emoji: "🤖" },
          { label: "ATS / ETS2 Companion Help", value: "ATS / ETS2 Companion", description: "Companion app or game connection", emoji: "🚛" },
          { label: "Website / Dashboard Help", value: "Website / Dashboard", description: "Website or dashboard issues", emoji: "🌐" },
          { label: "Submit a Suggestion", value: "Suggestion", description: "Share an idea to improve BC Truck Works", emoji: "💡" },
          { label: "Other Request", value: "Other Request", description: "Something not listed above", emoji: "📩" }
        );
      const embed = new EmbedBuilder().setColor(0x43a6ff).setTitle("🚛 BC Truck Works — Help Center")
        .setDescription("**Need something? Choose an option from the menu below.**\n\nA short form will open so you can explain your request. Your message will be posted in the configured support channel, and the support role will be tagged. Please never include passwords, bot tokens, or private keys.")
        .addFields({ name: "Available options", value: "🆘 General support\n🐛 Bug reports\n🔐 Account/access help\n🤖 Discord bot help\n🚛 ATS/ETS2 companion help\n🌐 Website/dashboard help\n💡 Suggestions\n📩 Other requests" })
        .setFooter({ text: "BC Truck Works Support · Test Panel" });
      return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    }

    if (interaction.commandName === "reportissue") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("bc_issue_category")
        .setPlaceholder("Choose the type of issue you're reporting")
        .addOptions(
          { label: "Bug / Something is broken", value: "Bug / Something is broken", description: "A feature does not work as expected", emoji: "🐛" },
          { label: "Login / Account", value: "Login / Account", description: "Sign-in, account, or access trouble", emoji: "🔐" },
          { label: "Discord Bot / Commands", value: "Discord Bot / Commands", description: "Slash commands, bot responses, or permissions", emoji: "🤖" },
          { label: "Website / Dashboard", value: "Website / Dashboard", description: "Website pages, dashboard, or display issues", emoji: "🌐" },
          { label: "ATS / ETS2 Companion", value: "ATS / ETS2 Companion", description: "Telemetry or companion app issues", emoji: "🚛" },
          { label: "Suggestion / Other", value: "Suggestion / Other", description: "An idea or another kind of issue", emoji: "💡" }
        );
      const row = new ActionRowBuilder().addComponents(menu);
      const embed = new EmbedBuilder().setColor(0x43a6ff).setTitle("🛠️ Report an Issue")
        .setDescription("Choose a category below. The next step opens a form where you can describe the problem. Please do not include passwords, bot tokens, or other secrets.")
        .setFooter({ text: "BC Truck Works Support" });
      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (interaction.commandName === "suggest") {
      // Acknowledge immediately so channel/API delays cannot trigger Discord's 3-second timeout.
      await interaction.deferReply({ ephemeral: true });
      const idea = interaction.options.getString("idea", true);
      const embed = new EmbedBuilder().setColor(0x43a6ff).setTitle("💡 BC Truck Works Suggestion")
        .setDescription(idea).addFields({ name: "Submitted by", value: interaction.user.tag, inline: true })
        .setFooter({ text: `User ID: ${interaction.user.id}` }).setTimestamp();
      if (suggestionChannelId) {
        const target = await client.channels.fetch(suggestionChannelId);
        if (!target || !target.isTextBased() || typeof target.send !== "function") throw new Error("Suggestion channel is invalid.");
        await target.send({ embeds: [embed], allowedMentions: { parse: [] } });
        return interaction.editReply({ content: "Thanks! Your suggestion has been submitted." });
      }
      return interaction.editReply({ content: "Thanks for your suggestion! No suggestion channel is configured yet, so please post it in your server's suggestions channel: " + idea });
    }

    if (interaction.commandName === "channelcheck") {
      if (!interaction.inGuild()) return interaction.reply({ content: "Use this command inside your Discord server.", ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      const channels = await guild.channels.fetch();
      const rows = [];
      let inaccessible = 0;
      for (const ch of channels.values()) {
        if (!ch || !ch.isTextBased() || !ch.permissionsFor) continue;
        const perms = ch.permissionsFor(client.user.id);
        if (!perms || !perms.has("ViewChannel")) {
          inaccessible++;
          rows.push(`❌ #${ch.name}: cannot view`);
          continue;
        }
        const missing = [];
        if (!perms.has("SendMessages")) missing.push("Send Messages");
        if (!perms.has("ReadMessageHistory")) missing.push("Read History");
        if (!perms.has("EmbedLinks")) missing.push("Embed Links");
        rows.push(missing.length ? `⚠️ #${ch.name}: missing ${missing.join(", ")}` : `✅ #${ch.name}: OK`);
      }
      const report = rows.length ? rows.join("\n") : "No text channels could be checked.";
      const chunks = report.match(/[\s\S]{1,3500}/g) || [report];
      const embed = new EmbedBuilder().setColor(inaccessible ? 0xed4245 : 0x43a6ff)
        .setTitle("🔎 BC Truck Works Bot — Channel Permission Check")
        .setDescription(chunks[0])
        .addFields({ name: "Channels with no View Channel access", value: String(inaccessible), inline: true },
                   { name: "Channels checked", value: String(rows.length), inline: true })
        .setFooter({ text: "Private channels are included in this check; review the report before granting access." });
      await interaction.editReply({ embeds: [embed] });
      for (const chunk of chunks.slice(1)) await interaction.followUp({ content: chunk, ephemeral: true });
      return;
    }

    if (interaction.commandName === "fixchannelperms") {
      if (!interaction.inGuild()) return interaction.reply({ content: "Use this command inside your Discord server.", ephemeral: true });
      if (interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply({ content: "Only the server owner can run this repair command.", ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      const me = await interaction.guild.members.fetchMe();
      if (!me.permissions.has("ManageChannels")) {
        return interaction.editReply("I cannot repair channel permissions yet because my bot role is missing **Manage Channels**. In Server Settings → Roles, enable Manage Channels for the bot role, then run /fixchannelperms again. Do not share your bot token.");
      }
      const channels = await interaction.guild.channels.fetch();
      let fixed = 0;
      let skipped = 0;
      const failures = [];
      for (const ch of channels.values()) {
        if (!ch || !ch.isTextBased() || !ch.permissionOverwrites) { skipped++; continue; }
        try {
          await ch.permissionOverwrites.edit(client.user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            EmbedLinks: true,
          }, { reason: "Server owner requested BC Truck Works Bot channel access repair" });
          fixed++;
        } catch (error) {
          skipped++;
          failures.push(`#${ch.name}: ${String(error.message || error).slice(0, 180)}`);
        }
      }
      const result = new EmbedBuilder().setColor(failures.length ? 0xedaa30 : 0x43a6ff)
        .setTitle("🛠️ Channel Permission Repair Results")
        .setDescription(`Updated bot-specific permissions in **${fixed}** text channels. Skipped or failed: **${skipped}**.\n\nThe bot was granted View Channel, Send Messages, Read Message History, and Embed Links where Discord allowed it.`)
        .setFooter({ text: "This does not grant permissions to other users or change slash-command integration restrictions." });
      if (failures.length) result.addFields({ name: "Some channels could not be changed", value: failures.slice(0, 8).join("\n").slice(0, 1000) });
      await interaction.editReply({ embeds: [result] });
      return;
    }

    if (interaction.commandName === "updates") {
      const roleText = roleId ? `The configured update role is <@&${roleId}>. Ask a moderator to assign it to you.` : "The update role has not been configured for automatic mentions yet. Ask a moderator about the server's update notification role.";
      const embed = new EmbedBuilder().setColor(0x43a6ff).setTitle("🔔 BC Truck Works Updates")
        .setDescription("Use this server's update notification role to hear about new companion releases.")
        .addFields({ name: "Notifications", value: roleText, inline: false }, { name: "Latest releases", value: `[View releases](https://github.com/${repository}/releases)`, inline: false });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (error) {
    console.error(`Command /${interaction.commandName} failed:`, error.message || error);
    const reply = { content: "Something went wrong while running that command. Please try again or contact a server moderator.", ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(reply).catch(() => {});
    else await interaction.reply(reply).catch(() => {});
  }
}

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  const applicationId = client.application?.id;
  if (!applicationId) throw new Error("Discord application ID is not available after login.");
  const route = guildId
    ? Routes.applicationGuildCommands(applicationId, guildId)
    : Routes.applicationCommands(applicationId);
  await rest.put(route, { body: commands });
  console.log(guildId ? `Registered slash commands for server ${guildId}.` : "Registered global slash commands (Discord may take a little while to display them).");
}

client.on(Events.InteractionCreate, handleCommand);
client.on(Events.Error, error => console.error("Discord client error:", error));

client.once(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}.`);
  try {
    await registerCommands();
  } catch (error) {
    console.error("Could not register slash commands:", error.message || error);
  }
  await checkForRelease();
  setInterval(checkForRelease, pollIntervalMs);
});

client.login(token).catch(error => {
  console.error("Discord login failed:", error.message || error);
  process.exit(1);
});
