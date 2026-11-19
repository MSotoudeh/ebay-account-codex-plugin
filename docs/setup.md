# Setup guide

Detailed production setup, Codex installation, ChatGPT connection and troubleshooting. For a first run, see the Quick start in the [README](../README.md).

## Production setup (ChatGPT)

This is the production path for connecting ChatGPT to your real eBay account:

1. Install dependencies and validate the server:

```powershell
git clone https://github.com/msotoudeh/ebay-account-codex-plugin.git
cd ebay-account-codex-plugin
npm install
npm run check
npm run smoke
```

2. Configure production eBay credentials:

```powershell
$env:EBAY_ENV = "production"
$env:EBAY_CLIENT_ID = "<your production eBay App ID / Client ID>"
$env:EBAY_CLIENT_SECRET = "<your production eBay Cert ID / Client Secret>"
$env:EBAY_REDIRECT_URI = "<your production eBay RuName / redirect_uri value>"
$env:EBAY_MCP_HOST = "127.0.0.1"
$env:EBAY_MCP_PORT = "4318"
```

3. Start the MCP server:

```powershell
npm start
```

4. In a second PowerShell window, expose it with ngrok:

```powershell
ngrok http 4318
```

5. Copy the ngrok HTTPS forwarding URL and add `/mcp`.

Example:

```text
https://abc123.ngrok.app/mcp
```

6. In ChatGPT, enable Developer Mode and create an app/connector with that MCP URL.

Important: free ngrok tunnels can show an interstitial warning page to some HTTP clients. If ChatGPT cannot list tools from the free ngrok URL, use a reserved/paid ngrok domain or deploy the MCP server behind a stable HTTPS host.

7. Open the eBay login URL locally and approve OAuth:

```text
http://127.0.0.1:4318/auth/login
```

After OAuth succeeds, ChatGPT can call the read-only eBay tools.

## Configure eBay OAuth

Create an eBay developer application at:

https://developer.ebay.com/

Then configure environment variables:

```powershell
$env:EBAY_ENV = "production"
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

Sandbox is still supported for development by setting:

```powershell
$env:EBAY_ENV = "sandbox"
```

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
    "path": "/path/to/ebay-account-codex-plugin"
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

## Troubleshooting

`ngrok` is not recognized:

```powershell
winget install --id Ngrok.Ngrok -e
ngrok version
```

Port `4318` is already in use:

```powershell
netstat -ano | findstr :4318
$env:EBAY_MCP_PORT = "4320"
npm start
ngrok http 4320
```

eBay redirect URI mismatch:

- Confirm `EBAY_REDIRECT_URI` exactly matches the production RuName / redirect URI value shown in the eBay Developer console.
- Confirm the eBay application is production, not sandbox.
- Re-run `npm start` after changing environment variables.

Missing eBay scopes:

- Add the missing OAuth scope in the eBay Developer app if available.
- Re-open `http://127.0.0.1:4318/auth/login` so eBay issues a token with the updated scopes.

ChatGPT cannot list tools:

- Confirm the tunnel URL ends with `/mcp`.
- Confirm `https://<ngrok-domain>/healthz` returns `ok: true`.
- If free ngrok returns `ERR_NGROK_6024`, switch to a reserved/paid ngrok domain or another stable HTTPS host.
- Refresh the app/connector in ChatGPT settings after server changes.

OAuth callback state or code errors:

- Start from `http://127.0.0.1:4318/auth/login` again.
- Do not reuse old OAuth callback URLs.
- Keep the MCP server running during the full login flow.

## Important Limitations

This is implementable and smoke-tested, but real eBay API calls depend on your eBay app scopes and account permissions.

Some tools may require additional eBay approval or scopes. If a call fails with an eBay authorization error, check:

- your selected `EBAY_ENV`
- whether you authorized sandbox vs production
- your eBay app scopes
- whether the account is allowed to use that API
- whether the API is available in the selected marketplace
