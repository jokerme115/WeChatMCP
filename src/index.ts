#!/usr/bin/env node

import { FastMCP } from "fastmcp";

import { globalTimeoutMs } from "./config.js";
import { createTools } from "./tools.js";
import { WeappAutomatorManager } from "./weappClient.js";

const SERVER_VERSION = "0.2.1";
const SERVER_NAME = "WeChatMCP";
const SERVER_INSTRUCTIONS =
  "WeChatMCP is a local stdio MCP server for WeChat Mini Program automation, DevTools control, and CI workflows.";

const manager = new WeappAutomatorManager();

const server = new FastMCP({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  instructions: SERVER_INSTRUCTIONS,
});

const tools = createTools(manager).map((tool) => ({
  ...tool,
  timeoutMs: tool.timeoutMs ?? globalTimeoutMs,
}));
server.addTools(tools);

server.on("disconnect", async () => {
  await manager.close();
});

await server.start({
  transportType: "stdio",
});
