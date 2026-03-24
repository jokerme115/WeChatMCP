import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const DEFAULT_CONFIG_FILENAME = "wechatmcp.config.json";
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

export const runtimeHealthSchema = z
  .object({
    enabled: z.coerce.boolean().optional(),
    path: z.string().trim().min(1).optional(),
    message: z.string().optional(),
    status: z.coerce.number().int().positive().optional(),
  })
  .strict();

export const runtimeHttpStreamSchema = z
  .object({
    host: z.string().trim().min(1).optional(),
    port: z.coerce.number().int().positive().optional(),
    endpoint: z.string().trim().min(1).optional(),
    enableJsonResponse: z.coerce.boolean().optional(),
    stateless: z.coerce.boolean().optional(),
    sslCa: z.string().trim().min(1).optional(),
    sslCert: z.string().trim().min(1).optional(),
    sslKey: z.string().trim().min(1).optional(),
  })
  .strict();

export const runtimeServerSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    instructions: z.string().trim().min(1).optional(),
    transportType: z.enum(["stdio", "httpStream"]).optional(),
    httpStream: runtimeHttpStreamSchema.optional(),
    health: runtimeHealthSchema.optional(),
  })
  .strict();

export const runtimeConfigFileSchema = z
  .object({
    server: runtimeServerSchema.optional(),
    connection: runtimeConnectionSchema.optional(),
    ciDefaults: runtimeCiDefaultsSchema.optional(),
  })
  .strict();

export type RuntimeConfigFile = z.infer<typeof runtimeConfigFileSchema>;

export function getProjectRootPath(): string {
  return path.resolve(fileURLToPath(new URL("../", import.meta.url)));
}

export function resolveRuntimeConfigPath(customPath?: string): string {
  const envPath = process.env.WECHATMCP_CONFIG?.trim();
  const candidate = customPath?.trim() || envPath || DEFAULT_CONFIG_FILENAME;
  return path.resolve(getProjectRootPath(), candidate);
}

export function resolveLocalRuntimeConfigPath(customPath?: string): string {
  const envPath = process.env.WECHATMCP_LOCAL_CONFIG?.trim();
  const candidate = customPath?.trim() || envPath || DEFAULT_LOCAL_CONFIG_FILENAME;
  return path.resolve(getProjectRootPath(), candidate);
}

export function readMergedRuntimeConfig(options?: {
  configPath?: string;
  localConfigPath?: string;
}): RuntimeConfigFile {
  const sharedConfig = readRuntimeConfigFile(resolveRuntimeConfigPath(options?.configPath));
  const localConfigPath = resolveLocalRuntimeConfigPath(options?.localConfigPath);
  const localConfig = readLocalRuntimeConfigWithLegacyFallback(localConfigPath);
  return mergeRuntimeConfig(sharedConfig, localConfig);
}

export function writeLocalRuntimeConfig(
  patch: RuntimeConfigFile,
  options?: {
    localConfigPath?: string;
  }
): { config: RuntimeConfigFile; configPath: string } {
  const localConfigPath = resolveLocalRuntimeConfigPath(options?.localConfigPath);
  const current = readLocalRuntimeConfigWithLegacyFallback(localConfigPath);
  const next = runtimeConfigFileSchema.parse(mergeRuntimeConfig(current, patch));

  fs.mkdirSync(path.dirname(localConfigPath), { recursive: true });
  fs.writeFileSync(localConfigPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  return {
    config: next,
    configPath: localConfigPath,
  };
}

function readLocalRuntimeConfigWithLegacyFallback(localConfigPath: string): RuntimeConfigFile {
  const localConfig = readRuntimeConfigFile(localConfigPath);
  if (Object.keys(localConfig).length > 0) {
    return localConfig;
  }

  const legacyPath = path.resolve(getProjectRootPath(), LEGACY_LOCAL_CONFIG_FILENAME);
  return readRuntimeConfigFile(legacyPath);
}

function readRuntimeConfigFile(filePath: string): RuntimeConfigFile {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return runtimeConfigFileSchema.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read config file ${filePath}: ${message}`);
  }
}

function mergeRuntimeConfig(
  base: RuntimeConfigFile,
  override: RuntimeConfigFile
): RuntimeConfigFile {
  return runtimeConfigFileSchema.parse({
    server: {
      ...base.server,
      ...override.server,
      httpStream: {
        ...base.server?.httpStream,
        ...override.server?.httpStream,
      },
      health: {
        ...base.server?.health,
        ...override.server?.health,
      },
    },
    connection: {
      ...base.connection,
      ...override.connection,
    },
    ciDefaults: {
      ...base.ciDefaults,
      ...override.ciDefaults,
    },
  });
}
