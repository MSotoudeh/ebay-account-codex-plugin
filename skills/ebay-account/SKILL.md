---
name: ebay-account
description: Use when working on the local eBay account MCP/plugin integration for Codex or ChatGPT.
---

# eBay Account

This plugin is intended to connect Codex and ChatGPT to a user's eBay account through eBay OAuth and MCP tools.

## Guardrails

- Never ask for or store the user's eBay password.
- Never commit `client_secret`, access tokens, refresh tokens, cookies, or exported account data.
- Prefer read-only tools until OAuth and token refresh are validated.
- Mark listing publication, listing edits, order actions, and listing termination as mutating public-state operations.
- Require explicit user confirmation before any tool changes a live eBay resource.

## Implementation Notes

- Use eBay OAuth authorization-code flow for account-owned data.
- Use a local secret store for Codex desktop development.
- Use a hosted secret store for ChatGPT deployment.
- Keep MCP tool outputs minimal and avoid returning unnecessary PII.
