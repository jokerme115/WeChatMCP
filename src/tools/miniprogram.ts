import { UserError, type ContentResult } from "fastmcp";
import { z } from "zod";

import type { WeappAutomatorManager } from "../weappClient.js";
import {
  AnyTool,
  ToolContext,
  connectionContainerSchema,
  connectionOnlyParameters,
  createFunctionFromSource,
  formatJson,
  toSerializableValue,
  toTextResult,
} from "./common.js";

const pageScrollParameters = connectionContainerSchema.extend({
  scrollTop: z.coerce.number(),
});

const callPluginWxParameters = connectionContainerSchema.extend({
  pluginId: z.string().trim().min(1),
  method: z.string().trim().min(1),
  args: z.array(z.unknown()).optional(),
});

const mockWxParameters = connectionContainerSchema
  .extend({
    method: z.string().trim().min(1),
    result: z.unknown().optional(),
    functionSource: z.string().trim().min(1).optional(),
    args: z.array(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.result === undefined && !value.functionSource) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either result or functionSource.",
        path: ["result"],
      });
    }
  });

const mockPluginWxParameters = connectionContainerSchema
  .extend({
    pluginId: z.string().trim().min(1),
    method: z.string().trim().min(1),
    result: z.unknown().optional(),
    functionSource: z.string().trim().min(1).optional(),
    args: z.array(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.result === undefined && !value.functionSource) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either result or functionSource.",
        path: ["result"],
      });
    }
  });

const restoreWxParameters = connectionContainerSchema.extend({
  method: z.string().trim().min(1),
});

const restorePluginWxParameters = connectionContainerSchema.extend({
  pluginId: z.string().trim().min(1),
  method: z.string().trim().min(1),
});

const evaluateParameters = connectionContainerSchema.extend({
  functionSource: z.string().trim().min(1),
  args: z.array(z.unknown()).optional(),
});

const exposeFunctionParameters = connectionContainerSchema.extend({
  name: z.string().trim().min(1),
  functionSource: z.string().trim().min(1),
});

const stopAuditsParameters = connectionContainerSchema.extend({
  path: z.string().trim().min(1).optional(),
});

const setTicketParameters = connectionContainerSchema.extend({
  ticket: z.string().trim().min(1),
});

const remoteParameters = connectionContainerSchema.extend({
  auto: z.coerce.boolean().optional().default(false),
});

export function createMiniProgramTools(
  manager: WeappAutomatorManager
): AnyTool[] {
  return [
    createPageStackTool(manager),
    createSystemInfoTool(manager),
    createCheckVersionTool(manager),
    createCallPluginWxMethodTool(manager),
    createMockWxMethodTool(manager),
    createRestoreWxMethodTool(manager),
    createMockPluginWxMethodTool(manager),
    createRestorePluginWxMethodTool(manager),
    createEvaluateTool(manager),
    createPageScrollToTool(manager),
    createExposeFunctionTool(manager),
    createTestAccountsTool(manager),
    createStopAuditsTool(manager),
    createGetTicketTool(manager),
    createSetTicketTool(manager),
    createRefreshTicketTool(manager),
    createRemoteTool(manager),
    createDisconnectTool(manager),
    createCloseTool(manager),
  ];
}

function createCheckVersionTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_checkVersion",
    description:
      "Check whether the connected WeChat DevTools SDK version is compatible with automator.",
    parameters: connectionOnlyParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = connectionOnlyParameters.parse(rawArgs ?? {});
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          if (typeof miniProgram.checkVersion !== "function") {
            throw new UserError(
              "The current automator runtime does not support checkVersion()."
            );
          }

          await miniProgram.checkVersion();

          const toolInfo = await (
            miniProgram as unknown as {
              send?: (method: string) => Promise<unknown>;
            }
          ).send?.("Tool.getInfo");

          return toTextResult(
            formatJson({
              compatible: true,
              toolInfo: toSerializableValue(toolInfo ?? null),
            })
          );
        }
      );
    },
  };
}

function createPageStackTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_pageStack",
    description: "Return the current Mini Program page stack.",
    parameters: connectionOnlyParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = connectionOnlyParameters.parse(rawArgs ?? {});
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          const pages = await miniProgram.pageStack();
          return toTextResult(
            formatJson({
              count: pages.length,
              pages: pages.map((page, index) => ({
                index,
                path: page.path,
                query: toSerializableValue(page.query),
              })),
            })
          );
        }
      );
    },
  };
}

function createSystemInfoTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_systemInfo",
    description: "Return wx.getSystemInfoSync() from the Mini Program runtime.",
    parameters: connectionOnlyParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = connectionOnlyParameters.parse(rawArgs ?? {});
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          const systemInfo = await miniProgram.systemInfo();
          return toTextResult(formatJson(toSerializableValue(systemInfo)));
        }
      );
    },
  };
}

function createCallPluginWxMethodTool(
  manager: WeappAutomatorManager
): AnyTool {
  return {
    name: "mp_callPluginWx",
    description: "Call a plugin wx method inside the Mini Program runtime.",
    parameters: callPluginWxParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = callPluginWxParameters.parse(rawArgs ?? {});
      const callArgs = args.args ?? [];
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          const result = await miniProgram.callPluginWxMethod(
            args.pluginId,
            args.method,
            ...callArgs
          );
          return toTextResult(
            formatJson({
              pluginId: args.pluginId,
              method: args.method,
              arguments: callArgs,
              result: toSerializableValue(result),
            })
          );
        }
      );
    },
  };
}

function createMockWxMethodTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_mockWx",
    description: "Mock a wx method result or implementation.",
    parameters: mockWxParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = mockWxParameters.parse(rawArgs ?? {});
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          if (args.functionSource) {
            const fn = createFunctionFromSource(
              args.functionSource,
              "functionSource"
            );
            await miniProgram.mockWxMethod(args.method, fn, ...(args.args ?? []));
          } else {
            await miniProgram.mockWxMethod(args.method, args.result);
          }

          return toTextResult(
            formatJson({
              method: args.method,
              mode: args.functionSource ? "function" : "result",
            })
          );
        }
      );
    },
  };
}

function createRestoreWxMethodTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_restoreWx",
    description: "Restore a mocked wx method.",
    parameters: restoreWxParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = restoreWxParameters.parse(rawArgs ?? {});
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          await miniProgram.restoreWxMethod(args.method);
          return toTextResult(`Restored wx.${args.method}.`);
        }
      );
    },
  };
}

function createMockPluginWxMethodTool(
  manager: WeappAutomatorManager
): AnyTool {
  return {
    name: "mp_mockPluginWx",
    description: "Mock a plugin wx method result or implementation.",
    parameters: mockPluginWxParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = mockPluginWxParameters.parse(rawArgs ?? {});
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          if (args.functionSource) {
            const fn = createFunctionFromSource(
              args.functionSource,
              "functionSource"
            );
            await miniProgram.mockPluginWxMethod(
              args.pluginId,
              args.method,
              fn,
              ...(args.args ?? [])
            );
          } else {
            await miniProgram.mockPluginWxMethod(
              args.pluginId,
              args.method,
              args.result
            );
          }

          return toTextResult(
            formatJson({
              pluginId: args.pluginId,
              method: args.method,
              mode: args.functionSource ? "function" : "result",
            })
          );
        }
      );
    },
  };
}

function createRestorePluginWxMethodTool(
  manager: WeappAutomatorManager
): AnyTool {
  return {
    name: "mp_restorePluginWx",
    description: "Restore a mocked plugin wx method.",
    parameters: restorePluginWxParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = restorePluginWxParameters.parse(rawArgs ?? {});
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          await miniProgram.restorePluginWxMethod(args.pluginId, args.method);
          return toTextResult(
            `Restored plugin wx method ${args.pluginId}.${args.method}.`
          );
        }
      );
    },
  };
}

function createEvaluateTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_evaluate",
    description:
      "Run a function inside the Mini Program AppService and return its result.",
    parameters: evaluateParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = evaluateParameters.parse(rawArgs ?? {});
      const fn = createFunctionFromSource(args.functionSource, "functionSource");
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          const result = await miniProgram.evaluate(fn, ...(args.args ?? []));
          return toTextResult(formatJson(toSerializableValue(result)));
        }
      );
    },
  };
}

function createPageScrollToTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_pageScrollTo",
    description: "Scroll the current page to a given top position.",
    parameters: pageScrollParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = pageScrollParameters.parse(rawArgs ?? {});
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          await miniProgram.pageScrollTo(args.scrollTop);
          return toTextResult(
            formatJson({
              scrollTop: args.scrollTop,
            })
          );
        }
      );
    },
  };
}

function createExposeFunctionTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_exposeFunction",
    description:
      "Expose a Node-side callback to AppService for the current session.",
    parameters: exposeFunctionParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = exposeFunctionParameters.parse(rawArgs ?? {});
      const fn = createFunctionFromSource(args.functionSource, "functionSource");
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          await miniProgram.exposeFunction(args.name, fn);
          return toTextResult(
            `Exposed function "${args.name}" for the current Mini Program session.`
          );
        }
      );
    },
  };
}

function createTestAccountsTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_testAccounts",
    description: "Return the test accounts configured in DevTools.",
    parameters: connectionOnlyParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = connectionOnlyParameters.parse(rawArgs ?? {});
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          const accounts = await miniProgram.testAccounts();
          return toTextResult(formatJson(toSerializableValue(accounts)));
        }
      );
    },
  };
}

function createStopAuditsTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_stopAudits",
    description: "Stop DevTools audits and optionally save the HTML report.",
    parameters: stopAuditsParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = stopAuditsParameters.parse(rawArgs ?? {});
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          const result = await miniProgram.stopAudits(
            args.path ? { path: args.path } : undefined
          );
          return toTextResult(
            formatJson({
              reportPath: args.path ?? null,
              result: toSerializableValue(result),
            })
          );
        }
      );
    },
  };
}

function createGetTicketTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_getTicket",
    description: "Return the current DevTools login ticket.",
    parameters: connectionOnlyParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = connectionOnlyParameters.parse(rawArgs ?? {});
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          const ticket = await miniProgram.getTicket();
          return toTextResult(formatJson(toSerializableValue(ticket)));
        }
      );
    },
  };
}

function createSetTicketTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_setTicket",
    description: "Update the DevTools login ticket for the current session.",
    parameters: setTicketParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = setTicketParameters.parse(rawArgs ?? {});
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          await miniProgram.setTicket(args.ticket);
          return toTextResult("Updated the DevTools login ticket.");
        }
      );
    },
  };
}

function createRefreshTicketTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_refreshTicket",
    description: "Refresh the current DevTools login ticket.",
    parameters: connectionOnlyParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = connectionOnlyParameters.parse(rawArgs ?? {});
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          await miniProgram.refreshTicket();
          return toTextResult("Refreshed the DevTools login ticket.");
        }
      );
    },
  };
}

function createRemoteTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_remote",
    description: "Enable remote debugging for real-device automation.",
    parameters: remoteParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = remoteParameters.parse(rawArgs ?? {});
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          await miniProgram.remote(args.auto);
          return toTextResult(
            formatJson({
              remoteDebugging: true,
              auto: args.auto,
            })
          );
        }
      );
    },
    timeoutMs: 120000,
  };
}

function createDisconnectTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_disconnect",
    description: "Disconnect the current automation session.",
    parameters: connectionOnlyParameters,
    execute: async () => {
      await manager.close();
      return toTextResult("Disconnected the current automation session.");
    },
  };
}

function createCloseTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_close",
    description: "Close the current DevTools project window.",
    parameters: connectionOnlyParameters,
    execute: async () => {
      if (!manager.hasActiveSession()) {
        throw new UserError("No active automation session to close.");
      }
      await manager.closeProject();
      return toTextResult("Closed the current DevTools project window.");
    },
  };
}
