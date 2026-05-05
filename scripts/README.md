# Scripts

Scripts for this plugin:

- `node plugins/ebay-account/scripts/server.mjs`: run the local MCP server.
- `http://127.0.0.1:4318/auth/login`: start the eBay OAuth consent flow and store tokens securely.
- `node plugins/ebay-account/scripts/smoke-test.mjs`: verify the MCP server starts and exposes tools.

eBay app credentials and redirect URI details are still required before OAuth login can succeed.
