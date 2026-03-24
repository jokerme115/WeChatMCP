import { UserError, type ContentResult } from "fastmcp";
import { z } from "zod";

import type { WeappAutomatorManager } from "../weappClient.js";
import {
  AnyTool,
  ToolContext,
  connectionContainerSchema,
  formatJson,
  toSerializableValue,
  toTextResult,
} from "./common.js";

const nativeParameters = connectionContainerSchema.extend({
  method: z.enum([
    "goHome",
    "navigateLeft",
    "confirmModal",
    "cancelModal",
    "switchTab",
    "authorizeCancel",
    "authorizeAllow",
    "closePaymentDialog",
    "shareCancel",
    "shareConfirm",
  ]),
  url: z.string().trim().min(1).optional(),
});

export function createNativeTools(
  manager: WeappAutomatorManager
): AnyTool[] {
  return [createNativeTool(manager)];
}

function createNativeTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "mp_native",
    description:
      "Invoke a native DevTools interaction such as modal buttons, authorization popups, share dialogs, or tab bar switching.",
    parameters: nativeParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = nativeParameters.parse(rawArgs ?? {});
      return manager.withMiniProgram<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          if (typeof miniProgram.native !== "function") {
            throw new UserError(
              "The current automator runtime does not support native()."
            );
          }

          const native = miniProgram.native();

          if (args.method === "switchTab" && !args.url) {
            throw new UserError('The "url" parameter is required for switchTab.');
          }

          let result: unknown;
          switch (args.method) {
            case "goHome":
              result = await native.goHome();
              break;
            case "navigateLeft":
              result = await native.navigateLeft();
              break;
            case "confirmModal":
              result = await native.confirmModal();
              break;
            case "cancelModal":
              result = await native.cancelModal();
              break;
            case "switchTab":
              result = await native.switchTab({ url: args.url! });
              break;
            case "authorizeCancel":
              result = await native.authorizeCancel();
              break;
            case "authorizeAllow":
              result = await native.authorizeAllow();
              break;
            case "closePaymentDialog":
              result = await native.closePaymentDialog();
              break;
            case "shareCancel":
              result = await native.shareCancel();
              break;
            case "shareConfirm":
              result = await native.shareConfirm();
              break;
            default:
              throw new UserError(
                `Native automation does not support method "${args.method}".`
              );
          }

          const errorMessage =
            result &&
            typeof result === "object" &&
            "error" in result &&
            typeof (result as { error?: unknown }).error === "object" &&
            (result as { error?: { message?: unknown } }).error?.message;
          if (typeof errorMessage === "string" && errorMessage.trim()) {
            throw new UserError(
              `Native action "${args.method}" failed: ${errorMessage}`
            );
          }

          return toTextResult(
            formatJson({
              method: args.method,
              url: args.url ?? null,
              result: toSerializableValue(result),
            })
          );
        }
      );
    },
  };
}
