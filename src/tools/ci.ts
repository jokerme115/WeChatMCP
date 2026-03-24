import fs from "node:fs";
import path from "node:path";

import { UserError, type ContentResult } from "fastmcp";
import miniprogramCiModule from "miniprogram-ci";
import miniprogramMpCiModule from "miniprogram-mp-ci";
import { z } from "zod";

import {
  AnyTool,
  ToolContext,
  formatJson,
  stringListSchema,
  toSerializableValue,
  toTextResult,
} from "./common.js";
import {
  readLocalRuntimeConfig,
  resolveLocalRuntimeConfigPath,
  runtimeCiDefaultsSchema,
  writeLocalRuntimeConfig,
} from "../runtimeConfig.js";

const miniprogramCi = miniprogramCiModule as Record<string, any>;
const ciAnalyseCode = miniprogramCi.analyseCode as (
  project: unknown,
  options?: { silent: boolean }
) => Promise<unknown>;
const ciGetDevSourceMap = miniprogramCi.getDevSourceMap as (options: {
  project: unknown;
  robot?: number;
  sourceMapSavePath: string;
}) => Promise<unknown>;
const ciPackNpm = miniprogramCi.packNpm as (
  project: unknown,
  options?: { reporter?: (info: unknown) => void }
) => Promise<unknown>;
const ciPackNpmManually = miniprogramCi.packNpmManually as (options: {
  packageJsonPath: string;
  miniprogramNpmDistDir: string;
  ignores?: string[];
}) => Promise<unknown>;
const ciPreview = miniprogramCi.preview as (options: Record<string, unknown>) => Promise<unknown>;
const ciSetProxy = miniprogramCi.proxy as (proxy: string) => void;
const ciUpload = miniprogramCi.upload as (options: Record<string, unknown>) => Promise<unknown>;

const miniprogramMpCi = miniprogramMpCiModule as Record<string, any>;
const manageProjectMember = miniprogramMpCi.manageProjectMember as (
  options: Record<string, unknown>
) => Promise<unknown>;

const ciProjectTypeSchema = z
  .enum(["miniProgram", "miniGame", "miniProgramPlugin", "miniGamePlugin"])
  .optional();

const baseProjectSchema = z.object({
  projectPath: z.string().trim().min(1),
  appid: z.string().trim().min(1).optional(),
  type: ciProjectTypeSchema,
  privateKeyPath: z.string().trim().min(1).optional(),
  privateKey: z.string().trim().min(1).optional(),
  ignores: stringListSchema,
});

const compileSettingsSchema = z.record(z.unknown()).optional();

const ciUploadParameters = baseProjectSchema.extend({
  version: z.string().trim().min(1),
  desc: z.string().optional(),
  robot: z.coerce.number().int().positive().optional(),
  threads: z.coerce.number().int().positive().optional(),
  useCOS: z.coerce.boolean().optional(),
  setting: compileSettingsSchema,
});

const ciValidateKeyParameters = baseProjectSchema.extend({});

const ciDefaultsSchema = runtimeCiDefaultsSchema;

const ciConfigPathSchema = z.object({
  configPath: z.string().trim().min(1).optional(),
});

const ciSaveDefaultsParameters = ciDefaultsSchema.extend({
  configPath: z.string().trim().min(1).optional(),
  merge: z.coerce.boolean().optional().default(true),
});

const ciQuickUploadParameters = z.object({
  configPath: z.string().trim().min(1).optional(),
  projectPath: z.string().trim().min(1).optional(),
  appid: z.string().trim().min(1).optional(),
  type: ciProjectTypeSchema,
  privateKeyPath: z.string().trim().min(1).optional(),
  privateKey: z.string().trim().min(1).optional(),
  ignores: stringListSchema,
  version: z.string().trim().min(1).optional(),
  desc: z.string().optional(),
  robot: z.coerce.number().int().positive().optional(),
  threads: z.coerce.number().int().positive().optional(),
  useCOS: z.coerce.boolean().optional(),
  setting: compileSettingsSchema,
});

const ciQuickPreviewParameters = ciQuickUploadParameters.extend({
  qrcodeFormat: z.enum(["image", "base64", "terminal"]).optional(),
  qrcodeOutputDest: z.string().trim().min(1).optional(),
  pagePath: z.string().trim().min(1).optional(),
  searchQuery: z.string().optional(),
  scene: z.coerce.number().int().optional(),
});

