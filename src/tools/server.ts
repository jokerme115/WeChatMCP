import fs from "node:fs";

import { z } from "zod";

import {
  readMergedRuntimeConfig,
  resolveLocalRuntimeConfigPath,
  resolveRuntimeConfigPath,
} from "../runtimeConfig.js";
import { AnyTool, formatJson, toTextResult } from "./common.js";

const runtimeInfoParameters = z.object({
  includeConfig: z.coerce.boolean().optional().default(true),
});

const SERVER_VERSION = "0.3.1";

export function createServerTools(): AnyTool[] {
  return [createRuntimeInfoTool()];
}

function createRuntimeInfoTool(): AnyTool {
  return {
    name: "server_runtimeInfo",
    description:
      "Return deployment-friendly runtime information for WeChatMCP, including whether local WeChat resources are configured.",
    parameters: runtimeInfoParameters,
    execute: async (rawArgs) => {
      const args = runtimeInfoParameters.parse(rawArgs ?? {});
      const sharedConfigPath = resolveRuntimeConfigPath();
      const localConfigPath = resolveLocalRuntimeConfigPath();

      let mergedConfig: ReturnType<typeof readMergedRuntimeConfig> | undefined;
      let configError: string | null = null;

      try {
        mergedConfig = readMergedRuntimeConfig();
      } catch (error) {
        configError = error instanceof Error ? error.message : String(error);
      }

      return toTextResult(
        formatJson({
          server: {
            name: "WeChatMCP",
            version: process.env.npm_package_version ?? SERVER_VERSION,
          },
          runtime: {
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            pid: process.pid,
            cwd: process.cwd(),
          },
          transport: {
            requested:
              process.env.WECHATMCP_TRANSPORT ??
              mergedConfig?.server?.transportType ??
              "stdio",
            httpStreamConfigured: Boolean(
              mergedConfig?.server?.httpStream?.host ||
                mergedConfig?.server?.httpStream?.port ||
                mergedConfig?.server?.httpStream?.endpoint
            ),
          },
          deployment: {
            modelscopeHostedReady: true,
            note: "WeChatMCP can start without local WeChat resources and can pass MCP tool discovery. Actual Mini Program automation, DevTools control, preview, and upload tools still require local WeChat DevTools, project files, or credentials.",
          },
          config: args.includeConfig
            ? {
                sharedConfigPath,
                localConfigPath,
                sharedConfigExists: fs.existsSync(sharedConfigPath),
                localConfigExists: fs.existsSync(localConfigPath),
                parseError: configError,
                connectionConfigured: {
                  projectPath: Boolean(mergedConfig?.connection?.projectPath),
                  cliPath: Boolean(mergedConfig?.connection?.cliPath),
                  wsEndpoint: Boolean(mergedConfig?.connection?.wsEndpoint),
                  port: mergedConfig?.connection?.port ?? null,
                },
                ciConfigured: {
                  projectPath: Boolean(mergedConfig?.ciDefaults?.projectPath),
                  appid: Boolean(mergedConfig?.ciDefaults?.appid),
                  privateKeyPath: Boolean(
                    mergedConfig?.ciDefaults?.privateKeyPath
                  ),
                },
              }
            : undefined,
        })
      );
    },
  };
}
