# eBay Account Codex Plugin

A Codex plugin and Model Context Protocol (MCP) server that lets Codex and ChatGPT work with your eBay seller account through eBay OAuth, without ever seeing your eBay password.

## Status

Experimental (v0.1.0). It is smoke-tested locally; real eBay API calls depend on your eBay app scopes and account permissions, and it is not hardened for use as a public multi-user service.

## What it does

Seller work is repetitive: finding the inventory item behind a SKU, checking which orders need attention, reading buyer messages, drafting replies, comparing marketplace prices. This plugin exposes those as API-backed tools an assistant can call after you authorize an eBay account.

Read-only tools: `ebay_connection_status`, `ebay_get_account_profile`, `ebay_search_inventory`, `ebay_get_inventory_item`, `ebay_get_inventory_locations`, `ebay_get_offers`, `ebay_get_offer`, `ebay_get_orders`, `ebay_get_order`, `ebay_get_shipping_fulfillments`, `ebay_get_payment_policies`, `ebay_get_return_policies`, `ebay_get_fulfillment_policies`, `ebay_search_marketplace`, `ebay_get_marketplace_item`, `ebay_list_message_conversations`, `ebay_get_message_conversation`.

Guarded write tools: `ebay_create_or_replace_inventory_item`, `ebay_delete_inventory_item`, `ebay_create_offer`, `ebay_update_offer`, `ebay_publish_offer`, `ebay_add_shipping_tracking`, `ebay_send_message`. Every write tool requires `confirm: true` and an exact `confirmationText` phrase, because these actions affect real people and live eBay state.

## How it works

```text
Codex / ChatGPT --MCP (stdio or HTTP /mcp)--> scripts/server.mjs (Express + MCP SDK)
                                                  |  OAuth authorization-code flow (/auth/login, /auth/callback)
                                                  v
                                           scripts/ebay-client.mjs --> eBay REST APIs
Tokens are stored outside the repository (EBAY_TOKEN_STORE_PATH).
```

`.codex-plugin/plugin.json` is the Codex manifest; it points at `.mcp.json`, which launches `node scripts/server.mjs`. `skills/ebay-account/SKILL.md` holds the assistant guardrails.

## Quick start

Requirements: Node.js 20+, npm. For real use also an eBay Developer Program application (Client ID, Client Secret, RuName/redirect URI).

```powershell
git clone https://github.com/MSotoudeh/ebay-account-codex-plugin.git
cd ebay-account-codex-plugin
npm install
npm run smoke
```

The smoke test starts the server, initializes an MCP session, lists tools and calls `ebay_connection_status`; it does not call eBay.

To use a real account: set the variables below, run `npm start`, then open `http://127.0.0.1:4318/auth/login` to authorize. Connecting ChatGPT (public HTTPS tunnel), installing into Codex, and troubleshooting are covered in [docs/setup.md](docs/setup.md).

## Configuration

Environment variable names (copy [.env.example](.env.example) for defaults; never commit real values): `EBAY_ENV` (`production` or `sandbox`), `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_REDIRECT_URI`, `EBAY_SCOPES`, `EBAY_MCP_HOST`, `EBAY_MCP_PORT`, `EBAY_TOKEN_STORE_PATH`, `EBAY_MARKETPLACE_ACCOUNT_DELETION_ENDPOINT`, `EBAY_MARKETPLACE_ACCOUNT_DELETION_VERIFICATION_TOKEN`.

## Project layout

```text
.codex-plugin/plugin.json   Codex plugin manifest
.mcp.json                   MCP server launch config used by the plugin
.app.json                   placeholder ChatGPT app config
scripts/                    server.mjs, ebay-client.mjs, smoke-test.mjs
skills/ebay-account/        Codex skill with usage guardrails
docs/                       setup guide, history
```

## Testing

```bash
npm install
npm run check    # syntax check of all scripts
npm run smoke    # local MCP smoke test, no network calls to eBay
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md). Background: [docs/HISTORY.md](docs/HISTORY.md).

## License

MIT, see [LICENSE](LICENSE).
