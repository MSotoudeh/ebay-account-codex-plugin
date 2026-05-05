import express from "express";
import { randomBytes, randomUUID } from "node:crypto";
import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import {
  buildAuthorizationUrl,
  ebayDelete,
  ebayGet,
  ebayPost,
  ebayPut,
  exchangeCodeForTokens,
  loadConfig,
  loadTokens,
  publicConnectionStatus,
  requireOAuthConfig,
  saveTokens,
} from "./ebay-client.mjs";

const transports = {};
const oauthStates = new Set();

function toToolResult(result) {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
  };
}

function requireConfirmation({ confirm, confirmationText }, phrase) {
  if (confirm !== true || confirmationText !== phrase) {
    throw new Error(`This tool changes eBay state. Set confirm=true and confirmationText="${phrase}" to proceed.`);
  }
}

function pathPart(value, name) {
  if (!value || typeof value !== "string") throw new Error(`${name} is required`);
  return encodeURIComponent(value);
}

function buildServer(config) {
  const server = new McpServer({
    name: "ebay-account",
    version: "0.1.0",
  });

  server.registerTool("ebay_connection_status", {
    title: "eBay connection status",
    description: "Use this when checking whether an eBay account is connected and which environment is configured.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async () => {
    const tokens = await loadTokens(config);
    return toToolResult(publicConnectionStatus(config, tokens));
  });

  server.registerTool("ebay_get_account_profile", {
    title: "Get eBay account profile",
    description: "Use this when the user asks which eBay account is connected.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async () => {
    const profile = await ebayGet(config, "/commerce/identity/v1/user/");
    return toToolResult(profile);
  });

  server.registerTool("ebay_search_inventory", {
    title: "Search eBay inventory",
    description: "Use this when the user asks to list or search their eBay inventory items.",
    inputSchema: {
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ limit = 25, offset = 0 }) => {
    const inventory = await ebayGet(config, "/sell/inventory/v1/inventory_item", { limit, offset });
    return toToolResult(inventory);
  });

  server.registerTool("ebay_get_inventory_item", {
    title: "Get eBay inventory item",
    description: "Use this when the user asks for details about one inventory item SKU.",
    inputSchema: {
      sku: z.string(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ sku }) => {
    const item = await ebayGet(config, `/sell/inventory/v1/inventory_item/${pathPart(sku, "sku")}`);
    return toToolResult(item);
  });

  server.registerTool("ebay_create_or_replace_inventory_item", {
    title: "Create or replace eBay inventory item",
    description: "Use this when the user explicitly wants to create or replace inventory data for one SKU.",
    inputSchema: {
      sku: z.string(),
      inventoryItem: z.record(z.string(), z.any()),
      confirm: z.boolean(),
      confirmationText: z.string(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ sku, inventoryItem, confirm, confirmationText }) => {
    requireConfirmation({ confirm, confirmationText }, "replace inventory item");
    const result = await ebayPut(config, `/sell/inventory/v1/inventory_item/${pathPart(sku, "sku")}`, inventoryItem);
    return toToolResult(result || { ok: true, sku });
  });

  server.registerTool("ebay_delete_inventory_item", {
    title: "Delete eBay inventory item",
    description: "Use this when the user explicitly wants to delete inventory data for one SKU.",
    inputSchema: {
      sku: z.string(),
      confirm: z.boolean(),
      confirmationText: z.string(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  }, async ({ sku, confirm, confirmationText }) => {
    requireConfirmation({ confirm, confirmationText }, "delete inventory item");
    const result = await ebayDelete(config, `/sell/inventory/v1/inventory_item/${pathPart(sku, "sku")}`);
    return toToolResult(result || { ok: true, sku });
  });

  server.registerTool("ebay_get_inventory_locations", {
    title: "Get eBay inventory locations",
    description: "Use this when the user asks for seller inventory locations.",
    inputSchema: {
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ limit = 25, offset = 0 }) => {
    const locations = await ebayGet(config, "/sell/inventory/v1/location", { limit, offset });
    return toToolResult(locations);
  });

  server.registerTool("ebay_get_offers", {
    title: "Get eBay offers",
    description: "Use this when the user asks for offers/listings associated with inventory.",
    inputSchema: {
      sku: z.string().optional(),
      marketplaceId: z.string().optional(),
      format: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ sku, marketplaceId, format, limit = 25, offset = 0 }) => {
    const offers = await ebayGet(config, "/sell/inventory/v1/offer", {
      sku,
      marketplace_id: marketplaceId,
      format,
      limit,
      offset,
    });
    return toToolResult(offers);
  });

  server.registerTool("ebay_get_offer", {
    title: "Get eBay offer",
    description: "Use this when the user asks for one offer/listing by offer ID.",
    inputSchema: {
      offerId: z.string(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ offerId }) => {
    const offer = await ebayGet(config, `/sell/inventory/v1/offer/${pathPart(offerId, "offerId")}`);
    return toToolResult(offer);
  });

  server.registerTool("ebay_create_offer", {
    title: "Create eBay offer",
    description: "Use this when the user explicitly wants to create an unpublished eBay offer for inventory.",
    inputSchema: {
      offer: z.record(z.string(), z.any()),
      confirm: z.boolean(),
      confirmationText: z.string(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ offer, confirm, confirmationText }) => {
    requireConfirmation({ confirm, confirmationText }, "create offer");
    const result = await ebayPost(config, "/sell/inventory/v1/offer", offer);
    return toToolResult(result);
  });

  server.registerTool("ebay_update_offer", {
    title: "Update eBay offer",
    description: "Use this when the user explicitly wants to update an eBay offer/listing.",
    inputSchema: {
      offerId: z.string(),
      offer: z.record(z.string(), z.any()),
      confirm: z.boolean(),
      confirmationText: z.string(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  }, async ({ offerId, offer, confirm, confirmationText }) => {
    requireConfirmation({ confirm, confirmationText }, "update offer");
    const result = await ebayPut(config, `/sell/inventory/v1/offer/${pathPart(offerId, "offerId")}`, offer);
    return toToolResult(result || { ok: true, offerId });
  });

  server.registerTool("ebay_publish_offer", {
    title: "Publish eBay offer",
    description: "Use this when the user explicitly wants to publish an offer as a live eBay listing.",
    inputSchema: {
      offerId: z.string(),
      confirm: z.boolean(),
      confirmationText: z.string(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  }, async ({ offerId, confirm, confirmationText }) => {
    requireConfirmation({ confirm, confirmationText }, "publish offer");
    const result = await ebayPost(config, `/sell/inventory/v1/offer/${pathPart(offerId, "offerId")}/publish`);
    return toToolResult(result);
  });

  server.registerTool("ebay_get_orders", {
    title: "Get eBay orders",
    description: "Use this when the user asks about recent eBay seller orders.",
    inputSchema: {
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
      filter: z.string().optional(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ limit = 25, offset = 0, filter }) => {
    const orders = await ebayGet(config, "/sell/fulfillment/v1/order", { limit, offset, filter });
    return toToolResult(orders);
  });

  server.registerTool("ebay_get_order", {
    title: "Get eBay order",
    description: "Use this when the user asks for one seller order by order ID.",
    inputSchema: {
      orderId: z.string(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ orderId }) => {
    const order = await ebayGet(config, `/sell/fulfillment/v1/order/${pathPart(orderId, "orderId")}`);
    return toToolResult(order);
  });

  server.registerTool("ebay_get_shipping_fulfillments", {
    title: "Get eBay shipping fulfillments",
    description: "Use this when the user asks for shipping/tracking fulfillments for an order.",
    inputSchema: {
      orderId: z.string(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ orderId }) => {
    const fulfillments = await ebayGet(config, `/sell/fulfillment/v1/order/${pathPart(orderId, "orderId")}/shipping_fulfillment`);
    return toToolResult(fulfillments);
  });

  server.registerTool("ebay_add_shipping_tracking", {
    title: "Add eBay shipping tracking",
    description: "Use this when the user explicitly wants to add shipment tracking to an eBay order.",
    inputSchema: {
      orderId: z.string(),
      trackingNumber: z.string(),
      shippingCarrierCode: z.string(),
      lineItems: z.array(z.record(z.string(), z.any())).optional(),
      confirm: z.boolean(),
      confirmationText: z.string(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  }, async ({ orderId, trackingNumber, shippingCarrierCode, lineItems, confirm, confirmationText }) => {
    requireConfirmation({ confirm, confirmationText }, "add shipping tracking");
    const result = await ebayPost(config, `/sell/fulfillment/v1/order/${pathPart(orderId, "orderId")}/shipping_fulfillment`, {
      trackingNumber,
      shippingCarrierCode,
      lineItems,
    });
    return toToolResult(result);
  });

  server.registerTool("ebay_get_payment_policies", {
    title: "Get eBay payment policies",
    description: "Use this when the user asks for seller payment policies.",
    inputSchema: {
      marketplaceId: z.string(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ marketplaceId }) => {
    const policies = await ebayGet(config, "/sell/account/v1/payment_policy", { marketplace_id: marketplaceId });
    return toToolResult(policies);
  });

  server.registerTool("ebay_get_return_policies", {
    title: "Get eBay return policies",
    description: "Use this when the user asks for seller return policies.",
    inputSchema: {
      marketplaceId: z.string(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ marketplaceId }) => {
    const policies = await ebayGet(config, "/sell/account/v1/return_policy", { marketplace_id: marketplaceId });
    return toToolResult(policies);
  });

  server.registerTool("ebay_get_fulfillment_policies", {
    title: "Get eBay fulfillment policies",
    description: "Use this when the user asks for seller shipping/fulfillment policies.",
    inputSchema: {
      marketplaceId: z.string(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ marketplaceId }) => {
    const policies = await ebayGet(config, "/sell/account/v1/fulfillment_policy", { marketplace_id: marketplaceId });
    return toToolResult(policies);
  });

  server.registerTool("ebay_search_marketplace", {
    title: "Search eBay marketplace",
    description: "Use this when the user asks to search public eBay marketplace items.",
    inputSchema: {
      query: z.string(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
      marketplaceId: z.string().optional(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ query, limit = 25, offset = 0, marketplaceId }) => {
    const headers = marketplaceId ? { "x-ebay-c-marketplace-id": marketplaceId } : {};
    const result = await ebayGet(config, "/buy/browse/v1/item_summary/search", { q: query, limit, offset }, { headers });
    return toToolResult(result);
  });

  server.registerTool("ebay_get_marketplace_item", {
    title: "Get eBay marketplace item",
    description: "Use this when the user asks for details about a public eBay item.",
    inputSchema: {
      itemId: z.string(),
      marketplaceId: z.string().optional(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ itemId, marketplaceId }) => {
    const headers = marketplaceId ? { "x-ebay-c-marketplace-id": marketplaceId } : {};
    const result = await ebayGet(config, `/buy/browse/v1/item/${pathPart(itemId, "itemId")}`, {}, { headers });
    return toToolResult(result);
  });

  server.registerTool("ebay_list_message_conversations", {
    title: "List eBay message conversations",
    description: "Use this when the user asks for buyer/seller message conversations.",
    inputSchema: {
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ limit = 25, offset = 0 }) => {
    const conversations = await ebayGet(config, "/commerce/message/v1/conversation", { limit, offset });
    return toToolResult(conversations);
  });

  server.registerTool("ebay_get_message_conversation", {
    title: "Get eBay message conversation",
    description: "Use this when the user asks to read one buyer/seller message conversation.",
    inputSchema: {
      conversationId: z.string(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async ({ conversationId }) => {
    const conversation = await ebayGet(config, `/commerce/message/v1/conversation/${pathPart(conversationId, "conversationId")}`);
    return toToolResult(conversation);
  });

  server.registerTool("ebay_send_message", {
    title: "Send eBay message",
    description: "Use this only after the user explicitly approves sending a buyer/seller message.",
    inputSchema: {
      conversationId: z.string(),
      message: z.record(z.string(), z.any()),
      confirm: z.boolean(),
      confirmationText: z.string(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  }, async ({ conversationId, message, confirm, confirmationText }) => {
    requireConfirmation({ confirm, confirmationText }, "send ebay message");
    const result = await ebayPost(config, `/commerce/message/v1/conversation/${pathPart(conversationId, "conversationId")}/message`, message);
    return toToolResult(result);
  });

  return server;
}

async function main() {
  const config = loadConfig();
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/", (_req, res) => {
    res.json({
      ok: true,
      name: "ebay-account",
      mcp: "/mcp",
      login: "/auth/login",
      callback: "/auth/callback",
    });
  });

  app.get("/healthz", (_req, res) => {
    res.json({
      ok: true,
      name: "ebay-account",
      environment: config.env,
      mcp: "/mcp",
      login: "/auth/login",
    });
  });

  app.get("/auth/login", (req, res) => {
    try {
      requireOAuthConfig(config);
      const state = randomBytes(24).toString("hex");
      oauthStates.add(state);
      res.redirect(buildAuthorizationUrl(config, state));
    } catch (error) {
      res.status(500).type("text/plain").send(error.message);
    }
  });

  app.get("/auth/callback", async (req, res) => {
    try {
      const { code, state, error, error_description: description } = req.query;
      if (error) {
        res.status(400).type("text/plain").send(`eBay OAuth error: ${error} ${description || ""}`);
        return;
      }
      if (!code || !state || !oauthStates.has(String(state))) {
        res.status(400).type("text/plain").send("Invalid OAuth callback state or missing authorization code.");
        return;
      }
      oauthStates.delete(String(state));
      const tokens = await exchangeCodeForTokens(config, String(code));
      await saveTokens(config, tokens);
      res.type("text/plain").send("eBay account connected. You can close this tab and use the MCP tools.");
    } catch (error) {
      res.status(500).type("text/plain").send(error.message);
    }
  });

  async function handlePost(req, res) {
    const sessionId = req.headers["mcp-session-id"];
    let transport = sessionId ? transports[sessionId] : undefined;
    let server;

    if (!transport && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      server = buildServer(config);
      transport.onclose = async () => {
        if (transport?.sessionId) delete transports[transport.sessionId];
        await server.close();
      };
      await server.connect(transport);
    }

    if (!transport) {
      res.status(400).json({ error: "Missing or invalid MCP session" });
      return;
    }

    await transport.handleRequest(req, res, req.body);
    if (transport.sessionId && !transports[transport.sessionId]) {
      transports[transport.sessionId] = transport;
    }
  }

  async function handleSessionRequest(req, res) {
    const sessionId = req.headers["mcp-session-id"];
    const transport = sessionId ? transports[sessionId] : undefined;
    if (!transport) {
      res.status(400).send("Missing or invalid MCP session");
      return;
    }
    await transport.handleRequest(req, res);
  }

  app.options("/mcp", (_req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type,mcp-session-id");
    res.status(204).end();
  });
  app.post("/mcp", handlePost);
  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);

  app.listen(config.port, config.host, () => {
    console.log(JSON.stringify({
      ok: true,
      host: config.host,
      port: config.port,
      mcp: `http://${config.host}:${config.port}/mcp`,
      login: `http://${config.host}:${config.port}/auth/login`,
    }));
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