const ciPreviewParameters = baseProjectSchema.extend({
  version: z.string().trim().min(1),
  desc: z.string().optional(),
  robot: z.coerce.number().int().positive().optional(),
  threads: z.coerce.number().int().positive().optional(),
  useCOS: z.coerce.boolean().optional(),
  setting: compileSettingsSchema,
  qrcodeFormat: z.enum(["image", "base64", "terminal"]).optional(),
  qrcodeOutputDest: z.string().trim().min(1).optional(),
  pagePath: z.string().trim().min(1).optional(),
  searchQuery: z.string().optional(),
  scene: z.coerce.number().int().optional(),
});

const ciPackNpmParameters = baseProjectSchema.extend({
  reporter: z.coerce.boolean().optional().default(false),
});

const ciPackNpmManualParameters = z.object({
  packageJsonPath: z.string().trim().min(1),
  miniprogramNpmDistDir: z.string().trim().min(1),
  ignores: stringListSchema,
});

const ciSourceMapParameters = baseProjectSchema.extend({
  robot: z.coerce.number().int().positive().default(1),
  sourceMapSavePath: z.string().trim().min(1),
});

const ciAnalyseParameters = baseProjectSchema.extend({
  silent: z.coerce.boolean().optional().default(true),
});

const ciProxyParameters = z.object({
  proxy: z.string().trim().min(1).optional(),
});

const ciCloudFunctionParameters = baseProjectSchema.extend({
  env: z.string().trim().min(1),
  name: z.string().trim().min(1),
  path: z.string().trim().min(1),
  remoteNpmInstall: z.coerce.boolean().optional().default(true),
});

const ciCloudFileParameters = baseProjectSchema.extend({
  env: z.string().trim().min(1),
  path: z.string().trim().min(1),
  remotePath: z.string().trim().min(1),
  concurrency: z.coerce.number().int().positive().optional(),
});

const ciCloudContainerParameters = baseProjectSchema.extend({
  env: z.string().trim().min(1),
  containerRoot: z.string().trim().min(1),
  version: z.record(z.unknown()),
});

const memberSchema = z.object({
  wechatid: z.string().trim().min(1),
  remark: z.string().optional(),
});

const mpciManageParameters = baseProjectSchema.extend({
  robot: z.coerce.number().int().positive().default(1),
  action: z.enum([
    "add_experiencer",
    "delete_experiencer",
    "add_experiencer_dev",
    "delete_experiencer_dev",
    "add_project_member_operator",
    "delete_project_member_operator",
    "add_project_member_developer",
    "delete_project_member_developer",
    "add_project_member_data",
    "delete_project_member_data",
  ]),
  member_list: z.array(memberSchema).min(1),
});

type BaseProjectInput = z.infer<typeof baseProjectSchema>;
type ProjectKind = "ci" | "mpci";
type QuickUploadInput = z.infer<typeof ciQuickUploadParameters>;
type QuickPreviewInput = z.infer<typeof ciQuickPreviewParameters>;
type QuickProjectInput = BaseProjectInput & {
  robot?: number;
  threads?: number;
  useCOS?: boolean;
  setting?: Record<string, unknown>;
  qrcodeFormat?: "image" | "base64" | "terminal";
  qrcodeOutputDest?: string;
};

export function createCiTools(): AnyTool[] {
  return [
    createCiShowDefaultsTool(),
    createCiSaveDefaultsTool(),
    createCiValidateKeyTool(),
    createCiQuickUploadTool(),
    createCiQuickPreviewTool(),
    createCiUploadTool(),
    createCiPreviewTool(),
    createCiPackNpmTool(),
    createCiPackNpmManualTool(),
    createCiGetSourceMapTool(),
    createCiAnalyseCodeTool(),
    createCiProxyTool(),
    createCiCloudUploadFunctionTool(),
    createCiCloudUploadStaticStorageTool(),
    createCiCloudUploadStorageTool(),
    createCiCloudUploadContainerTool(),
    createMpCiManageMembersTool(),
  ];
}

