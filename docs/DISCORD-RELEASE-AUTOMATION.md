# Discord Companion server setup

The **Set Up Discord Companion Channels** GitHub Actions workflow creates the Companion category and its five text channels in your Discord server. It is safe to run again: it checks for the named category/channels before creating missing ones.

## One-time GitHub configuration

1. In the Discord Developer Portal, open your bot application and create/copy the bot token. Never share the token in chat or commit it to the repository.
2. Invite the bot to your intended server with the `bot` scope and the **Manage Channels**, **View Channels**, and **Send Messages** permissions. The bot must be able to view the existing channels to check for duplicates.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions**.
4. Add repository secret `DISCORD_BOT_TOKEN` with the bot token as its value.
5. Add repository variable `DISCORD_GUILD_ID` with your Discord server ID as its value. To copy it, enable Developer Mode in Discord, then right-click (or long-press) the server icon and choose **Copy Server ID**.
6. Open **Actions → Set Up Discord Companion Channels → Run workflow** and run it on `feature/ats-ets2-live-telemetry`.

## Channels created

Category: `🚛 BC TRUCK WORKS — COMPANION APP`

- `#feature-releases`
- `#update-notes`
- `#guides-and-installation`
- `#bug-reports-and-feedback`
- `#downloads-and-patches`

The setup workflow creates missing channels; it does not delete or rename existing channels, change roles, or alter channel permissions. Review the server's existing permissions after creation.

## Automatic release announcements

After the category exists, create a Discord webhook in `#feature-releases` and store its URL as the GitHub Actions repository secret `DISCORD_WEBHOOK_RELEASES`. The separate **Discord Release Announcement** workflow posts a message when a GitHub Release is published.

Reference: [Discord channel management API](https://discord.com/developers/docs/resources/guild#create-guild-channel).
