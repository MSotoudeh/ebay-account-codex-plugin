import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

async function waitForHealth(url, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    headers: response.headers,
    text: await response.text(),
  };
}

const host = process.env.EBAY_MCP_HOST || "127.0.0.1";
const port = process.env.EBAY_MCP_PORT || "4318";
const child = spawn("node", ["scripts/server.mjs"], {
  cwd: new URL("..", import.meta.url),
  windowsHide: true,
  env: {
    ...process.env,
    EBAY_MCP_HOST: host,
    EBAY_MCP_PORT: port,
  },
});

let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

try {
  await waitForHealth(`http://${host}:${port}/healthz`);
  const endpoint = `http://${host}:${port}/mcp`;

  const init = await postJson(endpoint, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "ebay-account-smoke-test", version: "1.0.0" },
    },
  });

  assert.equal(init.status, 200, `initialize failed: ${init.text}\n${stderr}`);
  const sessionId = init.headers.get("mcp-session-id");
  assert.ok(sessionId, "missing mcp-session-id");

  const listTools = await postJson(endpoint, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  }, {
    "mcp-session-id": sessionId,
  });
  assert.equal(listTools.status, 200, `tools/list failed: ${listTools.text}`);
  assert.match(listTools.text, /ebay_connection_status/);
  assert.match(listTools.text, /ebay_get_account_profile/);
  assert.match(listTools.text, /ebay_search_inventory/);
  assert.match(listTools.text, /ebay_get_inventory_item/);
  assert.match(listTools.text, /ebay_get_offers/);
  assert.match(listTools.text, /ebay_get_orders/);
  assert.match(listTools.text, /ebay_get_order/);
  assert.match(listTools.text, /ebay_get_payment_policies/);
  assert.match(listTools.text, /ebay_search_marketplace/);
  assert.match(listTools.text, /ebay_list_message_conversations/);
  assert.match(listTools.text, /ebay_send_message/);

  const status = await postJson(endpoint, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "ebay_connection_status",
      arguments: {},
    },
  }, {
    "mcp-session-id": sessionId,
  });
  assert.equal(status.status, 200, `status failed: ${status.text}`);
  assert.match(status.text, /connected/);

  console.log("ebay-account smoke-test: ok");
} finally {
  child.kill();
}