function createCiShowDefaultsTool(): AnyTool {
  return {
    name: "ci_showDefaults",
    description:
      "Show the local CI defaults used by quick upload and quick preview tools.",
    parameters: ciConfigPathSchema,
    execute: async (rawArgs) => {
      const args = ciConfigPathSchema.parse(rawArgs ?? {});
      const configPath = resolveCiConfigPath(args.configPath);
      const config = readCiLocalConfig(args.configPath);
      return toTextResult(
        formatJson({
          configPath,
          exists: fs.existsSync(configPath),
          defaults: config.ciDefaults ?? null,
        })
      );
    },
  };
}

function createCiSaveDefaultsTool(): AnyTool {
  return {
    name: "ci_saveDefaults",
    description:
      "Save or update local CI defaults so later quick upload only needs one short command.",
    parameters: ciSaveDefaultsParameters,
    execute: async (rawArgs) => {
      const args = ciSaveDefaultsParameters.parse(rawArgs ?? {});
      const current = args.merge ? readCiLocalConfig(args.configPath).ciDefaults ?? {} : {};
      const nextDefaults = removeUndefined({
        ...current,
        ...removeUndefined({
          projectPath: args.projectPath,
          appid: args.appid,
          type: args.type,
          privateKeyPath: args.privateKeyPath,
          ignores: args.ignores,
          robot: args.robot,
          threads: args.threads,
          useCOS: args.useCOS,
          setting: args.setting,
          qrcodeFormat: args.qrcodeFormat,
          qrcodeOutputDest: args.qrcodeOutputDest,
        }),
      });

      if (!nextDefaults.projectPath) {
        throw new UserError(
          "projectPath is required before defaults can be saved."
        );
      }

      writeCiLocalConfig(
        {
          ciDefaults: runtimeCiDefaultsSchema.parse(nextDefaults),
        },
        args.configPath
      );

      return toTextResult(
        formatJson({
          saved: true,
          configPath: resolveCiConfigPath(args.configPath),
          defaults: nextDefaults,
        })
      );
    },
  };
}

function createCiValidateKeyTool(): AnyTool {
  return {
    name: "ci_validateKey",
    description:
      "Validate that the provided Mini Program private key can authenticate against the current appid without performing an upload.",
    parameters: ciValidateKeyParameters,
    execute: async (rawArgs) => {
      const args = ciValidateKeyParameters.parse(rawArgs ?? {});
      const project = createCiProject(args, {
        mode: "ci",
        requireCredentials: true,
      }) as {
        appid?: string;
        projectPath?: string;
        type?: string;
        attr?: () => Promise<Record<string, unknown>>;
      };

      if (typeof project.attr !== "function") {
        throw new UserError("The CI project instance does not support attr().");
      }

      const attr = await project.attr();

      return toTextResult(
        formatJson({
          valid: true,
          appid: project.appid ?? args.appid ?? null,
          projectPath: project.projectPath ?? path.resolve(args.projectPath),
          type: project.type ?? args.type ?? null,
          attrKeys: Object.keys(attr ?? {}),
          nickname:
            typeof attr?.nickname === "string" ? attr.nickname : null,
          principalType:
            typeof attr?.principal_type === "number"
              ? attr.principal_type
              : null,
        })
      );
    },
  };
}

function createCiQuickUploadTool(): AnyTool {
  return {
    name: "ci_quickUpload",
    description:
      "Upload using local CI defaults. After ci_saveDefaults, this usually needs no arguments.",
    parameters: ciQuickUploadParameters,
    execute: async (rawArgs) => {
      const args = ciQuickUploadParameters.parse(rawArgs ?? {});
      const merged = resolveQuickProjectInput(args);
      const project = createCiProject(merged, { mode: "ci", requireCredentials: true });
      const version = args.version ?? buildQuickVersion();
      const desc = args.desc ?? buildQuickDescription("upload");
      const result = await ciUpload({
        project,
        version,
        desc,
        robot: merged.robot,
        threads: merged.threads,
        useCOS: merged.useCOS,
        setting: merged.setting as never,
      });
      return toTextResult(
        formatJson({
          configPath: resolveCiConfigPath(args.configPath),
          used: {
            projectPath: path.resolve(merged.projectPath),
            appid: merged.appid ?? null,
            privateKeyPath: merged.privateKeyPath
              ? path.resolve(merged.privateKeyPath)
              : null,
            version,
            desc,
            robot: merged.robot ?? null,
          },
          result: toSerializableValue(result),
        })
      );
    },
  };
}

