import { UserError, type ContentResult } from "fastmcp";
import { z } from "zod";

import {
  discoverDevtoolsHttpPort,
  normalizeHttpEndpoint,
  runDevtoolsCliCommand,
} from "../devtoolsControl.js";
import {
  AnyTool,
  ToolContext,
  connectionContainerSchema,
  formatJson,
  stringListSchema,
  toSerializableValue,
  toTextResult,
} from "./common.js";

const cliParameters = connectionContainerSchema.extend({
  args: stringListSchema.refine(
    (value) => Array.isArray(value) && value.length > 0,
    "CLI args are required."
  ),
  timeoutMs: z.coerce.number().int().positive().optional(),
});

const httpPortParameters = connectionContainerSchema.extend({
  port: z.coerce.number().int().positive().optional(),
});

const httpRequestParameters = connectionContainerSchema.extend({
  port: z.coerce.number().int().positive().optional(),
  endpoint: z.string().trim().min(1),
  method: z.enum(["GET", "POST"]).optional().default("GET"),
  query: z
    .record(z.union([z.string(), z.coerce.number(), z.coerce.boolean()]))
    .optional(),
  body: z.record(z.unknown()).optional(),
});

export function createDevtoolsTools(): AnyTool[] {
  return [
    createDevtoolsHttpPortTool(),
    createDevtoolsHttpRequestTool(),
    createDevtoolsCliTool(),
  ];
}

function createDevtoolsHttpPortTool(): AnyTool {
  return {
    name: "dt_httpPort",
    description:
      "Discover the WeChat DevTools HTTP service port from the local .ide files.",
    parameters: httpPortParameters,
    execute: async (rawArgs) => {
      const args = httpPortParameters.parse(rawArgs ?? {});
      const result = discoverDevtoolsHttpPort(args.port ?? args.connection?.port);
      return toTextResult(
        formatJson({
          port: result.port,
          sourceFile: result.sourceFile,
          candidates: result.candidates,
        })
      );
    },
  };
}

function createDevtoolsHttpRequestTool(): AnyTool {
  return {
    name: "dt_httpRequest",
    description:
      "Call any WeChat DevTools HTTP v2 endpoint, for example islogin, open, preview, upload, buildnpm, cloud/*.",
    parameters: httpRequestParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = httpRequestParameters.parse(rawArgs ?? {});
      const discovery = discoverDevtoolsHttpPort(args.port ?? args.connection?.port);
      const endpoint = normalizeHttpEndpoint(args.endpoint);
      const url = new URL(`http://127.0.0.1:${discovery.port}${endpoint}`);

      if (args.query) {
        for (const [key, value] of Object.entries(args.query)) {
          url.searchParams.set(key, String(value));
        }
      }

      context.log.info("Calling DevTools HTTP endpoint", {
        url: url.toString(),
        method: args.method,
      });

      const response = await fetch(url, {
        method: args.method,
        headers: args.body
          ? {
              "content-type": "application/json",
            }
          : undefined,
        body: args.body ? JSON.stringify(args.body) : undefined,
      });

      const contentType = response.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");
      const isText =
        isJson || contentType.startsWith("text/") || !contentType || contentType.includes("charset=");

      let body: unknown;
      if (isJson) {
        body = await response.json().catch(() => null);
      } else if (isText) {
        body = await response.text();
      } else {
        const bytes = Buffer.from(await response.arrayBuffer());
        body = {
          base64: bytes.toString("base64"),
          byteLength: bytes.length,
        };
      }

      if (!response.ok) {
        throw new UserError(
          `DevTools HTTP request failed with ${response.status}: ${JSON.stringify(body)}`
        );
      }

      return toTextResult(
        formatJson({
          port: discovery.port,
          endpoint,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: toSerializableValue(body),
        })
      );
    },
  };
}

function createDevtoolsCliTool(): AnyTool {
  return {
    name: "dt_cli",
    description:
      "Run any WeChat DevTools CLI command, for example islogin, open, preview, upload, build-npm, auto-replay, cloud ...",
    parameters: cliParameters,
    execute: async (rawArgs, context: ToolContext): Promise<ContentResult> => {
      const args = cliParameters.parse(rawArgs ?? {});
      const result = await runDevtoolsCliCommand({
        cliPath: args.connection?.cliPath,
        cwd: args.connection?.cwd,
        args: args.args ?? [],
        timeoutMs: args.timeoutMs,
      });

      context.log.info("Ran DevTools CLI command", {
        command: result.command,
        args: result.args,
        exitCode: result.exitCode,
      });

      if (result.exitCode !== 0) {
        throw new UserError(
          `DevTools CLI failed with exit code ${result.exitCode}: ${result.stderr || result.stdout}`
        );
      }

      return toTextResult(
        formatJson({
          command: result.command,
          args: result.args,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
        })
      );
    },
  };
}

