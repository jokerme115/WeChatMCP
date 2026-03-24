import childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

import { UserError, type SerializableValue } from "fastmcp";
import automator from "miniprogram-automator";

import {
  ConfigError,
  resolveConfig,
  type ConnectionOverrides,
  type WeappConnectionConfig,
} from "./config.js";

type ToolLogger = {
  debug: (message: string, data?: SerializableValue) => void;
  info: (message: string, data?: SerializableValue) => void;
  warn: (message: string, data?: SerializableValue) => void;
  error: (message: string, data?: SerializableValue) => void;
};

interface UseOptions {
  overrides?: ConnectionOverrides;
  reconnect?: boolean;
}

const DEFAULT_WINDOWS_CLI_PATH =
  "C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat";
const DEFAULT_CONNECT_TIMEOUT_MS = 30000;
const DEFAULT_PAGE_WAIT_TIMEOUT_MS = 15000;
const PAGE_POLL_INTERVAL_MS = 1000;

export interface ConsoleLogEntry {
  type: string;
  message: string;
  timestamp: number;
  data?: SerializableValue;
}

export class WeappAutomatorManager {
  private miniProgram?: MiniProgramInstance;
  private config?: WeappConnectionConfig;
  private consoleLogs: ConsoleLogEntry[] = [];
  private maxLogs = 1000; // 最多保存1000条日志

  hasActiveSession(): boolean {
    return Boolean(this.miniProgram);
  }

  getConsoleLogs(): ConsoleLogEntry[] {
    return [...this.consoleLogs];
  }

  clearConsoleLogs(): void {
    this.consoleLogs = [];
  }

  async withMiniProgram<T>(
    log: ToolLogger,
    options: UseOptions,
    handler: (
      miniProgram: MiniProgramInstance,
      config: WeappConnectionConfig
    ) => Promise<T>
  ): Promise<T> {
    const { overrides, reconnect } = options;
    let config: WeappConnectionConfig;
    try {
      config = resolveConfig(overrides, this.config);
    } catch (error) {
      if (error instanceof ConfigError) {
        throw new UserError(error.message);
      }
      throw error;
    }

    if (reconnect) {
      await this.close(log);
    }

    const canReuse =
      this.miniProgram && this.config && isSameConfig(this.config, config);
    if (!canReuse) {
      await this.close(log);
      log.info("Establishing WeChat DevTools automation session", {
        mode: config.mode,
        projectPath: config.projectPath,
        wsEndpoint: config.wsEndpoint,
        port: config.port,
      });
      try {
        this.miniProgram = await this.connect(config);
        this.config = config;
        this.attachLogging(this.miniProgram, log);
      } catch (error) {
        this.miniProgram = undefined;
        this.config = undefined;
        const message = error instanceof Error ? error.message : String(error);
        throw new UserError(
          `Failed to ${
            config.mode === "connect" ? "connect to" : "launch"
          } WeChat DevTools: ${message}`
        );
      }
    }

    const activeProgram = this.miniProgram!;
    try {
      return await handler(activeProgram, config);
    } finally {
      if (config.autoClose) {
        await this.close(log);
      }
    }
  }

  async withPage<T>(
    log: ToolLogger,
    options: UseOptions,
    handler: (
      page: PageInstance,
      miniProgram: MiniProgramInstance,
      config: WeappConnectionConfig
    ) => Promise<T>
  ): Promise<T> {
    return this.withMiniProgram(log, options, async (miniProgram, config) => {
      const page = await this.waitForPage(
        miniProgram,
        config.timeout ?? DEFAULT_PAGE_WAIT_TIMEOUT_MS
      );
      if (!page) {
        throw new UserError(
          "Mini Program page stack is empty. Ensure the project window is open."
        );
      }
      return handler(page, miniProgram, config);
    });
  }

  async close(log?: ToolLogger): Promise<void> {
    if (!this.miniProgram) {
      return;
    }

    try {
      this.miniProgram.disconnect();
      log?.debug("Closed WeChat DevTools automation session");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log?.warn("Failed to close WeChat DevTools cleanly", { message });
    } finally {
      this.miniProgram.removeAllListeners();
      this.miniProgram = undefined;
      this.config = undefined;
    }
  }

  async closeProject(log?: ToolLogger): Promise<void> {
    if (!this.miniProgram) {
      return;
    }

    try {
      await this.miniProgram.close();
      log?.debug("Closed WeChat DevTools project window");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log?.warn("Failed to close WeChat DevTools project cleanly", { message });
    } finally {
      this.miniProgram.removeAllListeners();
      this.miniProgram = undefined;
      this.config = undefined;
    }
  }