function createCiQuickPreviewTool(): AnyTool {
  return {
    name: "ci_quickPreview",
    description:
      "Create a preview using local CI defaults. After ci_saveDefaults, this usually needs no arguments.",
    parameters: ciQuickPreviewParameters,
    execute: async (rawArgs) => {
      const args = ciQuickPreviewParameters.parse(rawArgs ?? {});
      const merged = resolveQuickProjectInput(args);
      const project = createCiProject(merged, { mode: "ci", requireCredentials: true });
      const version = args.version ?? buildQuickVersion();
      const desc = args.desc ?? buildQuickDescription("preview");
      const qrcodeFormat = args.qrcodeFormat ?? merged.qrcodeFormat ?? "terminal";
      const qrcodeOutputDest =
        args.qrcodeOutputDest ?? merged.qrcodeOutputDest;
      const result = await ciPreview({
        project,
        version,
        desc,
        robot: merged.robot,
        threads: merged.threads,
        useCOS: merged.useCOS,
        setting: merged.setting as never,
        qrcodeFormat,
        qrcodeOutputDest,
        pagePath: args.pagePath,
        searchQuery: args.searchQuery,
        scene: args.scene,
      });
      return toTextResult(
        formatJson({
          configPath: resolveCiConfigPath(args.configPath),
          used: {
            projectPath: path.resolve(merged.projectPath),
            appid: merged.appid ?? null,
            privateKeyPath: merged.privateKeyPath
              ? path.resolve(merged.privateKeyPath)
              : null,
            version,
            desc,
            robot: merged.robot ?? null,
            qrcodeFormat,
            qrcodeOutputDest: qrcodeOutputDest ?? null,
          },
          result: toSerializableValue(result),
        })
      );
    },
  };
}

function createCiUploadTool(): AnyTool {
  return {
    name: "ci_upload",
    description: "Upload a Mini Program package with miniprogram-ci.",
    parameters: ciUploadParameters,
    execute: async (rawArgs) => {
      const args = ciUploadParameters.parse(rawArgs ?? {});
      const project = createCiProject(args, { mode: "ci", requireCredentials: true });
      const result = await ciUpload({
        project,
        version: args.version,
        desc: args.desc,
        robot: args.robot,
        threads: args.threads,
        useCOS: args.useCOS,
        setting: args.setting as never,
      });
      return toTextResult(formatJson(toSerializableValue(result)));
    },
  };
}

function createCiPreviewTool(): AnyTool {
  return {
    name: "ci_preview",
    description: "Create a preview build with miniprogram-ci.",
    parameters: ciPreviewParameters,
    execute: async (rawArgs) => {
      const args = ciPreviewParameters.parse(rawArgs ?? {});
      const project = createCiProject(args, { mode: "ci", requireCredentials: true });
      const result = await ciPreview({
        project,
        version: args.version,
        desc: args.desc,
        robot: args.robot,
        threads: args.threads,
        useCOS: args.useCOS,
        setting: args.setting as never,
        qrcodeFormat: args.qrcodeFormat,
        qrcodeOutputDest: args.qrcodeOutputDest,
        pagePath: args.pagePath,
        searchQuery: args.searchQuery,
        scene: args.scene,
      });
      return toTextResult(formatJson(toSerializableValue(result)));
    },
  };
}

function createCiPackNpmTool(): AnyTool {
  return {
    name: "ci_packNpm",
    description: "Run the standard miniprogram-ci npm build.",
    parameters: ciPackNpmParameters,
    execute: async (rawArgs) => {
      const args = ciPackNpmParameters.parse(rawArgs ?? {});
      const project = createCiProject(args, { mode: "ci", requireCredentials: false });
      const warnings = await ciPackNpm(project as never, {
        reporter: args.reporter
          ? (info: unknown) => {
              console.log("[ci_packNpm reporter]", JSON.stringify(info));
            }
          : undefined,
      });
      return toTextResult(formatJson(toSerializableValue(warnings)));
    },
  };
}

