# Discord Companion setup

The repository contains two manual GitHub Actions workflows for configuring the BC Truck Works Discord server:

- **Set Up BC Truck Works Discord** (setup-discord-companion-server.yml) creates or updates the 🚛 BC TRUCK WORKS — COMPANION APP category and six channels. Announcement, update, guide, and download channels are read-only for regular members; help and bug-report channels allow member posts. An optional staff role is granted posting permissions.
- **Register BC Truck Works Slash Commands** (register-discord-companion-commands.yml) registers /convoy, /connect, /help, and /support as guild commands.

## Required setup

1. In the Discord Developer Portal, create or select the application and add a bot user.
2. Invite the bot to the server with **Manage Channels**, **View Channels**, **Send Messages**, **Read Message History**, and **Use Application Commands**. Keep the bot role above any optional staff role it must manage. Do not grant Administrator unless you independently decide it is necessary.
3. Add these repository Actions secrets (names only; never paste values into chat):
   - DISCORD_BOT_TOKEN
   - DISCORD_APPLICATION_ID
4. Run **Set Up BC Truck Works Discord** from Actions and enter the target server ID. The optional staff role ID is a Discord role ID, not a role name.
5. Run **Register BC Truck Works Slash Commands** and enter the same server ID.
6. In Developer Portal > General Information, set the **Interactions Endpoint URL** to https://bc-truck-works-live-companion.vercel.app/api/discord/interactions. Set the endpoint's **Public Key** as the Vercel environment variable DISCORD_PUBLIC_KEY (hexadecimal public key from the Developer Portal). Set COMPANION_PUBLIC_URL to the canonical website URL if it differs from the default, then redeploy.

## Commands

- /convoy — gives a button to the live convoy.
- /connect — gives a button to the Connect My Game pairing page.
- /help — explains setup and safe pairing practices.
- /support — privately points the user to the support and bug-report channels.

The command endpoint verifies Discord's Ed25519 request signature before replying. It does not need a continuously running Gateway bot process. The interaction endpoint must be publicly reachable by Discord; if Vercel Deployment Protection/SSO blocks the route, configure an appropriate public-access exception for this endpoint before setting it in the Developer Portal.

## Permissions and limitations

The setup workflow is idempotent: it reuses matching channels and updates their topics/permission overwrites rather than making duplicates. It intentionally does not create or delete server roles, alter unrelated channels, or change existing member permissions outside the Companion category. Discord's category/channel permission inheritance can be manually customized afterward; rerunning the workflow will restore the documented defaults for these six channels.

A bot with **Manage Channels** is required to create channels and apply overwrites. If the bot cannot manage the category or channel, confirm its role position and the server permissions. GitHub Actions can configure channels and register commands, but it cannot accept a token pasted into a workflow form; store tokens only as Actions secrets.
