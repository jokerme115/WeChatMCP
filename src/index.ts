#!/usr/bin/env node

import { FastMCP } from "fastmcp";
import { z } from "zod";

import { globalTimeoutMs } from "./config.js";
import {
  readMergedRuntimeConfig,
  runtimeHealthSchema,
  runtimeHttpStreamSchema,
  runtimeServerSchema,
} from "./runtimeConfig.js";
import { createTools } from "./tools.js";
import { WeappAutomatorManager } from "./weappClient.js";

const SERVER_VERSION = "0.2.0";
const DEFAULT_SERVER_NAME = "WeChatMCP";
const DEFAULT_INSTRUCTIONS =
  "WeChatMCP controls WeChat Mini Program projects through WeChat DevTools using automation, DevTools APIs, and CI upload tooling.";

const manager = new WeappAutomatorManager();
const cliOptions = parseCliArgs(process.argv.slice(2));
const fileConfig = readMergedRuntimeConfig().server ?? {};
const envConfig = runtimeServerSchema.parse({
  name: process.env.WECHATMCP_SERVER_NAME,
  instructions: process.env.WECHATMCP_SERVER_INSTRUCTIONS,
  transportType: normalizeTransportType(process.env.WECHATMCP_TRANSPORT),
  httpStream: {
    host: process.env.WECHATMCP_HOST,
    port: process.env.WECHATMCP_PORT,
    endpoint: process.env.WECHATMCP_ENDPOINT,
    enableJsonResponse: process.env.WECHATMCP_ENABLE_JSON_RESPONSE,
    stateless: process.env.WECHATMCP_STATELESS,
    sslCa: process.env.WECHATMCP_SSL_CA,
    sslCert: process.env.WECHATMCP_SSL_CERT,
    sslKey: process.env.WECHATMCP_SSL_KEY,
  },
  health: {
    enabled: process.env.WECHATMCP_HEALTH_ENABLED,
    path: process.env.WECHATMCP_HEALTH_PATH,
    message: process.env.WECHATMCP_HEALTH_MESSAGE,
    status: process.env.WECHATMCP_HEALTH_STATUS,
  },
});

const serverConfig = runtimeServerSchema.parse({
  ...fileConfig,
  ...envConfig,
  ...cliOptions,
  httpStream: {
    ...fileConfig.httpStream,
    ...envConfig.httpStream,
    ...cliOptions.httpStream,
  },
  health: {
    ...fileConfig.health,
    ...envConfig.health,
    ...cliOptions.health,
  },
});

const server = new FastMCP({
  name: serverConfig.name ?? DEFAULT_SERVER_NAME,
  version: SERVER_VERSION,
  instructions: serverConfig.instructions ?? DEFAULT_INSTRUCTIONS,
  health: runtimeHealthSchema.parse({
    enabled: serverConfig.health?.enabled ?? true,
    path: serverConfig.health?.path ?? "/health",
    message: serverConfig.health?.message ?? "ok",
    status: serverConfig.health?.status ?? 200,
  }),
});

const tools = createTools(manager).map((tool) => ({
  ...tool,
  timeoutMs: tool.timeoutMs ?? globalTimeoutMs,
}));
server.addTools(tools);

server.on("disconnect", async () => {
  await manager.close();
});

const transportType = serverConfig.transportType ?? "stdio";

if (transportType === "httpStream") {
  const httpStreamConfig = runtimeHttpStreamSchema.parse({
    host: serverConfig.httpStream?.host ?? "127.0.0.1",
    port: serverConfig.httpStream?.port ?? 3333,
    endpoint: serverConfig.httpStream?.endpoint ?? "/mcp",
    enableJsonResponse: serverConfig.httpStream?.enableJsonResponse ?? true,
    stateless: serverConfig.httpStream?.stateless ?? false,
    sslCa: serverConfig.httpStream?.sslCa,
    sslCert: serverConfig.httpStream?.sslCert,
    sslKey: serverConfig.httpStream?.sslKey,
  });

  await server.start({
    transportType: "httpStream",
    httpStream: {
      ...httpStreamConfig,
      port: httpStreamConfig.port ?? 3333,
      endpoint: (httpStreamConfig.endpoint ?? "/mcp") as `/${string}`,
    },
  });

  const protocol =
    httpStreamConfig.sslCert && httpStreamConfig.sslKey ? "https" : "http";
  console.log(
    `[WeChatMCP] HTTP MCP server listening on ${protocol}://${httpStreamConfig.host}:${httpStreamConfig.port}${httpStreamConfig.endpoint}`
  );
  if (serverConfig.health?.enabled !== false) {
    console.log(
      `[WeChatMCP] Health endpoint available at ${protocol}://${httpStreamConfig.host}:${httpStreamConfig.port}${serverConfig.health?.path ?? "/health"}`
    );
  }
} else {
  await server.start({
    transportType: "stdio",
  });
}

function parseCliArgs(argv: string[]): z.infer<typeof runtimeServerSchema> {
  const raw: Record<string, unknown> = {};
  const httpStream: Record<string, unknown> = {};
  const health: Record<string, unknown> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const nextValue = argv[index + 1];

    switch (flag) {
      case "--transport":
        raw.transportType = normalizeTransportType(nextValue);
        index += 1;
        break;
      case "--name":
        raw.name = nextValue;
        index += 1;
        break;
      case "--instructions":
        raw.instructions = nextValue;
        index += 1;
        break;
      case "--host":
        httpStream.host = nextValue;
        index += 1;
        break;
      case "--port":
        httpStream.port = nextValue;
        index += 1;
        break;
      case "--endpoint":
        httpStream.endpoint = nextValue;
        index += 1;
        break;
      case "--stateless":
        httpStream.stateless = true;
        break;
      case "--enable-json-response":
        httpStream.enableJsonResponse = true;
        break;
      case "--disable-json-response":
        httpStream.enableJsonResponse = false;
        break;
      case "--ssl-ca":
        httpStream.sslCa = nextValue;
        index += 1;
        break;
      case "--ssl-cert":
        httpStream.sslCert = nextValue;
        index += 1;
        break;
      case "--ssl-key":
        httpStream.sslKey = nextValue;
        index += 1;
        break;
      case "--health-path":
        health.path = nextValue;
        index += 1;
        break;
      case "--health-message":
        health.message = nextValue;
        index += 1;
        break;
      case "--health-status":
        health.status = nextValue;
        index += 1;
        break;
      case "--disable-health":
        health.enabled = false;
        break;
      default:
        break;
    }
  }

  if (Object.keys(httpStream).length > 0) {
    raw.httpStream = httpStream;
  }
  if (Object.keys(health).length > 0) {
    raw.health = health;
  }

  return runtimeServerSchema.parse(raw);
}

function normalizeTransportType(value: unknown): "httpStream" | "stdio" | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const normalized = value.trim();
  if (normalized === "http" || normalized === "streamable-http") {
    return "httpStream";
  }
  if (normalized === "stdio" || normalized === "httpStream") {
    return normalized;
  }
  return undefined;
}