function createCiPackNpmManualTool(): AnyTool {
  return {
    name: "ci_packNpmManually",
    description:
      "Build npm from a custom package.json location into a target miniprogram_npm directory.",
    parameters: ciPackNpmManualParameters,
    execute: async (rawArgs) => {
      const args = ciPackNpmManualParameters.parse(rawArgs ?? {});
      const result = await ciPackNpmManually({
        packageJsonPath: path.resolve(args.packageJsonPath),
        miniprogramNpmDistDir: path.resolve(args.miniprogramNpmDistDir),
        ignores: args.ignores,
      });
      return toTextResult(formatJson(toSerializableValue(result)));
    },
  };
}

function createCiGetSourceMapTool(): AnyTool {
  return {
    name: "ci_getDevSourceMap",
    description: "Download the latest uploaded dev source map with miniprogram-ci.",
    parameters: ciSourceMapParameters,
    execute: async (rawArgs) => {
      const args = ciSourceMapParameters.parse(rawArgs ?? {});
      const project = createCiProject(args, { mode: "ci", requireCredentials: true });
      const result = await ciGetDevSourceMap({
        project,
        robot: args.robot,
        sourceMapSavePath: path.resolve(args.sourceMapSavePath),
      });
      return toTextResult(
        formatJson({
          sourceMapSavePath: path.resolve(args.sourceMapSavePath),
          result: toSerializableValue(result),
        })
      );
    },
  };
}

function createCiAnalyseCodeTool(): AnyTool {
  return {
    name: "ci_analyseCode",
    description: "Run static dependency analysis with miniprogram-ci.",
    parameters: ciAnalyseParameters,
    execute: async (rawArgs) => {
      const args = ciAnalyseParameters.parse(rawArgs ?? {});
      const project = createCiProject(args, { mode: "ci", requireCredentials: false });
      const result = await ciAnalyseCode(project, { silent: args.silent });
      return toTextResult(formatJson(toSerializableValue(result)));
    },
  };
}

function createCiProxyTool(): AnyTool {
  return {
    name: "ci_setProxy",
    description: "Set or clear the network proxy used by miniprogram-ci.",
    parameters: ciProxyParameters,
    execute: async (rawArgs) => {
      const args = ciProxyParameters.parse(rawArgs ?? {});
      ciSetProxy(args.proxy ?? "");
      return toTextResult(
        formatJson({
          proxy: args.proxy ?? null,
        })
      );
    },
  };
}

function createCiCloudUploadFunctionTool(): AnyTool {
  return {
    name: "ci_cloudUploadFunction",
    description: "Upload a cloud function with miniprogram-ci.",
    parameters: ciCloudFunctionParameters,
    execute: async (rawArgs) => {
      const args = ciCloudFunctionParameters.parse(rawArgs ?? {});
      const project = createCiProject(args, { mode: "ci", requireCredentials: true });
      const result = await (miniprogramCi as any).cloud.uploadFunction({
        project,
        env: args.env,
        name: args.name,
        path: path.resolve(args.path),
        remoteNpmInstall: args.remoteNpmInstall,
      });
      return toTextResult(formatJson(toSerializableValue(result)));
    },
  };
}

function createCiCloudUploadStaticStorageTool(): AnyTool {
  return {
    name: "ci_cloudUploadStaticStorage",
    description: "Upload files to cloud static storage with miniprogram-ci.",
    parameters: ciCloudFileParameters,
    execute: async (rawArgs) => {
      const args = ciCloudFileParameters.parse(rawArgs ?? {});
      const project = createCiProject(args, { mode: "ci", requireCredentials: true });
      const result = await (miniprogramCi as any).cloud.uploadStaticStorage({
        project,
        env: args.env,
        path: path.resolve(args.path),
        remotePath: args.remotePath,
        concurrency: args.concurrency,
      });
      return toTextResult(formatJson(toSerializableValue(result ?? true)));
    },
  };
}

function createCiCloudUploadStorageTool(): AnyTool {
  return {
    name: "ci_cloudUploadStorage",
    description: "Upload files to cloud storage with miniprogram-ci.",
    parameters: ciCloudFileParameters,
    execute: async (rawArgs) => {
      const args = ciCloudFileParameters.parse(rawArgs ?? {});
      const project = createCiProject(args, { mode: "ci", requireCredentials: true });
      const result = await (miniprogramCi as any).cloud.uploadStorage({
        project,
        env: args.env,
        path: path.resolve(args.path),
        remotePath: args.remotePath,
        concurrency: args.concurrency,
      });
      return toTextResult(formatJson(toSerializableValue(result ?? true)));
    },
  };
}

