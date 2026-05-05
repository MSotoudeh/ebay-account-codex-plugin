# eBay Account Codex Plugin

Connect Codex on Windows and ChatGPT to an eBay account through a local or hosted Model Context Protocol (MCP) server.

This project is a Codex plugin plus MCP server. It uses eBay OAuth, stores tokens outside the repository, and exposes eBay tools that an AI assistant can call only after the user authorizes an eBay account.

## Why This Exists

Seller work is repetitive and context-heavy. You often need to answer questions like:

- Which eBay account is connected?
- What inventory item or offer matches this SKU?
- Which orders need attention?
- What shipping policy or return policy should a listing use?
- What did a buyer ask, and what is a safe reply?
- What comparable items are currently on eBay?

Codex and ChatGPT can help with those workflows, but they should not receive your eBay password or scrape your browser. This plugin gives them a proper API-backed path: OAuth consent, scoped API access, and guarded write tools.

## When You May Need It

Use this plugin when you want an AI assistant to help with eBay seller operations:

- checking inventory and offers
- reviewing recent orders
- finding shipping/tracking information
- reading buyer/seller messages
- drafting replies to buyers
- researching marketplace prices
- preparing listing or inventory changes

It is most useful for sellers, support operators, inventory managers, and developers building eBay automations.

Do not use it as a public multi-user service without adding production auth/session isolation, hosted secret storage, monitoring, and a privacy policy.

## What It Can Do

Read-only tools:

- `ebay_connection_status`
- `ebay_get_account_profile`
- `ebay_search_inventory`
- `ebay_get_inventory_item`
- `ebay_get_inventory_locations`
- `ebay_get_offers`
- `ebay_get_offer`
- `ebay_get_orders`
- `ebay_get_order`
- `ebay_get_shipping_fulfillments`
- `ebay_get_payment_policies`
- `ebay_get_return_policies`
- `ebay_get_fulfillment_policies`
- `ebay_search_marketplace`
- `ebay_get_marketplace_item`
- `ebay_list_message_conversations`
- `ebay_get_message_conversation`

Guarded write tools:

- `ebay_create_or_replace_inventory_item`
- `ebay_delete_inventory_item`
- `ebay_create_offer`
- `ebay_update_offer`
- `ebay_publish_offer`
- `ebay_add_shipping_tracking`
- `ebay_send_message`

Every write tool requires `confirm: true` and an exact `confirmationText` phrase. This is intentional. Publishing listings, changing offers, deleting inventory, sending buyer messages, and adding tracking can affect real people and live eBay state.

## Requirements

- Windows, macOS, or Linux
- Node.js 20 or newer
- npm
- eBay Developer Program account
- eBay application credentials:
  - Client ID / App ID
  - Client Secret / Cert ID
  - Redirect URI / RuName

## Quick Start

Clone and install:

```powershell
git clone https://github.com/msotoudeh/ebay-account-codex-plugin.git
cd ebay-account-codex-plugin
npm install
npm run smoke
```

The smoke test starts the MCP server, initializes an MCP session, lists tools, and calls `ebay_connection_status`. It does not call eBay.

## Configure eBay OAuth

Create an eBay developer application at:

https://developer.ebay.com/

Then configure environment variables:

```powershell
$env:EBAY_ENV = "sandbox"
$env:EBAY_CLIENT_ID = "<your eBay App ID / Client ID>"
$env:EBAY_CLIENT_SECRET = "<your eBay Cert ID / Client Secret>"
$env:EBAY_REDIRECT_URI = "<your eBay RuName / redirect_uri value>"
```

Optional settings:

```powershell
$env:EBAY_MCP_HOST = "127.0.0.1"
$env:EBAY_MCP_PORT = "4318"
$env:EBAY_TOKEN_STORE_PATH = "$env:LOCALAPPDATA\Codex\eBayAccountPlugin\tokens.json"
```

Start the server:

```powershell
npm start
```

Open the login URL:

```text
http://127.0.0.1:4318/auth/login
```

After eBay redirects back to `/auth/callback`, the server stores OAuth tokens at `EBAY_TOKEN_STORE_PATH`.

## Add It To Codex

This repository is already shaped as a Codex plugin:

```text
.codex-plugin/plugin.json
.mcp.json
.app.json
skills/
scripts/
```

For local development, clone the repo and install dependencies:

```powershell
git clone https://github.com/msotoudeh/ebay-account-codex-plugin.git
cd ebay-account-codex-plugin
npm install
```

Then add or install the plugin in Codex using this repository path. The plugin manifest points Codex at `.mcp.json`, which starts:

```text
node scripts/server.mjs
```

If your Codex installation uses a marketplace file, add an entry like:

```json
{
  "name": "ebay-account",
  "source": {
    "source": "local",
    "path": "C:/GitHub/ebay-account-codex-plugin"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Productivity"
}
```

## Connect From ChatGPT

ChatGPT needs a public HTTPS MCP URL.

For development:

1. Run the server locally with `npm start`.
2. Expose port `4318` with an HTTPS tunnel such as ngrok or Cloudflare Tunnel.
3. Use the tunneled URL plus `/mcp`.
4. In ChatGPT, enable Developer Mode.
5. Add a new app/connector using the public MCP URL.

Example MCP URL:

```text
https://your-tunnel.example/mcp
```

For production, host the MCP server behind a stable HTTPS domain and store secrets in a real secret manager.

## Security Model

This project never needs your eBay password.

It uses:

- eBay OAuth authorization-code flow
- scoped API access
- local token storage by default
- explicit confirmation for write tools

Never commit:

- `.env`
- eBay client secrets
- access tokens
- refresh tokens
- cookies
- exported customer/order data

## Important Limitations

This is implementable and smoke-tested, but real eBay API calls depend on your eBay app scopes and account permissions.

Some tools may require additional eBay approval or scopes. If a call fails with an eBay authorization error, check:

- your selected `EBAY_ENV`
- whether you authorized sandbox vs production
- your eBay app scopes
- whether the account is allowed to use that API
- whether the API is available in the selected marketplace

## Development

Run checks:

```powershell
npm run check
npm run smoke
```

Start the server:

```powershell
npm start
```

Health check:

```text
http://127.0.0.1:4318/healthz
```

MCP endpoint:

```text
http://127.0.0.1:4318/mcp
```

OAuth login:

```text
http://127.0.0.1:4318/auth/login
```

## Project Layout

```text
.codex-plugin/plugin.json   Codex plugin manifest
.mcp.json                   MCP server launch config
.app.json                   Placeholder ChatGPT app config
scripts/server.mjs          Express + MCP server
scripts/ebay-client.mjs     eBay OAuth and API client
scripts/smoke-test.mjs      Local MCP smoke test
skills/ebay-account/        Codex skill guardrails
```

## License

MIT
