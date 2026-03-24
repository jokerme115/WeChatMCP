import { z } from "zod";

import {
  readLocalRuntimeConfig,
  runtimeConnectionSchema,
} from "./runtimeConfig.js";

export type AutomatorMode = "launch" | "connect";

export interface WeappConnectionConfig {
  mode: AutomatorMode;
  cliPath?: string;
  projectPath?: string;
  wsEndpoint?: string;
  timeout?: number;
  port?: number;
  account?: string;
  ticket?: string;
  trustProject?: boolean;
  args?: string[];
  cwd?: string;
  autoClose?: boolean;
}

export class ConfigError extends Error {}

export const connectionOverridesSchema = runtimeConnectionSchema;

export type ConnectionOverrides = z.infer<typeof connectionOverridesSchema>;

function fromPrevious(previous?: WeappConnectionConfig): ConnectionOverrides {
  const base: ConnectionOverrides = {};
  if (!previous) {
    return base;
  }
  base.mode = previous.mode;
  if (previous.cliPath) base.cliPath = previous.cliPath;
  if (previous.projectPath) base.projectPath = previous.projectPath;
  if (previous.wsEndpoint) base.wsEndpoint = previous.wsEndpoint;
  if (typeof previous.timeout === "number") base.timeout = previous.timeout;
  if (typeof previous.port === "number") base.port = previous.port;
  if (previous.account) base.account = previous.account;
  if (previous.ticket) base.ticket = previous.ticket;
  if (typeof previous.trustProject === "boolean") {
    base.trustProject = previous.trustProject;
  }
  if (previous.args?.length) base.args = previous.args;
  if (previous.cwd) base.cwd = previous.cwd;
  if (typeof previous.autoClose === "boolean") {
    base.autoClose = previous.autoClose;
  }
  return base;
}

export function resolveConfig(
  overrides?: ConnectionOverrides,
  previous?: WeappConnectionConfig
): WeappConnectionConfig {
  const fileInput = readLocalRuntimeConfig().connection ?? {};
  const envInput: ConnectionOverrides = connectionOverridesSchema.parse({
    mode: process.env.WEAPP_AUTOMATOR_MODE,
    cliPath: process.env.WECHAT_DEVTOOLS_CLI_PATH,
    projectPath: process.env.WEAPP_PROJECT_PATH,
    wsEndpoint: process.env.WEAPP_WS_ENDPOINT,
    timeout: process.env.WEAPP_DEVTOOLS_TIMEOUT,
    port: process.env.WEAPP_DEVTOOLS_PORT,
    account: process.env.WEAPP_AUTO_ACCOUNT,
    ticket: process.env.WEAPP_DEVTOOLS_TICKET,
    trustProject: process.env.WEAPP_TRUST_PROJECT,
    args: process.env.WEAPP_DEVTOOLS_ARGS,
    cwd: process.env.WEAPP_DEVTOOLS_CWD,
    autoClose: process.env.WEAPP_AUTOCLOSE,
  });

  const base = fromPrevious(previous);
  const overrideConfig = overrides
    ? connectionOverridesSchema.parse(overrides)
    : {};

  const merged: ConnectionOverrides = {
    ...base,
    ...fileInput,
    ...envInput,
    ...overrideConfig,
  };

  const mode: AutomatorMode =
    merged.mode ??
    (merged.wsEndpoint ? "connect" : previous?.mode ?? "launch");

  const config: WeappConnectionConfig = {
    mode,
    cliPath: merged.cliPath,
    projectPath: merged.projectPath,
    wsEndpoint: merged.wsEndpoint,
    timeout: merged.timeout,
    port: merged.port,
    account: merged.account,
    ticket: merged.ticket,
    trustProject: merged.trustProject,
    args: merged.args,
    cwd: merged.cwd,
    autoClose: merged.autoClose,
  };

  if (config.mode === "connect") {
    if (!config.wsEndpoint) {
      throw new ConfigError(
        "WeChat DevTools websocket endpoint is required. Provide connection.wsEndpoint."
      );
    }
  } else if (!config.projectPath) {
    throw new ConfigError(
      "Mini Program project path is required. Provide connection.projectPath."
    );
  }

  return config;
}

export const globalTimeoutMs = 15000;
