# Discord release automation

This repository can announce **published GitHub Releases** in Discord. It does not create Discord categories or channels: a webhook can only post in the channel it belongs to.

## Planned Discord category and channels

Create this category manually (or use a separate Discord bot with the Manage Channels permission):

- Category: `🚛 BC TRUCK WORKS — COMPANION APP`
- `#feature-releases` — published version announcements (recommended webhook destination)
- `#update-notes` — detailed feature and fix summaries
- `#guides-and-installation` — installation, setup, and ATS/ETS2 telemetry guides
- `#bug-reports-and-feedback` — issue reports and suggestions
- `#downloads-and-patches` — installer links, checksums, and patch information

## Connect the release announcement

1. In Discord, open **Server Settings → Integrations → Webhooks** (or the target channel's integrations), create a webhook for `#feature-releases`, and copy its URL.
2. In GitHub, open this repository's **Settings → Secrets and variables → Actions → New repository secret**.
3. Name the secret `DISCORD_WEBHOOK_RELEASES` and paste the webhook URL as its value. Do not commit the URL or post it in chat; anyone with it can post to that channel.
4. Publish a GitHub Release. The **Discord Release Announcement** workflow will post the release title, tag, notes, and GitHub Release link.

If the secret is absent, the workflow is designed to skip the announcement rather than expose or invent credentials. If a configured webhook is invalid or Discord rejects the post, the workflow will fail so the problem is visible in Actions.

## Release workflow

1. Finish and test a feature.
2. Add user-facing notes to the GitHub Release.
3. Publish the release only when it is ready.
4. The workflow announces the published version in `#feature-releases`.
5. Add separate guide/update posts as needed.

The workflow does **not** publish releases, merge pull requests, create Discord channels, or upload any secrets. Channel creation requires a Discord bot token with the appropriate server permissions and a separate setup step.
