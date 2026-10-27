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
  AttachmentBuilder,
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;
let channelId = process.env.DISCORD_CHANNEL_ID || "";
let changelogChannelId = (process.env.DISCORD_CHANGELOG_CHANNEL_ID || "").trim();
let roleId = (process.env.DISCORD_RELEASE_ROLE_ID || "").trim();
let suggestionChannelId = (process.env.DISCORD_SUGGESTION_CHANNEL_ID || "").trim();
const issueChannelId = (process.env.DISCORD_ISSUE_CHANNEL_ID || "").trim();
let ticketStaffRoleId = (process.env.DISCORD_TICKET_STAFF_ROLE_ID || "").trim();
const ticketLogChannelId = (process.env.DISCORD_TICKET_LOG_CHANNEL_ID || "1546600629445730345").trim();
let ticketCategoryId = (process.env.DISCORD_TICKET_CATEGORY_ID || "").trim();
const ticketCategoryIds = {
  app: (process.env.DISCORD_TICKET_CATEGORY_APP_ID || "").trim(),
  game: (process.env.DISCORD_TICKET_CATEGORY_GAME_ID || "").trim(),
  radio: (process.env.DISCORD_TICKET_CATEGORY_RADIO_ID || "").trim(),
  bugs: (process.env.DISCORD_TICKET_CATEGORY_BUGS_ID || "").trim(),
  general: (process.env.DISCORD_TICKET_CATEGORY_GENERAL_ID || "").trim(),
};
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
  new SlashCommandBuilder().setName("setupserver").setDescription("Create or update the BC Truck Works Discord server layout (server owner only)"),
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

    const targetChannelId = changelogChannelId || channelId;
    if (!targetChannelId) {
      console.warn("New release detected but no changelog/announcement channel is configured. Run /setupserver or set DISCORD_CHANGELOG_CHANNEL_ID.");
      lastSeenReleaseId = release.id;
      latestReleaseCache = release;
      return;
    }
    const channel = await client.channels.fetch(targetChannelId);
    if (!channel || !channel.isTextBased() || typeof channel.send !== "function") {
      throw new Error("The configured changelog/release channel was not found or is not a text channel.");
    }

    const tag = release.tag_name || "New release";
    const title = (release.name || tag).slice(0, 250);
    const releaseUrl = release.html_url || `https://github.com/${repository}/releases`;
    const rawNotes = (release.body || "No release notes were provided. Open the release page for details.").trim();
    const noteChunks = rawNotes.match(/[\s\S]{1,3900}/g) || ["No release notes were provided. Open the release page for details."];
    const embeds = [new EmbedBuilder().setColor(0x43a6ff).setTitle(`🚀 ${title}`)
      .setURL(releaseUrl).setDescription(noteChunks[0])
      .addFields(
        { name: "Version", value: tag.slice(0, 1024), inline: true },
        { name: "Repository", value: repository.slice(0, 1024), inline: true },
        { name: "Release link", value: `[Open ${tag}](${releaseUrl})`, inline: false },
      )
      .setFooter({ text: "BC Truck Works · Development Changelog · Published release" })
      .setTimestamp(release.published_at ? new Date(release.published_at) : new Date())];
    // Discord permits 10 embeds per message. Include up to 10 chunks and link to GitHub for any remainder.
    for (const chunk of noteChunks.slice(1, 10)) {
      embeds.push(new EmbedBuilder().setColor(0x43a6ff).setTitle(`🧰 ${title} — Release Notes (continued)`)
        .setURL(releaseUrl).setDescription(chunk).setFooter({ text: `Version ${tag} · BC Truck Works Changelog` }));
    }
    if (noteChunks.length > 10) {
      embeds[9].setDescription(`${noteChunks[9]}\n\n⚠️ Release notes continue on GitHub. Open the release link above to read the full notes.`.slice(0, 4096));
    }

    await channel.send({
      content: roleId ? `🧰 <@&${roleId}> — a new BC Truck Works release is published!` : "🧰 **New BC Truck Works release published** — the details are below.",
      embeds,
      allowedMentions: roleId ? { parse: [], roles: [roleId] } : { parse: [] },
    });
    lastSeenReleaseId = release.id;
    latestReleaseCache = release;
    console.log(`Posted changelog release entry for ${tag}.`);
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
        "CB Radio / Music": {
          title: "CB Radio and Music Help",
          summaryLabel: "What needs help?",
          summaryPlaceholder: "Radio, audio, or music issue",
          detailsLabel: "Describe the radio or music issue",
          detailsPlaceholder: "Tell us what you expected and what happened.",
          areaPlaceholder: "CB radio, music, audio, or voice"
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

    if (interaction.isButton() && interaction.customId.startsWith("bc_ticket_")) {
      if (!interaction.guild || !interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
        return interaction.reply({ content: "These controls only work inside a ticket channel.", ephemeral: true });
      }
      const topic = interaction.channel.topic || "";
      const isStaff = Boolean(ticketStaffRoleId && interaction.member?.roles?.cache?.has(ticketStaffRoleId));
      const isManager = Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels));
      const isOpener = topic.includes(`(${interaction.user.id})`);
      const staffOnly = ["bc_ticket_claim", "bc_ticket_reopen", "bc_ticket_addstaff"].includes(interaction.customId);
      if (staffOnly && !isStaff && !isManager) {
        return interaction.reply({ content: "Only support staff or a channel manager can use that control.", ephemeral: true });
      }
      if (interaction.customId === "bc_ticket_claim") {
        if (topic.includes("Claimed by:")) {
          return interaction.reply({
            content: "This ticket has already been claimed. Check the channel topic.",
            ephemeral: true
          });
        }

        await interaction.channel.setTopic(
          `${topic} | Claimed by: ${interaction.user.tag} (${interaction.user.id})`.slice(0, 1024),
          "Ticket claimed by support staff"
        );

        const updatedRows = interaction.message.components.map((row) => {
          const updatedRow = ActionRowBuilder.from(row);
          updatedRow.components = updatedRow.components.map((component) => {
            if (component.customId === "bc_ticket_claim") {
              return ButtonBuilder.from(component)
                .setLabel("Claimed")
                .setDisabled(true);
            }
            return ButtonBuilder.from(component);
          });
          return updatedRow;
        });

        await interaction.update({
          components: updatedRows
        });
        await interaction.channel.send({
          content: `🙋 Thanks for your patience — <@${interaction.user.id}> is picking this up now.`,
          allowedMentions: { parse: [], users: [interaction.user.id] }
        });
        return;
      }
      if (interaction.customId === "bc_ticket_close") {
        if (!isStaff && !isOpener && !isManager) return interaction.reply({ content: "Only the ticket opener or support staff can close this ticket.", ephemeral: true });
        if (topic.includes("Status: Closed")) {
          return interaction.reply({ content: "This ticket is already closed. Use Reopen Ticket to reopen it.", ephemeral: true });
        }
        const openerMatch = topic.match(/Opened by .+? \((\d{17,20})\)/);
        if (openerMatch) await interaction.channel.permissionOverwrites.edit(openerMatch[1], { SendMessages: false, AddReactions: false }).catch(() => {});
        await interaction.channel.setTopic(`${topic} | Status: Closed`.slice(0, 1024), "Ticket closed; retained for reopening");
        const controls = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("bc_ticket_claim").setLabel("Claim Ticket").setStyle(ButtonStyle.Primary).setEmoji("🙋").setDisabled(true),
          new ButtonBuilder().setCustomId("bc_ticket_addstaff").setLabel("Add Staff").setStyle(ButtonStyle.Secondary).setEmoji("👥").setDisabled(true),
          new ButtonBuilder().setCustomId("bc_ticket_reopen").setLabel("Reopen Ticket").setStyle(ButtonStyle.Success).setEmoji("🔓"),
          new ButtonBuilder().setCustomId("bc_ticket_close").setLabel("Close Ticket").setStyle(ButtonStyle.Danger).setEmoji("🔒").setDisabled(true)
        );
        await interaction.update({
          content: `🔒 **Ticket Closed**\nClosed by: <@${interaction.user.id}>\nThe conversation transcript is being saved to the staff logs.`,
          components: [controls],
          allowedMentions: { parse: [], users: [interaction.user.id] }
        });

        if (ticketLogChannelId && /^\d{17,20}$/.test(ticketLogChannelId)) {
          try {
            const logChannel = await interaction.guild.channels.fetch(ticketLogChannelId);
            if (!logChannel || !logChannel.isTextBased() || typeof logChannel.send !== "function") {
              throw new Error("Configured ticket log channel is missing or is not a text channel.");
            }

            const transcriptLines = [
              `Ticket Transcript: #${interaction.channel.name}`,
              `Server: ${interaction.guild.name} (${interaction.guild.id})`,
              `Channel ID: ${interaction.channel.id}`,
              `Closed by: ${interaction.user.tag} (${interaction.user.id})`,
              `Opened/topic: ${topic || "Not recorded"}`,
              `Generated: ${new Date().toISOString()}`,
              "",
              "===== CONVERSATION =====",
              ""
            ];
            let before;
            let total = 0;
            while (total < 5000) {
              const batch = await interaction.channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
              if (!batch.size) break;
              const ordered = [...batch.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
              for (const message of ordered) {
                const timestamp = new Date(message.createdTimestamp).toISOString();
                const author = `${message.author.tag} (${message.author.id})`;
                const body = (message.content || "").replace(/\r?\n/g, "\n");
                const attachments = [...message.attachments.values()].map((a) => a.url).join(" ");
                const embeds = message.embeds.length ? `[embeds: ${message.embeds.length}]` : "";
                transcriptLines.push(`[${timestamp}] ${author}: ${body}${attachments ? ` [attachments: ${attachments}]` : ""} ${embeds}`.trimEnd());
                total++;
              }
              before = batch.last()?.id;
              if (batch.size < 100 || !before) break;
            }

            const transcript = new AttachmentBuilder(Buffer.from(transcriptLines.join("\n"), "utf8"), {
              name: `transcript-${interaction.channel.name}-${interaction.channel.id}.txt`
            });
            await logChannel.send({
              content: `📄 **Ticket Transcript Saved**\n**Ticket:** <#${interaction.channel.id}> (${interaction.channel.name})\n**Closed by:** <@${interaction.user.id}>\n**Messages included:** ${total}`,
              files: [transcript],
              allowedMentions: { parse: [], users: [interaction.user.id] }
            });
          } catch (error) {
            console.error("Failed to save ticket transcript to logs:", error);
            await interaction.channel.send("⚠️ Ticket was closed, but the transcript could not be sent to the logs. Please check the ticket log channel configuration and bot permissions.");
          }
        } else {
          console.warn("Ticket closed without a transcript: set DISCORD_TICKET_LOG_CHANNEL_ID to the staff log text channel ID.");
          await interaction.channel.send("⚠️ Ticket closed, but transcript logging is not configured yet. Staff must set DISCORD_TICKET_LOG_CHANNEL_ID in the hosting environment.");
        }
        return;
      }
      if (interaction.customId === "bc_ticket_reopen") {
        if (!isStaff && !isManager) return interaction.reply({ content: "Only support staff or a channel manager can reopen this ticket.", ephemeral: true });
        const openerMatch = topic.match(/Opened by .+? \((\d{17,20})\)/);
        if (openerMatch) await interaction.channel.permissionOverwrites.edit(openerMatch[1], { SendMessages: true, ViewChannel: true, ReadMessageHistory: true }).catch(() => {});
        const cleanTopic = topic.replace(/ \| Status: Closed/g, "");
        await interaction.channel.setTopic(cleanTopic.slice(0, 1024), "Ticket reopened by support staff");
        const controls = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("bc_ticket_claim").setLabel("Claim Ticket").setStyle(ButtonStyle.Primary).setEmoji("🙋"),
          new ButtonBuilder().setCustomId("bc_ticket_addstaff").setLabel("Add Staff").setStyle(ButtonStyle.Secondary).setEmoji("👥"),
          new ButtonBuilder().setCustomId("bc_ticket_close").setLabel("Close Ticket").setStyle(ButtonStyle.Danger).setEmoji("🔒")
        );
        await interaction.update({
          content: `🔓 Ticket reopened by <@${interaction.user.id}>. The conversation continues here.`,
          components: [controls],
          allowedMentions: { parse: [], users: [interaction.user.id] }
        });
        return;
      }
      if (interaction.customId === "bc_ticket_addstaff") {
        const modal = new ModalBuilder().setCustomId("bc_ticket_addstaff_modal").setTitle("Add Staff to Ticket");
        const userIdInput = new TextInputBuilder().setCustomId("staff_user_id").setLabel("Staff member's Discord user ID").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20).setPlaceholder("Paste the numeric Discord user ID");
        modal.addComponents(new ActionRowBuilder().addComponents(userIdInput));
        await interaction.showModal(modal);
        return;
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === "bc_ticket_addstaff_modal") {
      await interaction.deferReply({ ephemeral: true });
      const isStaff = Boolean(ticketStaffRoleId && interaction.member?.roles?.cache?.has(ticketStaffRoleId));
      const isManager = Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels));
      if (!isStaff && !isManager) return interaction.editReply("Only support staff or a channel manager can add staff to a ticket.");
      const userId = interaction.fields.getTextInputValue("staff_user_id").trim();
      if (!/^\d{17,20}$/.test(userId)) return interaction.editReply("That does not look like a valid Discord user ID. Please use the numeric ID, not the display name.");
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!member) return interaction.editReply("I couldn't find that user in this server. Check the ID and try again.");
      await interaction.channel.permissionOverwrites.edit(userId, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true
      }, { reason: `Added to BC Truck Works ticket by ${interaction.user.tag}` });
      await interaction.channel.send({ content: `👥 <@${userId}> was added to this ticket by <@${interaction.user.id}>.`, allowedMentions: { parse: [], users: [userId, interaction.user.id] } });
      return interaction.editReply(`Added <@${userId}> to this ticket.`);
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

      const routeByType = {
        "ATS / ETS2 Companion": "game",
        "Website / Dashboard": "app",
        "CB Radio / Music": "radio",
        "Discord Bot Help": "general",
        "Bug / Problem": "bugs",
        "Account / Access": "general",
        "Suggestion": "general",
        "General Support": "general",
        "Other Request": "general",
      };
      const routeKey = routeByType[category] || "general";
      const categoryNames = {
        app: "📦 App Support",
        game: "🚛 Game & Convoy Support",
        radio: "📻 Radio & Music",
        bugs: "🐛 Bug Reports",
        general: "🛟 General Support",
      };
      const configuredCategoryId = ticketCategoryIds[routeKey] || ticketCategoryId;
      let parentCategory = configuredCategoryId
        ? await interaction.guild.channels.fetch(configuredCategoryId).catch(() => null)
        : null;
      if (parentCategory && parentCategory.type !== ChannelType.GuildCategory) parentCategory = null;
      if (!parentCategory) {
        const desiredName = categoryNames[routeKey] || categoryNames.general;
        parentCategory = interaction.guild.channels.cache.find(
          ch => ch.type === ChannelType.GuildCategory && ch.name === desiredName
        );
        if (!parentCategory) {
          parentCategory = await interaction.guild.channels.create({
            name: desiredName,
            type: ChannelType.GuildCategory,
            reason: `Automatically created for BC Truck Works support tickets (${category})`,
          });
        }
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
        parent: parentCategory.id,
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
        new ButtonBuilder().setCustomId("bc_ticket_claim").setLabel("Claim Ticket").setStyle(ButtonStyle.Primary).setEmoji("🙋"),
        new ButtonBuilder().setCustomId("bc_ticket_addstaff").setLabel("Add Staff").setStyle(ButtonStyle.Secondary).setEmoji("👥"),
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
    if (interaction.commandName === "setupserver") {
      if (!interaction.inGuild()) return interaction.reply({ content: "Use this command inside your Discord server.", ephemeral: true });
      if (interaction.user.id !== interaction.guild.ownerId) return interaction.reply({ content: "Only the server owner can run /setupserver.", ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      const me = await guild.members.fetchMe();
      if (!me.permissions.has(PermissionFlagsBits.ManageChannels) || !me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.editReply("I need Manage Channels and Manage Roles permissions. Enable both for the bot role, then run /setupserver again.");
      }
      const category = async (name) => {
        let ch = guild.channels.cache.find(x => x.type === ChannelType.GuildCategory && x.name.toLowerCase() === name.toLowerCase());
        if (!ch) ch = await guild.channels.create({ name, type: ChannelType.GuildCategory, reason: "BC Truck Works server setup" });
        return ch;
      };
      const textChannel = async (name, parent) => {
        let ch = guild.channels.cache.find(x => x.type === ChannelType.GuildText && x.name.toLowerCase() === name.toLowerCase() && x.parentId === parent.id);
        if (!ch) ch = await guild.channels.create({ name, type: ChannelType.GuildText, parent: parent.id, reason: "BC Truck Works server setup" });
        return ch;
      };
      const forumChannel = async (name, parent, topic) => {
        let ch = guild.channels.cache.find(x => x.type === ChannelType.GuildForum && x.name.toLowerCase() === name.toLowerCase() && x.parentId === parent.id);
        if (!ch) ch = await guild.channels.create({
          name, type: ChannelType.GuildForum, parent: parent.id, topic,
          availableTags: [
            { name: "Open", moderated: false, emoji: { name: "🟢" } },
            { name: "In Progress", moderated: false, emoji: { name: "🛠️" } },
            { name: "Resolved", moderated: false, emoji: { name: "✅" } },
          ],
          reason: "BC Truck Works forum setup",
        });
        return ch;
      };
      const forumWelcomePost = async (forum, title, body, marker) => {
        const active = await forum.threads.fetchActive().catch(() => null);
        const archived = await forum.threads.fetchArchived({ type: "public", limit: 50 }).catch(() => null);
        const threads = [...(active?.threads?.values() || []), ...(archived?.threads?.values() || [])];
        const existing = threads.find(thread => thread.name === title);
        const guideEmbed = new EmbedBuilder().setColor(0x43a6ff).setDescription(body).setFooter({ text: marker });
        if (existing) {
          const starter = await existing.fetchStarterMessage().catch(() => null);
          if (starter && starter.author.id === client.user.id) {
            await starter.edit({ embeds: [guideEmbed], allowedMentions: { parse: [] } }).catch(error => {
              console.warn(`Could not refresh guide ${title}:`, error.message || error);
            });
          }
          return;
        }
        await forum.threads.create({
          name: title,
          message: { embeds: [guideEmbed], allowedMentions: { parse: [] } },
          reason: "BC Truck Works forum instructions",
        });
      };
      const role = async (name, color) => {
        let item = guild.roles.cache.find(x => x.name.toLowerCase() === name.toLowerCase());
        if (!item) item = await guild.roles.create({ name, color, reason: "BC Truck Works server setup" });
        return item;
      };
      const community = await category("BC Truck Works");
      const announcements = await textChannel("announcements", community);
      const changelog = await textChannel("development-changelog", community);
      const status = await textChannel("project-status", community);
      const support = await textChannel("support", community);
      const truckingIdeas = await textChannel("trucking-ideas", community);
      const bugReports = await forumChannel("bug-reports", community, "Report bugs and problems with BC Truck Works. One post per issue; include steps to reproduce and expected vs actual behavior.");
      const modRequests = await forumChannel("mod-requests", community, "Request or discuss mods and mod-related compatibility for ATS/ETS2 and BC Truck Works.");
      const suggestions = await forumChannel("suggestions", community, "Share ideas for improving BC Truck Works. One idea per post; explain the benefit.");
      const tickets = await category("BC Truck Works Tickets");
      const updatesRole = await role("BC Truck Works Updates", 0x43a6ff);
      const staffRole = await role("BC Truck Works Support", 0x57f287);
      channelId = announcements.id;
      changelogChannelId = changelog.id;
      roleId = updatesRole.id;
      ticketCategoryId = tickets.id;
      // Reuse the default ticket category for general support; optional dedicated categories
      // can be configured with DISCORD_TICKET_CATEGORY_*_ID in the hosting environment.
      ticketStaffRoleId = staffRole.id;
      suggestionChannelId = suggestions.id;
      const panel = async (ch, footer, title, description) => {
        const recent = await ch.messages.fetch({ limit: 20 }).catch(() => null);
        if (recent && recent.some(m => m.author.id === client.user.id && m.embeds.some(e => e.footer?.text === footer))) return;
        await ch.send({ embeds: [new EmbedBuilder().setColor(0x43a6ff).setTitle(title).setDescription(description).setFooter({ text: footer })], allowedMentions: { parse: [] } });
      };
      await panel(announcements, "BC Truck Works · Server Setup", "🚛 BC Truck Works Updates", "Official announcements and published release notices. Members can opt into notifications with the BC Truck Works Updates role.");
      await panel(changelog, "BC Truck Works · Changelog", "🧰 Development Changelog", [
        "Welcome to the official **BC Truck Works Development Changelog**.",
        "",
        "This channel records real updates to the BC Truck Works Live Companion and related project features. New published GitHub releases will be posted here automatically.",
        "",
        "🟢 **Added** — new commands, features, tools, integrations, and gameplay or companion capabilities.",
        "🔧 **Improved** — usability, performance, reliability, accessibility, documentation, and existing workflows.",
        "🐛 **Fixed** — confirmed bugs, errors, crashes, broken commands, and other corrected issues.",
        "🔒 **Security & Reliability** — permission checks, configuration validation, safer handling, and stability improvements.",
        "🧰 **Maintenance** — dependency updates, code cleanup, infrastructure work, and compatibility updates.",
        "📚 **Documentation** — setup instructions, guides, configuration notes, and troubleshooting improvements.",
        "🧪 **Testing** — validation, regression checks, and test coverage improvements.",
        "🔗 **Integrations** — Discord bot, GitHub release monitoring, telemetry, website, and related connections.",
        "📦 **Compatibility** — supported game versions, operating systems, dependencies, and mod-related notes where confirmed.",
        "📅 **Planned** — possible or in-progress work that has **not** shipped yet. Planned items are not promises or released features.",
        "",
        "### What an update post should tell you",
        "- **Version and release date:** identify which published build the notes describe.",
        "- **Added / Improved / Fixed:** summarize the important changes in plain language.",
        "- **Compatibility or setup notes:** call out relevant requirements or steps users may need to take.",
        "- **Known issues:** mention confirmed limitations that users should know about.",
        "- **Download and details:** use the official GitHub release link rather than untrusted re-uploads.",
        "",
        "### Automatic release announcements",
        "When a new, published GitHub release is detected, the bot posts the version, repository, full available release notes, and a direct release link here. Long notes are split across multiple embeds so they are not silently cut off; GitHub remains the source for any exceptionally long notes. Draft and prerelease versions are not announced by the automatic watcher.",
        "",
        "**Release notes are the source of truth.** A planned item is not available until it appears in a published release or is otherwise clearly confirmed by the project. If you find a problem, use **#bug-reports**; for ideas, use **#suggestions**; for ATS/ETS2 mod questions, use **#mod-requests**. Use private support tickets for account-specific or sensitive help.",
        "",
        "Please keep changelog discussion constructive and include the release version when reporting a regression. Do not post passwords, bot tokens, API keys, private keys, or private configuration files.",
        "",
        "Serious RP • Realism • Community Driven — BC Truck Works"
      ].join("\n"));
      await panel(status, "BC Truck Works · Status", "📡 Project Status", "Use /status to check the bot and GitHub release monitor. [Repository](https://github.com/" + repository + ") · [Releases](https://github.com/" + repository + "/releases)");
      await panel(support, "BC Truck Works · Support", "🛟 Get Support", "Use /supportpanel to open a private support ticket. Never share passwords, bot tokens, or private keys.");
      await panel(truckingIdeas, "BC Truck Works · Trucking Ideas", "🚛 Trucking Ideas", "Share ideas for trucking routes, convoy events, truck and trailer themes, paint jobs, community challenges, and improvements for BC Truck Works. Please keep one idea per message and be respectful.");
      await forumWelcomePost(bugReports, "📌 How to Report a Bug", [
        "## 🐛 BC Truck Works · Bug Reports Guide",
        "Use this forum to report bugs, crashes, errors, broken commands, or features that do not work as expected. Clear reports help the team understand the problem and try to reproduce it.",
        "",
        "### Before posting",
        "- Search existing topics first. If the same issue is already reported, add useful details to that topic instead of creating a duplicate.",
        "- Create one post per bug and give it a clear title that describes the problem.",
        "- Confirm which app, command, feature, or workflow is affected.",
        "",
        "### Include these details",
        "1. **Affected feature:** Name the command, screen, integration, or workflow.",
        "2. **Environment:** ATS or ETS2 (if relevant), game version, companion/bot version, operating system, and relevant mod details.",
        "3. **Steps to reproduce:** Number the steps another person can follow to see the same issue.",
        "4. **Expected result:** Explain what you thought should happen.",
        "5. **Actual result:** Explain what happened instead and include exact error text when available.",
        "6. **Evidence:** Add a relevant screenshot or short log excerpt if it helps. Review it first and remove private details.",
        "",
        "### Example report",
        "**Title:** `/status` command returns an error",
        "**Steps:** 1) Run `/status`; 2) wait for the response; 3) note the error shown.",
        "**Expected:** The bot reports its connection and release-monitor status.",
        "**Actual:** The command returns an error instead.",
        "**Version/details:** Include the versions and safe error text you know.",
        "",
        "### Safety and follow-up",
        "Never post passwords, Discord bot tokens, API keys, private keys, session cookies, authentication codes, or other secrets. Do not upload configuration files or logs without checking them for sensitive information. Stay respectful, keep follow-up replies in the original topic, and share new information there. Use a private support ticket for account-specific or sensitive issues.",
        "",
        "The team may ask questions, investigate, or update the topic's status. A report is not a promise that a fix is already available. Thank you for helping make BC Truck Works more reliable."
      ].join("\n"), "BC Truck Works · Bug Reports Guide");
      await forumWelcomePost(modRequests, "📌 Mod Requests & Compatibility", [
        "## 🧰 BC Truck Works · Mod Requests & Compatibility Guide",
        "Use this forum for mod requests, ATS/ETS2 mod questions, compatibility checks, load-order questions, and help understanding whether a mod works with your game or a BC Truck Works companion feature.",
        "",
        "### Create a focused topic",
        "- Make one post per mod or compatibility question so replies stay organized.",
        "- Search existing topics first and reply to a matching discussion when possible.",
        "- Use a specific title, such as `ATS — Is Mod Name compatible with game version X?`.",
        "",
        "### What to include",
        "1. **Game:** American Truck Simulator (ATS) or Euro Truck Simulator 2 (ETS2).",
        "2. **Game version:** Include the version number where possible.",
        "3. **Mod details:** Exact name, version, and author/publisher if known.",
        "4. **Source link:** Prefer the official author's page, Steam Workshop where applicable, or a known trusted mod platform.",
        "5. **Your question:** Explain whether you need a recommendation, installation help, compatibility information, or troubleshooting.",
        "6. **What you tried:** Mention relevant settings, load order, DLC, or troubleshooting steps.",
        "7. **Error details:** Share only the relevant text after removing personal information and secrets.",
        "",
        "### Safe downloads and compatibility",
        "A mod that works with one game version may not work with another. Check the mod author's compatibility notes and update history. Be careful with suspicious mirrors, shortened links, unexpected executable installers, password-protected archives, and pages that tell you to disable security software. Do not request pirated files or redistribution that violates a creator's terms.",
        "Compatibility can depend on the game version, DLC, other mods, load order, and server settings. Include those details when they are relevant, and distinguish confirmed information from guesses.",
        "",
        "### Example request",
        "**Title:** `ETS2 — Mod Name compatibility with version X`",
        "**Game/version:** ETS2, version X",
        "**Mod/version:** Exact name and version",
        "**Question:** What do you need to confirm or fix?",
        "**Source:** Link to the trusted mod page",
        "**What I tried:** Relevant steps or load-order changes",
        "",
        "Keep replies respectful and on the original topic. If you discover the answer, post it so other drivers can benefit. Never share passwords, tokens, private keys, or personal information. Thanks for helping keep the BC Truck Works mod community organized and safe."
      ].join("\n"), "BC Truck Works · Mod Requests Guide");
      await forumWelcomePost(suggestions, "📌 How to Submit Suggestions", [
        "## 💡 BC Truck Works · Suggestions Guide",
        "Use this forum to suggest features, quality-of-life improvements, documentation, integrations, community tools, or changes to an existing BC Truck Works workflow.",
        "",
        "### Before posting",
        "- Search existing suggestions first. If a similar idea already exists, add your thoughts to that topic.",
        "- Create one post per idea so each proposal can be discussed and evaluated separately.",
        "- Use a clear title that describes the change rather than a generic title like `Suggestion`.",
        "",
        "### What makes a helpful suggestion?",
        "1. **The idea:** Describe what you would like added, changed, or improved.",
        "2. **The need:** Explain what is missing, confusing, repetitive, or difficult today.",
        "3. **The benefit:** Tell us who it helps and how it would improve the experience.",
        "4. **Example use case:** Describe when or how someone would use the feature.",
        "5. **Optional supporting details:** Add a mock-up, example workflow, or relevant screenshot if it clarifies the idea. Remove private information first.",
        "",
        "### Example suggestion",
        "**Title:** `Add a clearer telemetry connection status`",
        "**Idea:** Show whether the companion is connected, waiting for telemetry, or disconnected.",
        "**Why it helps:** Drivers could understand the current state without guessing or restarting the app unnecessarily.",
        "**Use case:** A driver launches ATS and wants to confirm telemetry has been detected.",
        "",
        "### Discussion guidelines",
        "Use replies to ask questions, share use cases, and suggest refinements. Be respectful when agreeing or disagreeing, and explain trade-offs constructively. Do not post passwords, API keys, bot tokens, private keys, or confidential information.",
        "",
        "### Review and status",
        "Ideas may be discussed, clarified, considered, planned, declined, or implemented. A suggestion is not a promise that a feature will be built. `Planned` does not mean released; check the Development Changelog and published release notes for confirmed changes.",
        "For confirmed bugs, use **#bug-reports**. For ATS/ETS2 mod questions, use **#mod-requests**. For account-specific or sensitive help, open a private support ticket.",
        "",
        "Thank you for helping shape BC Truck Works. Clear ideas and respectful discussion help the project focus on changes that provide real value to the community."
      ].join("\n"), "BC Truck Works · Suggestions Guide");
      return interaction.editReply("✅ Setup complete. Created or reused the standard channels, three separate forums, ticket category, and update/support roles.\n\nChannels: " + [announcements, changelog, status, support, truckingIdeas, bugReports, modRequests, suggestions].map(x => "<#" + x.id + ">").join(" · ") + "\n\nForum channels: #bug-reports, #mod-requests, and #suggestions. IDs are saved for this running process; configure hosting environment variables for persistence after restarts.");
    }

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
          { label: "CB Radio / Music Help", value: "CB Radio / Music", description: "Radio, music, or audio help", emoji: "📻" },
          { label: "Submit a Suggestion", value: "Suggestion", description: "Share an idea to improve BC Truck Works", emoji: "💡" },
          { label: "Other Request", value: "Other Request", description: "Something not listed above", emoji: "📩" }
        );
      const embed = new EmbedBuilder().setColor(0x43a6ff).setTitle("🚛 BC Truck Works — Help Center")
        .setDescription("**Need something? Choose an option from the menu below.**\n\nA short form will open so you can explain your request. Your message will be posted in the configured support channel, and the support role will be tagged. Please never include passwords, bot tokens, or private keys.")
        .addFields({ name: "Available options", value: "🆘 General support\n🐛 Bug reports\n🔐 Account/access help\n🤖 Discord bot help\n🚛 ATS/ETS2 companion help\n🌐 Website/dashboard help\n📻 CB radio/music help\n💡 Suggestions\n📩 Other requests" })
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
        if (!target || !target.isTextBased()) throw new Error("Suggestion channel is invalid.");
        if (target.type === ChannelType.GuildForum) {
          await target.threads.create({
            name: idea.replace(/\s+/g, " ").slice(0, 100) || "New suggestion",
            message: { embeds: [embed], allowedMentions: { parse: [] } },
            reason: "BC Truck Works suggestion submitted",
          });
        } else if (typeof target.send === "function") {
          await target.send({ embeds: [embed], allowedMentions: { parse: [] } });
        } else {
          throw new Error("Suggestion channel cannot accept messages.");
        }
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