  private async connect(
    config: WeappConnectionConfig
  ): Promise<MiniProgramInstance> {
    if (config.mode === "connect") {
      return automator.connect({ wsEndpoint: config.wsEndpoint! });
    }

    if (process.platform === "win32") {
      return this.launchOnWindows(config);
    }

    return automator.launch({
      cliPath: config.cliPath,
      projectPath: config.projectPath!,
      timeout: config.timeout,
      port: config.port,
      account: config.account,
      ticket: config.ticket,
      trustProject: config.trustProject,
      args: config.args,
      cwd: config.cwd,
    });
  }

  private async launchOnWindows(
    config: WeappConnectionConfig
  ): Promise<MiniProgramInstance> {
    const cliPath = config.cliPath ?? DEFAULT_WINDOWS_CLI_PATH;
    const projectPath = resolveLaunchProjectPath(path.resolve(config.projectPath!));

    if (!fs.existsSync(cliPath)) {
      throw new Error(
        `WeChat DevTools CLI was not found at ${cliPath}. Set connection.cliPath or WECHAT_DEVTOOLS_CLI_PATH.`
      );
    }

    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project path ${projectPath} doesn't exist`);
    }

    const port = await resolveLaunchPort(config.port);
    const { command, args: commandArgs } = resolveWindowsCliCommand(cliPath);
    const launchArgs = buildWindowsLaunchArgs(projectPath, port, config);
    let spawnError: Error | undefined;

    const child = childProcess.spawn(command, [...commandArgs, ...launchArgs], {
      cwd: config.cwd,
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("error", error => {
      spawnError = error;
    });
    child.unref();

    return this.waitForMiniProgram(
      `ws://127.0.0.1:${port}`,
      config.timeout ?? DEFAULT_CONNECT_TIMEOUT_MS,
      () => spawnError
    );
  }

  private async waitForMiniProgram(
    wsEndpoint: string,
    timeoutMs: number,
    getSpawnError?: () => Error | undefined
  ): Promise<MiniProgramInstance> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;

    while (Date.now() < deadline) {
      const spawnError = getSpawnError?.();
      if (spawnError) {
        throw spawnError;
      }

      try {
        return await withTimeout(
          automator.connect({ wsEndpoint }),
          Math.min(5000, Math.max(deadline - Date.now(), 1000)),
          `Timed out connecting to ${wsEndpoint}`
        );
      } catch (error) {
        lastError = error;
      }

      if (Date.now() >= deadline) {
        break;
      }
      await delay(PAGE_POLL_INTERVAL_MS);
    }

    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new Error(
      `Timed out waiting for WeChat DevTools automation endpoint at ${wsEndpoint}`
    );
  }

  private async waitForPage(
    miniProgram: MiniProgramInstance,
    timeoutMs: number
  ): Promise<PageInstance | undefined> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;

    while (Date.now() < deadline) {
      try {
        const page = await withTimeout(
          miniProgram.currentPage(),
          Math.min(5000, Math.max(deadline - Date.now(), 1000)),
          "Timed out waiting for the Mini Program page to become ready"
        );
        if (page) {
          return page;
        }
      } catch (error) {
        lastError = error;
      }

      if (Date.now() >= deadline) {
        break;
      }
      await delay(PAGE_POLL_INTERVAL_MS);
    }

    if (lastError instanceof Error) {
      throw new UserError(
        `Connected to WeChat DevTools, but the Mini Program page is not ready yet: ${lastError.message}`
      );
    }

    return undefined;
  }

  private attachLogging(miniProgram: MiniProgramInstance, log: ToolLogger) {
    const enableLog = (
      miniProgram as unknown as { send?: (method: string) => Promise<unknown> }
    ).send;
    if (typeof enableLog === "function") {
      void enableLog.call(miniProgram, "App.enableLog").catch(() => {
        // Ignore logging bootstrap failures so disconnects do not surface as unhandled rejections.
      });
    }

    EventEmitter.prototype.on.call(miniProgram, "console", (event: unknown) => {
      const serialized = toSerializable(event);
      const args = (event as any)?.args;
      const logEntry: ConsoleLogEntry = {
        type: typeof (event as any)?.type === "string" ? (event as any).type : "log",
        message: Array.isArray(args) ? args.map(arg => typeof arg === "string" ? arg : JSON.stringify(arg)).join(" ") : String(serialized),
        timestamp: Date.now(),
        data: serialized,
      };
      
      // 保存日志，限制数量
      this.consoleLogs.push(logEntry);
      if (this.consoleLogs.length > this.maxLogs) {
        this.consoleLogs.shift();
      }
      
      log.debug("Mini Program console event", {
        event: serialized,
      });
    });
    EventEmitter.prototype.on.call(miniProgram, "exception", (event: unknown) => {
      const serialized = toSerializable(event);
      const logEntry: ConsoleLogEntry = {
        type: "exception",
        message: typeof (event as any)?.message === "string" ? (event as any).message : String(serialized),
        timestamp: Date.now(),
        data: serialized,
      };
      
      // 保存异常日志
      this.consoleLogs.push(logEntry);
      if (this.consoleLogs.length > this.maxLogs) {
        this.consoleLogs.shift();
      }
      
      log.error("Mini Program exception", {
        event: serialized,
      });
    });
  }
}