function createCiCloudUploadContainerTool(): AnyTool {
  return {
    name: "ci_cloudUploadContainer",
    description: "Create a cloud hosting version with miniprogram-ci.",
    parameters: ciCloudContainerParameters,
    execute: async (rawArgs) => {
      const args = ciCloudContainerParameters.parse(rawArgs ?? {});
      const project = createCiProject(args, { mode: "ci", requireCredentials: true });
      const result = await (miniprogramCi as any).cloud.uploadContainer({
        project,
        env: args.env,
        version: args.version,
        containerRoot: path.resolve(args.containerRoot),
      });
      return toTextResult(formatJson(toSerializableValue(result)));
    },
  };
}

function createMpCiManageMembersTool(): AnyTool {
  return {
    name: "mpci_manageMembers",
    description: "Batch-manage Mini Program members with miniprogram-mp-ci.",
    parameters: mpciManageParameters,
    execute: async (rawArgs) => {
      const args = mpciManageParameters.parse(rawArgs ?? {});
      const project = createCiProject(args, { mode: "mpci", requireCredentials: true });
      const result = await manageProjectMember({
        project,
        robot: args.robot,
        action: args.action,
        member_list: args.member_list,
      });
      return toTextResult(formatJson(toSerializableValue(result)));
    },
  };
}

function createCiProject(
  input: BaseProjectInput,
  options: {
    mode: ProjectKind;
    requireCredentials: boolean;
  }
): any {
  const projectPath = path.resolve(input.projectPath);
  if (!fs.existsSync(projectPath)) {
    throw new UserError(`Project path does not exist: ${projectPath}`);
  }

  const metadata = readProjectMetadata(projectPath);
  const appid = input.appid ?? metadata.appid;
  if (!appid) {
    throw new UserError(
      `appid is required. Either provide it explicitly or ensure project.config.json contains appid in ${projectPath}.`
    );
  }

  const type = input.type ?? metadata.type ?? "miniProgram";
  const hasCredentials = Boolean(input.privateKey || input.privateKeyPath);
  if (!options.requireCredentials && !hasCredentials) {
    return createLocalProject({
      projectPath,
      appid,
      type,
    });
  }

  if (!hasCredentials) {
    throw new UserError(
      "privateKeyPath or privateKey is required for this CI operation."
    );
  }

  const commonOptions = {
    projectPath,
    appid,
    type,
    privateKeyPath: input.privateKeyPath
      ? path.resolve(input.privateKeyPath)
      : undefined,
    privateKey: input.privateKey,
    ignores: input.ignores,
  };

  if (options.mode === "ci") {
    const ProjectCtor = (miniprogramCi as any).Project;
    return new ProjectCtor(commonOptions);
  }

  const ProjectCtor = (miniprogramMpCi as any).Project;
  return new ProjectCtor(commonOptions);
}

function createLocalProject(options: {
  projectPath: string;
  appid: string;
  type: NonNullable<BaseProjectInput["type"]> | "miniProgram";
}) {
  return {
    appid: options.appid,
    type: options.type,
    projectPath: options.projectPath,
    stat(prefix = "", filePath = "") {
      const resolved = resolveProjectFile(options.projectPath, prefix, filePath);
      return fs.existsSync(resolved) ? fs.statSync(resolved) : undefined;
    },
    getFile(prefix = "", filePath = "") {
      return fs.readFileSync(resolveProjectFile(options.projectPath, prefix, filePath));
    },
    getFileList() {
      return [];
    },
    updateFileAndDirs() {
      return undefined;
    },
    updateFiles() {
      return undefined;
    },
    async attr() {
      return {
        appid: options.appid,
        setting: {},
      };
    },
  };
}

function resolveProjectFile(
  projectPath: string,
  prefix: string,
  filePath: string
): string {
  const relativePath = [prefix, filePath].filter(Boolean).join("/");
  return path.join(projectPath, relativePath);
}

