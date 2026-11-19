# Scripts

- `server.mjs`: Express + MCP server (`npm start`). Serves `/mcp`, `/healthz`, `/auth/login`, `/auth/callback`.
- `ebay-client.mjs`: eBay OAuth and REST client used by the server.
- `smoke-test.mjs`: starts the server, initializes an MCP session, lists tools and calls `ebay_connection_status` (`npm run smoke`). Does not call eBay.

eBay app credentials and redirect URI details are required before OAuth login can succeed; see `../.env.example` and `../docs/setup.md`.