type MiniProgramInstance = Awaited<ReturnType<typeof automator.launch>>;
type PageInstance = NonNullable<
  Awaited<ReturnType<MiniProgramInstance["currentPage"]>>
>;

function toSerializable(value: unknown): SerializableValue {
  if (value === null || value === undefined) {
    return value as SerializableValue;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toSerializable(item)) as SerializableValue;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, val]) => [key, toSerializable(val)]
    );
    return Object.fromEntries(entries) as SerializableValue;
  }
  return String(value) as SerializableValue;
}

function isSameConfig(
  a: WeappConnectionConfig,
  b: WeappConnectionConfig
): boolean {
  return (
    a.mode === b.mode &&
    a.cliPath === b.cliPath &&
    a.projectPath === b.projectPath &&
    a.wsEndpoint === b.wsEndpoint &&
    a.timeout === b.timeout &&
    a.port === b.port &&
    a.account === b.account &&
    a.ticket === b.ticket &&
    a.trustProject === b.trustProject &&
    a.cwd === b.cwd &&
    a.autoClose === b.autoClose &&
    areArgsEqual(a.args, b.args)
  );
}

function areArgsEqual(a?: string[], b?: string[]): boolean {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

function resolveWindowsCliCommand(cliPath: string): {
  command: string;
  args: string[];
} {
  if (!cliPath.toLowerCase().endsWith(".bat")) {
    return { command: cliPath, args: [] };
  }

  const baseDir = path.dirname(cliPath);
  const nodePath = path.join(baseDir, "node.exe");
  const modernCliScript = path.join(
    baseDir,
    "code",
    "package.nw",
    "js",
    "common",
    "cli",
    "index.js"
  );
  const legacyCliScript = path.join(baseDir, "cli.js");

  if (fs.existsSync(nodePath) && fs.existsSync(modernCliScript)) {
    return { command: nodePath, args: [modernCliScript] };
  }

  if (fs.existsSync(nodePath) && fs.existsSync(legacyCliScript)) {
    return { command: nodePath, args: [legacyCliScript] };
  }

  return { command: cliPath, args: [] };
}

function resolveLaunchProjectPath(projectPath: string): string {
  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    return projectPath;
  }

  const projectConfigPath = path.join(projectPath, "project.config.json");
  if (!fs.existsSync(projectConfigPath)) {
    return projectPath;
  }

  try {
    const projectConfig = JSON.parse(
      fs.readFileSync(projectConfigPath, "utf8")
    ) as { miniprogramRoot?: string };
    const miniprogramRoot = projectConfig.miniprogramRoot?.trim();
    if (!miniprogramRoot || miniprogramRoot === "./" || miniprogramRoot === ".") {
      return projectPath;
    }

    const candidatePath = path.resolve(projectPath, miniprogramRoot);
    const candidateAppJsonPath = path.join(candidatePath, "app.json");
    if (fs.existsSync(candidateAppJsonPath)) {
      return candidatePath;
    }
  } catch {
    // Ignore malformed project config and keep the original path.
  }

  return projectPath;
}

function buildWindowsLaunchArgs(
  projectPath: string,
  port: number,
  config: WeappConnectionConfig
): string[] {
  const args = [...(config.args ?? []), "auto", "--project", projectPath, "--auto-port", String(port)];

  if (config.account) {
    args.push("--auto-account", config.account);
  } else if (config.ticket) {
    args.push("--ticket", config.ticket);
  }

  if (config.trustProject) {
    args.push("--trust-project");
  }

  return args;
}

async function resolveLaunchPort(preferredPort?: number): Promise<number> {
  if (typeof preferredPort === "number") {
    if (!(await isPortAvailable(preferredPort))) {
      throw new Error(
        `Port ${preferredPort} is in use, please specify another port`
      );
    }
    return preferredPort;
  }

  if (await isPortAvailable(9420)) {
    return 9420;
  }

  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate a free port")));
        return;
      }

      server.close(closeError => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function delay(waitMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, waitMs));
}
