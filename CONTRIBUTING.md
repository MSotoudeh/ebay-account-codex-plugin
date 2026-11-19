# Contributing

## Setup

Requirements: Node.js 20+ and npm.

```bash
npm install
```

## Tests

```bash
npm run check
npm run smoke
```

Both must pass before you open a pull request. They do not contact eBay. Do not add tests that need real eBay credentials to CI; use the sandbox environment (`EBAY_ENV=sandbox`) for manual checks.

## Branches and commits

- Branch from `main`: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `chore/<topic>`.
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`.
- Any new write tool must require `confirm: true` and an exact `confirmationText`.
- Never commit `.env`, tokens, client secrets, cookies or exported customer/order data.
