import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const DEFAULT_LOCAL_CONFIG_FILENAME = "wechatmcp.local.json";
const LEGACY_LOCAL_CONFIG_FILENAME = "weapp-dev.local.json";

const stringListSchema = z
  .union([z.string(), z.array(z.string()), z.undefined()])
  .transform((value) => {
    if (!value) {
      return undefined;
    }
    const list = Array.isArray(value) ? value : value.split(/\s+/);
    const normalized = list.map((item) => item.trim()).filter(Boolean);
    return normalized.length ? normalized : undefined;
  });

export const runtimeConnectionSchema = z
  .object({
    mode: z.enum(["launch", "connect"]).optional(),
    cliPath: z.string().trim().min(1).optional(),
    projectPath: z.string().trim().min(1).optional(),
    wsEndpoint: z.string().trim().min(1).optional(),
    timeout: z.coerce.number().int().positive().optional(),
    port: z.coerce.number().int().positive().optional(),
    account: z.string().trim().min(1).optional(),
    ticket: z.string().trim().min(1).optional(),
    trustProject: z.coerce.boolean().optional(),
    args: stringListSchema,
    cwd: z.string().trim().min(1).optional(),
    autoClose: z.coerce.boolean().optional(),
  })
  .strict();

export const runtimeCiDefaultsSchema = z
  .object({
    projectPath: z.string().trim().min(1).optional(),
    appid: z.string().trim().min(1).optional(),
    type: z
      .enum(["miniProgram", "miniGame", "miniProgramPlugin", "miniGamePlugin"])
      .optional(),
    privateKeyPath: z.string().trim().min(1).optional(),
    ignores: stringListSchema,
    robot: z.coerce.number().int().positive().optional(),
    threads: z.coerce.number().int().positive().optional(),
    useCOS: z.coerce.boolean().optional(),
    setting: z.record(z.unknown()).optional(),
    qrcodeFormat: z.enum(["image", "base64", "terminal"]).optional(),
    qrcodeOutputDest: z.string().trim().min(1).optional(),
  })
  .strict();

export const runtimeLocalConfigFileSchema = z
  .object({
    server: z.unknown().optional(),
    connection: runtimeConnectionSchema.optional(),
    ciDefaults: runtimeCiDefaultsSchema.optional(),
  })
  .strict();

export type RuntimeLocalConfigFile = z.infer<typeof runtimeLocalConfigFileSchema>;

export function getProjectRootPath(): string {
  return path.resolve(fileURLToPath(new URL("../", import.meta.url)));
}

export function resolveLocalRuntimeConfigPath(customPath?: string): string {
  const envPath = process.env.WECHATMCP_LOCAL_CONFIG?.trim();
  const candidate = customPath?.trim() || envPath || DEFAULT_LOCAL_CONFIG_FILENAME;
  return path.resolve(getProjectRootPath(), candidate);
}

export function readLocalRuntimeConfig(options?: {
  localConfigPath?: string;
}): RuntimeLocalConfigFile {
  const localConfigPath = resolveLocalRuntimeConfigPath(options?.localConfigPath);
  const localConfig = readRuntimeConfigFile(localConfigPath);
  if (Object.keys(localConfig).length > 0) {
    return localConfig;
  }

  const legacyPath = path.resolve(getProjectRootPath(), LEGACY_LOCAL_CONFIG_FILENAME);
  return readRuntimeConfigFile(legacyPath);
}

export function writeLocalRuntimeConfig(
  patch: RuntimeLocalConfigFile,
  options?: {
    localConfigPath?: string;
  }
): { config: RuntimeLocalConfigFile; configPath: string } {
  const localConfigPath = resolveLocalRuntimeConfigPath(options?.localConfigPath);
  const current = readLocalRuntimeConfig({
    localConfigPath: options?.localConfigPath,
  });
  const next = runtimeLocalConfigFileSchema.parse({
    connection: {
      ...current.connection,
      ...patch.connection,
    },
    ciDefaults: {
      ...current.ciDefaults,
      ...patch.ciDefaults,
    },
  });

  fs.mkdirSync(path.dirname(localConfigPath), { recursive: true });
  fs.writeFileSync(localConfigPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  return {
    config: next,
    configPath: localConfigPath,
  };
}

function readRuntimeConfigFile(filePath: string): RuntimeLocalConfigFile {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return runtimeLocalConfigFileSchema.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read config file ${filePath}: ${message}`);
  }
}
