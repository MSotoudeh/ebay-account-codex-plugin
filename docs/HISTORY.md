# History

## Why it started

Seller operations on eBay are repetitive and context-heavy. The goal was to give Codex and ChatGPT a proper API-backed path (OAuth consent, scoped access, guarded writes) instead of sharing a password or scraping a browser.

## Phases

1. **Initial plugin (2026-05-05).** Codex plugin scaffold, Express/MCP server, eBay OAuth client, read-only and guarded write tools, a smoke test.
2. **Production ChatGPT setup (2026-05-06).** Documentation for exposing the server through an HTTPS tunnel (ngrok) and registering it as a ChatGPT connector.
3. **Compliance callback (2026-05-07).** Support for eBay's marketplace account-deletion compliance endpoint (`EBAY_MARKETPLACE_ACCOUNT_DELETION_*`).
4. **Public-ready cleanup (2026-11-19).** README restructured, detailed setup moved to `docs/setup.md`, stale paths in `scripts/README.md` fixed, contributor and security files added.

## Previous state versus current state

The README held everything (rationale, setup, troubleshooting, limitations). It is now a short overview with the long material in `docs/setup.md`.

## Unmerged lines of work

None; there is a single branch (`main`).

## Known unfinished

- No automated tests beyond `npm run check` and the smoke test; eBay API calls are not covered.
- No CI workflow.
- Not suitable as a public multi-user service: needs per-user session isolation, hosted secret storage, monitoring and a privacy policy.
- `.app.json` is a placeholder (`{"apps": {}}`).
- `plugin.json` long description still describes the first version as a "scaffold".
