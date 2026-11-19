# Security policy

Report vulnerabilities privately through GitHub's "Report a vulnerability" (private security advisory) on this repository rather than in a public issue.

Secrets (eBay client secret, OAuth tokens, the compliance verification token) live only in git-ignored `.env` files, process environment variables or the token store outside the repository (`EBAY_TOKEN_STORE_PATH`), never in the repo. The plugin never needs your eBay password. If you find a committed secret, report it as above.

Do not run this server as a public multi-user service without adding session isolation and hosted secret storage.
