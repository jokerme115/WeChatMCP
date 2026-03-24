import { UserError, type ContentResult } from "fastmcp";
import { z } from "zod";

import type { WeappAutomatorManager } from "../weappClient.js";
import {
  AnyTool,
  ToolContext,
  connectionContainerSchema,
  formatJson,
  readNamedValues,
  summarizeElement,
  toSerializableValue,
  toTextResult,
  resolveElement,
} from "./common.js";

const getPageDataParameters = connectionContainerSchema.extend({
  path: z.string().trim().min(1).optional(),
});

const setPageDataParameters = connectionContainerSchema.extend({
  data: z.record(z.unknown()),
});

const callPageMethodParameters = connectionContainerSchema.extend({
  method: z.string().trim().min(1),
  args: z.array(z.unknown()).optional(),
});

const waitForElementParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
});

const waitForTimeoutParameters = connectionContainerSchema.extend({
  milliseconds: z.coerce.number().int().nonnegative(),
});

const getElementParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  withWxml: z.boolean().optional().default(false),
});

const getElementsParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  withWxml: z.boolean().optional().default(false),
});

const getElementByXpathParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  withWxml: z.boolean().optional().default(false),
});

const getElementsByXpathParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  withWxml: z.boolean().optional().default(false),
});

const getWindowPropertiesParameters = connectionContainerSchema.extend({
  names: z.array(z.string().trim().min(1)).min(1),
});

export function createPageTools(manager: WeappAutomatorManager): AnyTool[] {
  return [
    createGetElementTool(manager),
    createGetElementsTool(manager),
    createGetElementByXpathTool(manager),
    createGetElementsByXpathTool(manager),
    createGetWindowPropertiesTool(manager),
    createWaitForElementTool(manager),
    createWaitForTimeoutTool(manager),
    createGetPageDataTool(manager),
    createSetPageDataTool(manager),
    createCallPageMethodTool(manager),
  ];
}

function createGetElementByXpathTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "page_getElementByXpath",
    description:
      "Return the first page element that matches an XPath selector.",
    parameters: getElementByXpathParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getElementByXpathParameters.parse(rawArgs ?? {});
      return manager.withPage<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (page) => {
          if (typeof page.getElementByXpath !== "function") {
            throw new UserError(
              "The current automator runtime does not support getElementByXpath()."
            );
          }

          const element = await page.getElementByXpath(args.selector);
          if (!element) {
            throw new UserError(
              `No element matched XPath selector "${args.selector}".`
            );
          }

          const summary = await summarizeElement(element, {
            withWxml: args.withWxml,
          });
          return toTextResult(
            formatJson({
              selector: args.selector,
              ...summary,
            })
          );
        }
      );
    },
  };
}

function createGetElementsByXpathTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "page_getElementsByXpath",
    description:
      "Return all page elements that match an XPath selector.",
    parameters: getElementsByXpathParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getElementsByXpathParameters.parse(rawArgs ?? {});
      return manager.withPage<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (page) => {
          if (typeof page.getElementsByXpath !== "function") {
            throw new UserError(
              "The current automator runtime does not support getElementsByXpath()."
            );
          }

          const elements = await page.getElementsByXpath(args.selector);
          const summaries = await Promise.all(
            elements.map(async (element: any, index: number) => ({
              index,
              ...(await summarizeElement(element, {
                withWxml: args.withWxml,
              })),
            }))
          );

          return toTextResult(
            formatJson({
              selector: args.selector,
              count: elements.length,
              elements: summaries,
            })
          );
        }
      );
    },
  };
}

function createGetWindowPropertiesTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "page_getWindowProperties",
    description:
      "Read one or more window/document expressions from the current page.",
    parameters: getWindowPropertiesParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getWindowPropertiesParameters.parse(rawArgs ?? {});
      return manager.withPage<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const runtimePage = page as unknown as {
            windowProperty: (name: string) => Promise<unknown>;
          };
          const properties = await readNamedValues(
            args.names,
            async (name) => runtimePage.windowProperty(name),
            "property"
          );

          return toTextResult(
            formatJson({
              properties,
            })
          );
        }
      );
    },
  };
}

function createGetElementTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "page_getElement",
    description: "通过选择器获取页面元素，相当于 page.$(selector)。返回每个元素的摘要信息（tagName、text、value、size、offset）；设置 withWxml 为 true 可额外返回元素的完整 outerWxml。",
    parameters: getElementParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getElementParameters.parse(rawArgs ?? {});
      return manager.withPage<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );
          const summary = await summarizeElement(element, { withWxml: args.withWxml });
          return toTextResult(formatJson(summary));
        }
      );
    },
  };
}

function createGetElementsTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "page_getElements",
    description: "通过选择器获取页面元素数组，相当于 page.$$(selector)。返回每个元素的摘要信息（tagName、text、value、size、offset）；设置 withWxml 为 true 可额外返回每个元素的完整 outerWxml。",
    parameters: getElementsParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getElementsParameters.parse(rawArgs ?? {});
      return manager.withPage<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (page) => {
          if (typeof page.$$ !== "function") {
            throw new UserError("当前页面不支持查询元素数组。");
          }

          const elements = await page.$$(args.selector);
          if (!Array.isArray(elements)) {
            throw new UserError(`查询选择器 "${args.selector}" 失败。`);
          }

          const elementsInfo = await Promise.all(
            elements.map(async (el, index) => {
              const summary = await summarizeElement(el, { withWxml: args.withWxml });
              return {
                index,
                ...summary,
              };
            })
          );

          return toTextResult(
            formatJson({
              selector: args.selector,
              count: elements.length,
              elements: elementsInfo,
            })
          );
        }
      );
    },
  };
}

function createWaitForElementTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "page_waitElement",
    description: "等待指定选择器的元素出现在页面上。注意：此方法不适用于自定义组件内部元素，仅能等待页面级别的元素。如需等待自定义组件内部元素，请使用 page_waitTimeout 配合 element 相关工具进行轮询检查。",
    parameters: waitForElementParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = waitForElementParameters.parse(rawArgs ?? {});
      return manager.withPage<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (page) => {
          await page.waitFor(args.selector);
          return toTextResult(`已等待元素选择器 "${args.selector}" 出现。`);
        }
      );
    },
  };
}

function createWaitForTimeoutTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "page_waitTimeout",
    description: "等待指定的毫秒数。",
    parameters: waitForTimeoutParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = waitForTimeoutParameters.parse(rawArgs ?? {});
      return manager.withPage<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (page) => {
          await page.waitFor(args.milliseconds);
          return toTextResult(`已等待 ${args.milliseconds}ms。`);
        }
      );
    },
  };
}

function createGetPageDataTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "page_getData",
    description: "获取当前页面的数据对象，可选择指定子数据路径。",
    parameters: getPageDataParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getPageDataParameters.parse(rawArgs ?? {});
      return manager.withPage<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const data = await page.data(args.path);
          return toTextResult(
            formatJson({
              path: args.path ?? null,
              data: toSerializableValue(data),
            })
          );
        }
      );
    },
  };
}

function createSetPageDataTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "page_setData",
    description: "使用 setData 更新当前页面的数据。",
    parameters: setPageDataParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = setPageDataParameters.parse(rawArgs ?? {});
      const dataKeys = Object.keys(args.data ?? {});
      return manager.withPage<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (page) => {
          await page.setData(args.data);
          return toTextResult(
            `已更新页面数据键: ${dataKeys.length ? dataKeys.join(", ") : "(无)"}。`
          );
        }
      );
    },
  };
}

function createCallPageMethodTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "page_callMethod",
    description: "调用当前页面实例上暴露的方法。参数可以作为数组提供。",
    parameters: callPageMethodParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = callPageMethodParameters.parse(rawArgs ?? {});
      const callArgs = args.args ?? [];
      return manager.withPage<ContentResult>(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const result = await page.callMethod(args.method, ...callArgs);
          return toTextResult(
            formatJson({
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
