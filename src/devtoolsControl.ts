import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const WINDOWS_CLI_CANDIDATES = [
  "C:/Program Files (x86)/Tencent/\u5fae\u4fe1web\u5f00\u53d1\u8005\u5de5\u5177/cli.bat",
  "C:/Program Files/Tencent/\u5fae\u4fe1web\u5f00\u53d1\u8005\u5de5\u5177/cli.bat",
];
const DEFAULT_MACOS_CLI_PATH =
  "/Applications/wechatwebdevtools.app/Contents/MacOS/cli";

export interface CliExecutionResult {
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export function resolveDevtoolsCliPath(cliPath?: string): string {
  if (cliPath) {
    return cliPath;
  }
  if (process.platform === "win32") {
    return resolveExistingPath(WINDOWS_CLI_CANDIDATES) ?? WINDOWS_CLI_CANDIDATES[0];
  }
  if (process.platform === "darwin") {
    return DEFAULT_MACOS_CLI_PATH;
  }
  return "cli";
}

export function resolveWindowsCliCommand(cliPath: string): {
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

export async function runDevtoolsCliCommand(options: {
  cliPath?: string;
  args: string[];
  cwd?: string;
  timeoutMs?: number;
}): Promise<CliExecutionResult> {
  const cliPath = resolveDevtoolsCliPath(options.cliPath);
  const { command, args: commandArgs } =
    process.platform === "win32"
      ? resolveWindowsCliCommand(cliPath)
      : { command: cliPath, args: [] };

  const timeoutMs = options.timeoutMs ?? 120000;

  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, [...commandArgs, ...options.args], {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timeout: NodeJS.Timeout | undefined;

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(Buffer.from(chunk));
    });
    child.once("error", reject);
    child.once("close", (exitCode) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve({
        command,
        args: [...commandArgs, ...options.args],
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
      });
    });

    if (timeoutMs > 0) {
      timeout = setTimeout(() => {
        child.kill();
        reject(
          new Error(
            `Timed out running DevTools CLI after ${timeoutMs}ms: ${command}`
          )
        );
      }, timeoutMs);
    }
  });
}

export interface HttpPortDiscovery {
  port: number;
  sourceFile: string;
  candidates: Array<{
    file: string;
    port: number;
    mtimeMs: number;
  }>;
}

export function discoverDevtoolsHttpPort(
  preferredPort?: number
): HttpPortDiscovery {
  if (typeof preferredPort === "number") {
    return {
      port: preferredPort,
      sourceFile: "(explicit)",
      candidates: [],
    };
  }

  const ideFiles = findIdePortFiles();
  const candidates = ideFiles
    .map((file) => {
      try {
        const raw = fs.readFileSync(file, "utf8").trim();
        const port = Number.parseInt(raw, 10);
        if (!Number.isFinite(port) || port <= 0) {
          return null;
        }
        return {
          file,
          port,
          mtimeMs: fs.statSync(file).mtimeMs,
        };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (!candidates.length) {
    throw new Error(
      "Unable to discover the DevTools HTTP port. Start WeChat DevTools and enable HTTP debugging first."
    );
  }

  return {
    port: candidates[0].port,
    sourceFile: candidates[0].file,
    candidates,
  };
}

function findIdePortFiles(): string[] {
  const roots: string[] = [];
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      roots.push(
        path.join(
          localAppData,
          "\u5fae\u4fe1\u5f00\u53d1\u8005\u5de5\u5177",
          "User Data"
        )
      );
    }
  } else if (process.platform === "darwin") {
    roots.push(
      path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "\u5fae\u4fe1\u5f00\u53d1\u8005\u5de5\u5177"
      )
    );
  }

  const results: string[] = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) {
      continue;
    }
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const ideFile = path.join(root, entry.name, "Default", ".ide");
      if (fs.existsSync(ideFile)) {
        results.push(ideFile);
      }
    }
  }
  return results;
}

export function normalizeHttpEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    throw new Error("HTTP endpoint is required.");
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  return `/v2/${trimmed.replace(/^v2\//, "")}`;
}

function resolveExistingPath(paths: string[]): string | undefined {
  return paths.find((candidate) => fs.existsSync(candidate));
}
