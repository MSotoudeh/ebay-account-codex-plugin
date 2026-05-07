import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

  const DEFAULT_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/buy.item.feed",
  "https://api.ebay.com/oauth/api_scope/buy.marketing",
  "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.message.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.message",
];

export function loadConfig() {
  const env = (process.env.EBAY_ENV || "sandbox").toLowerCase();
  const isProduction = env === "production" || env === "prod";
  const tokenStorePath = expandEnvPath(
    process.env.EBAY_TOKEN_STORE_PATH ||
      "%LOCALAPPDATA%\\Codex\\eBayAccountPlugin\\tokens.json",
  );

  return {
    env: isProduction ? "production" : "sandbox",
    host: process.env.EBAY_MCP_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.EBAY_MCP_PORT || "4318", 10),
    clientId: process.env.EBAY_CLIENT_ID || "",
    clientSecret: process.env.EBAY_CLIENT_SECRET || "",
    redirectUri: process.env.EBAY_REDIRECT_URI || "",
    scopes: splitScopes(process.env.EBAY_SCOPES).length
      ? splitScopes(process.env.EBAY_SCOPES)
      : DEFAULT_SCOPES,
    tokenStorePath,
    marketplaceAccountDeletionEndpoint: process.env.EBAY_MARKETPLACE_ACCOUNT_DELETION_ENDPOINT || "",
    marketplaceAccountDeletionVerificationToken:
      process.env.EBAY_MARKETPLACE_ACCOUNT_DELETION_VERIFICATION_TOKEN || "",
    authBaseUrl: isProduction
      ? "https://auth.ebay.com/oauth2/authorize"
      : "https://auth.sandbox.ebay.com/oauth2/authorize",
    apiBaseUrl: isProduction
      ? "https://api.ebay.com"
      : "https://api.sandbox.ebay.com",
  };
}

export function requireOAuthConfig(config) {
  const missing = [];
  if (!config.clientId) missing.push("EBAY_CLIENT_ID");
  if (!config.clientSecret) missing.push("EBAY_CLIENT_SECRET");
  if (!config.redirectUri) missing.push("EBAY_REDIRECT_URI");
  if (missing.length) {
    throw new Error(`Missing required eBay OAuth environment variables: ${missing.join(", ")}`);
  }
}

export function buildAuthorizationUrl(config, state) {
  requireOAuthConfig(config);
  const url = new URL(config.authBaseUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForTokens(config, code) {
  requireOAuthConfig(config);
  return tokenRequest(config, new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  }));
}

export async function refreshAccessToken(config, refreshToken) {
  requireOAuthConfig(config);
  return tokenRequest(config, new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: config.scopes.join(" "),
  }));
}

async function tokenRequest(config, body) {
  const response = await fetch(`${config.apiBaseUrl}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
    },
    body,
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(`eBay token request failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return {
    ...payload,
    obtained_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + (payload.expires_in ?? 0) * 1000).toISOString(),
  };
}

export async function loadTokens(config) {
  try {
    return JSON.parse(await readFile(config.tokenStorePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function saveTokens(config, tokens) {
  await mkdir(dirname(config.tokenStorePath), { recursive: true });
  await writeFile(config.tokenStorePath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export async function getValidAccessToken(config) {
  const tokens = await loadTokens(config);
  if (!tokens?.access_token) {
    throw new Error("No eBay tokens found. Open /auth/login first and complete eBay consent.");
  }

  const expiresAt = tokens.expires_at ? Date.parse(tokens.expires_at) : 0;
  if (expiresAt && expiresAt - Date.now() > 120_000) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    throw new Error("The stored eBay access token expired and no refresh token is available. Run /auth/login again.");
  }

  const refreshed = await refreshAccessToken(config, tokens.refresh_token);
  const nextTokens = {
    ...tokens,
    ...refreshed,
    refresh_token: refreshed.refresh_token || tokens.refresh_token,
  };
  await saveTokens(config, nextTokens);
  return nextTokens.access_token;
}

export async function ebayGet(config, path, query = {}, options = {}) {
  return ebayRequest(config, "GET", path, { query, ...options });
}

export async function ebayPost(config, path, body = {}, options = {}) {
  return ebayRequest(config, "POST", path, { body, ...options });
}

export async function ebayPut(config, path, body = {}, options = {}) {
  return ebayRequest(config, "PUT", path, { body, ...options });
}

export async function ebayDelete(config, path, options = {}) {
  return ebayRequest(config, "DELETE", path, options);
}

export async function ebayRequest(config, method, path, {
  query = {},
  body,
  headers = {},
  contentLanguage = "en-US",
} = {}) {
  const accessToken = await getValidAccessToken(config);
  const url = new URL(path, config.apiBaseUrl);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const requestHeaders = {
    authorization: `Bearer ${accessToken}`,
    accept: "application/json",
    ...headers,
  };
  if (body !== undefined) {
    requestHeaders["content-type"] = "application/json";
    requestHeaders["content-language"] = contentLanguage;
  }

  const response = await fetch(url, {
    method,
    headers: {
      ...requestHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(`eBay API request failed (${response.status} ${method} ${path}): ${JSON.stringify(payload)}`);
  }
  return payload;
}

export function publicConnectionStatus(config, tokens) {
  return {
    environment: config.env,
    tokenStorePath: config.tokenStorePath,
    connected: Boolean(tokens?.access_token),
    expiresAt: tokens?.expires_at || null,
    hasRefreshToken: Boolean(tokens?.refresh_token),
    scopes: config.scopes,
  };
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function splitScopes(value = "") {
  return value
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function expandEnvPath(value) {
  return value.replace(/%([^%]+)%/g, (_match, name) => process.env[name] || "");
}