function readProjectMetadata(projectPath: string): {
  appid?: string;
  type?: "miniProgram" | "miniGame" | "miniProgramPlugin" | "miniGamePlugin";
} {
  const projectConfigPath = path.join(projectPath, "project.config.json");
  if (!fs.existsSync(projectConfigPath)) {
    return {};
  }

  try {
    const raw = JSON.parse(fs.readFileSync(projectConfigPath, "utf8")) as {
      appid?: string;
      compileType?: string;
    };
    return {
      appid: typeof raw.appid === "string" ? raw.appid : undefined,
      type: mapCompileType(raw.compileType),
    };
  } catch {
    return {};
  }
}

function mapCompileType(
  compileType?: string
): "miniProgram" | "miniGame" | "miniProgramPlugin" | "miniGamePlugin" | undefined {
  switch (compileType) {
    case "miniprogram":
      return "miniProgram";
    case "game":
      return "miniGame";
    case "plugin":
      return "miniProgramPlugin";
    case "gamePlugin":
      return "miniGamePlugin";
    default:
      return undefined;
  }
}

function readCiLocalConfig(configPath?: string): {
  ciDefaults?: z.infer<typeof runtimeCiDefaultsSchema>;
} {
  try {
    const config = readLocalRuntimeConfig({
      localConfigPath: configPath,
    });
    return {
      ciDefaults: config.ciDefaults,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(message);
  }
}

function writeCiLocalConfig(
  config: {
    ciDefaults?: z.infer<typeof runtimeCiDefaultsSchema>;
  },
  configPath?: string
): void {
  try {
    writeLocalRuntimeConfig(
      {
        ciDefaults: config.ciDefaults,
      },
      {
        localConfigPath: configPath,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(message);
  }
}

function resolveCiConfigPath(configPath?: string): string {
  return resolveLocalRuntimeConfigPath(configPath);
}

function resolveQuickProjectInput(
  args: QuickUploadInput | QuickPreviewInput
): QuickProjectInput {
  const defaults = readCiLocalConfig(args.configPath).ciDefaults ?? {};
  const merged = removeUndefined({
    projectPath: args.projectPath ?? defaults.projectPath,
    appid: args.appid ?? defaults.appid,
    type: args.type ?? defaults.type,
    privateKeyPath: args.privateKeyPath ?? defaults.privateKeyPath,
    privateKey: args.privateKey,
    ignores: args.ignores ?? defaults.ignores,
    robot: args.robot ?? defaults.robot,
    threads: args.threads ?? defaults.threads,
    useCOS: args.useCOS ?? defaults.useCOS,
    setting: args.setting ?? defaults.setting,
    qrcodeFormat:
      "qrcodeFormat" in args && args.qrcodeFormat !== undefined
        ? args.qrcodeFormat
        : defaults.qrcodeFormat,
    qrcodeOutputDest:
      "qrcodeOutputDest" in args && args.qrcodeOutputDest !== undefined
        ? args.qrcodeOutputDest
        : defaults.qrcodeOutputDest,
  });

  if (!merged.projectPath) {
    throw new UserError(
      `projectPath is missing. Run ci_saveDefaults first or provide projectPath directly. Config path: ${resolveCiConfigPath(
        args.configPath
      )}`
    );
  }

  if (!merged.privateKeyPath && !merged.privateKey) {
    throw new UserError(
      `privateKeyPath is missing. Run ci_saveDefaults first or provide privateKeyPath directly. Config path: ${resolveCiConfigPath(
        args.configPath
      )}`
    );
  }

  return baseProjectSchema
    .extend({
      robot: z.coerce.number().int().positive().optional(),
      threads: z.coerce.number().int().positive().optional(),
      useCOS: z.coerce.boolean().optional(),
      setting: compileSettingsSchema,
      qrcodeFormat: z.enum(["image", "base64", "terminal"]).optional(),
      qrcodeOutputDest: z.string().trim().min(1).optional(),
    })
    .parse(merged);
}

function buildQuickVersion(now = new Date()): string {
  const date = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join("");
  const time = [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join("");
  return `1.0.${date}${time}`;
}

function buildQuickDescription(kind: "upload" | "preview", now = new Date()): string {
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return `MCP quick ${kind} ${stamp}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}
