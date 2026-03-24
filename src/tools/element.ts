import { UserError } from "fastmcp";
import { z } from "zod";

import type { WeappAutomatorManager } from "../weappClient.js";
import {
  AnyTool,
  ToolContext,
  connectionContainerSchema,
  formatJson,
  readNamedValues,
  resolveElement,
  summarizeElement,
  toSerializableValue,
  toTextResult,
  waitOnPage,
} from "./common.js";

const tapElementParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  waitMs: z.coerce.number().int().nonnegative().optional(),
});

const inputTextParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  value: z.union([z.string(), z.coerce.number()]),
});

const callElementMethodParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  method: z.string().trim().min(1),
  args: z.array(z.unknown()).optional(),
});

const getElementDataParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  path: z.string().trim().min(1).optional(),
});

const setElementDataParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  data: z.record(z.unknown()),
});

const getInnerElementParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  targetSelector: z.string().trim().min(1),
  withWxml: z.boolean().optional().default(false),
});

const getInnerElementsParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  targetSelector: z.string().trim().min(1),
  withWxml: z.boolean().optional().default(false),
});

const getElementWxmlParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  outer: z.boolean().optional().default(false),
});

const getElementStylesParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  names: z.array(z.string().trim().min(1)),
});

const scrollToParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  x: z.coerce.number(),
  y: z.coerce.number(),
});

const getAttributesParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  names: z.array(z.string().trim().min(1)),
});

const getBoundingClientRectParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
});

const getElementTextParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
});

const getElementValueParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
});

const getElementPropertiesParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  names: z.array(z.string().trim().min(1)),
});

const getDomPropertiesParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  names: z.array(z.string().trim().min(1)).min(1),
});

const longpressElementParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  waitMs: z.coerce.number().int().nonnegative().optional(),
});

const touchPointSchema = z.object({
  identifier: z.coerce.number().optional(),
  pageX: z.coerce.number().optional(),
  pageY: z.coerce.number().optional(),
  clientX: z.coerce.number().optional(),
  clientY: z.coerce.number().optional(),
});

const touchEventParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  touches: z.array(touchPointSchema).optional(),
  changedTouches: z.array(touchPointSchema).optional(),
  waitMs: z.coerce.number().int().nonnegative().optional(),
});

const triggerEventParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  type: z.string().trim().min(1),
  detail: z.unknown().optional(),
  waitMs: z.coerce.number().int().nonnegative().optional(),
});

const dispatchEventParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  event: z.record(z.unknown()),
  waitMs: z.coerce.number().int().nonnegative().optional(),
});

const callContextMethodParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  method: z.string().trim().min(1),
  args: z.array(z.unknown()).optional(),
});

const callFunctionParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  functionName: z.string().trim().min(1),
  args: z.array(z.unknown()).optional(),
});

const swipeToParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  index: z.coerce.number().int().nonnegative(),
  waitMs: z.coerce.number().int().nonnegative().optional(),
});

const moveToParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  x: z.coerce.number(),
  y: z.coerce.number(),
  waitMs: z.coerce.number().int().nonnegative().optional(),
});

const slideToParameters = connectionContainerSchema.extend({
  selector: z.string().trim().min(1),
  innerSelector: z.string().trim().min(1).optional(),
  value: z.coerce.number(),
  waitMs: z.coerce.number().int().nonnegative().optional(),
});

export function createElementTools(
  manager: WeappAutomatorManager
): AnyTool[] {
  return [
    createTapElementTool(manager),
    createLongpressElementTool(manager),
    createInputTextTool(manager),
    createGetElementTextTool(manager),
    createGetElementValueTool(manager),
    createGetElementPropertiesTool(manager),
    createGetDomPropertiesTool(manager),
    createCallElementMethodTool(manager),
    createCallFunctionTool(manager),
    createTouchStartTool(manager),
    createTouchMoveTool(manager),
    createTouchEndTool(manager),
    createTriggerEventTool(manager),
    createDispatchEventTool(manager),
    createGetElementDataTool(manager),
    createSetElementDataTool(manager),
    createGetInnerElementTool(manager),
    createGetInnerElementsTool(manager),
    createGetElementWxmlTool(manager),
    createGetElementStylesTool(manager),
    createScrollToTool(manager),
    createSwipeToTool(manager),
    createMoveToTool(manager),
    createSlideToTool(manager),
    createCallContextMethodTool(manager),
    createGetAttributesTool(manager),
    createGetBoundingClientRectTool(manager),
  ];
}

function createTapElementTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_tap",
    description: "通过 CSS 选择器模拟点击 WXML 元素。如需点击自定义组件内部的元素，请使用 innerSelector 参数：selector 设为组件 ID 选择器(如 #my-component)或标签选择器，innerSelector 设为组件内部元素的选择器。",
    parameters: tapElementParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = tapElementParameters.parse(rawArgs ?? {});
      const waitMs = args.waitMs;
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          await element.tap();
          await waitOnPage(page, waitMs);

          return toTextResult(
            `已点击元素 "${args.selector}"${args.innerSelector ? ` -> "${args.innerSelector}"` : ""}${waitMs ? ` 并等待 ${waitMs}ms` : ""}。`
          );
        }
      );
    },
  };
}

function createLongpressElementTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_longpress",
    description: "Perform a long press on the target element.",
    parameters: longpressElementParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = longpressElementParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.longpress !== "function") {
            throw new UserError(
              `Element "${args.selector}" does not support longpress().`
            );
          }

          await element.longpress();
          await waitOnPage(page, args.waitMs);

          return toTextResult(
            `Long-pressed "${args.selector}"${args.innerSelector ? ` -> "${args.innerSelector}"` : ""}.`
          );
        }
      );
    },
  };
}

function createInputTextTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_input",
    description: "向指定元素输入文本。",
    parameters: inputTextParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = inputTextParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          await element.input(args.value);
          return toTextResult(
            `已向元素 "${args.selector}"${args.innerSelector ? ` -> "${args.innerSelector}"` : ""} 输入值 "${args.value}"。`
          );
        }
      );
    },
  };
}

function createGetElementTextTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_getText",
    description: "Return the visible text content of an element.",
    parameters: getElementTextParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getElementTextParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.text !== "function") {
            throw new UserError(
              `Element "${args.selector}" does not support text().`
            );
          }

          const text = await element.text();
          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              text: toSerializableValue(text),
            })
          );
        }
      );
    },
  };
}

function createGetElementValueTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_getValue",
    description: "Return the current value of an element.",
    parameters: getElementValueParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getElementValueParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.value !== "function") {
            throw new UserError(
              `Element "${args.selector}" does not support value().`
            );
          }

          const value = await element.value();
          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              value: toSerializableValue(value),
            })
          );
        }
      );
    },
  };
}

function createGetElementPropertiesTool(
  manager: WeappAutomatorManager
): AnyTool {
  return {
    name: "element_getProperties",
    description: "Return one or more component properties via element.property().",
    parameters: getElementPropertiesParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getElementPropertiesParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.property !== "function") {
            throw new UserError(
              `Element "${args.selector}" does not support property().`
            );
          }

          const properties = await readNamedValues(
            args.names,
            async (name) => element.property(name),
            "property"
          );

          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              properties,
            })
          );
        }
      );
    },
  };
}

function createGetDomPropertiesTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_getDOMProperties",
    description:
      "Return one or more DOM properties via element.domProperty().",
    parameters: getDomPropertiesParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getDomPropertiesParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.domProperty !== "function") {
            throw new UserError(
              `Element "${args.selector}" does not support domProperty().`
            );
          }

          const properties = await readNamedValues(
            args.names,
            async (name) => element.domProperty(name),
            "property"
          );

          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              properties,
            })
          );
        }
      );
    },
  };
}

function createCallElementMethodTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_callMethod",
    description: "调用组件实例指定方法，仅自定义组件可以使用。",
    parameters: callElementMethodParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = callElementMethodParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          const callArgs = args.args ?? [];
          const result = await element.callMethod(args.method, ...callArgs);
          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
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

function createTouchStartTool(manager: WeappAutomatorManager): AnyTool {
  return createTouchTool(manager, "element_touchstart", "touchstart");
}

function createTouchMoveTool(manager: WeappAutomatorManager): AnyTool {
  return createTouchTool(manager, "element_touchmove", "touchmove");
}

function createTouchEndTool(manager: WeappAutomatorManager): AnyTool {
  return createTouchTool(manager, "element_touchend", "touchend");
}

function createTouchTool(
  manager: WeappAutomatorManager,
  toolName: string,
  methodName: "touchstart" | "touchmove" | "touchend"
): AnyTool {
  return {
    name: toolName,
    description: `Dispatch ${methodName} on the target element.`,
    parameters: touchEventParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = touchEventParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          const method = element[methodName];
          if (typeof method !== "function") {
            throw new UserError(
              `Element "${args.selector}" does not support ${methodName}().`
            );
          }

          await method.call(element, {
            touches: args.touches,
            changedTouches: args.changedTouches,
          });
          await waitOnPage(page, args.waitMs);

          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              event: methodName,
              touches: toSerializableValue(args.touches ?? []),
              changedTouches: toSerializableValue(args.changedTouches ?? []),
            })
          );
        }
      );
    },
  };
}

function createTriggerEventTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_trigger",
    description: "Trigger a custom component event with optional detail.",
    parameters: triggerEventParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = triggerEventParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.trigger !== "function") {
            throw new UserError(
              `Element "${args.selector}" does not support trigger().`
            );
          }

          await element.trigger(args.type, args.detail);
          await waitOnPage(page, args.waitMs);

          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              type: args.type,
              detail: toSerializableValue(args.detail),
            })
          );
        }
      );
    },
  };
}

function createDispatchEventTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_dispatchEvent",
    description: "Dispatch a low-level DOM event object on the target element.",
    parameters: dispatchEventParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = dispatchEventParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.dispatchEvent !== "function") {
            throw new UserError(
              `Element "${args.selector}" does not support dispatchEvent().`
            );
          }

          await element.dispatchEvent(args.event);
          await waitOnPage(page, args.waitMs);

          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              event: toSerializableValue(args.event),
            })
          );
        }
      );
    },
  };
}

function createGetElementDataTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_getData",
    description: "获取组件实例渲染数据，仅自定义组件可以使用。",
    parameters: getElementDataParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getElementDataParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          const data = await element.data(args.path);
          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              path: args.path ?? null,
              data: toSerializableValue(data),
            })
          );
        }
      );
    },
  };
}

function createSetElementDataTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_setData",
    description: "设置组件实例渲染数据，仅自定义组件可以使用。",
    parameters: setElementDataParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = setElementDataParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          await element.setData(args.data);
          const dataKeys = Object.keys(args.data ?? {});
          return toTextResult(
            `已更新组件数据键: ${dataKeys.length ? dataKeys.join(", ") : "(无)"}。`
          );
        }
      );
    },
  };
}

function createGetInnerElementTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_getInnerElement",
    description: "在元素范围内获取元素，相当于 element.$(selector)。设置 withWxml 为 true 可额外返回每个元素的完整 outerWxml。",
    parameters: getInnerElementParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getInnerElementParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.$ !== "function") {
            throw new UserError(
              `元素 "${args.selector}" 不支持查询内部元素。`
            );
          }

          const innerElement = await element.$(args.targetSelector);
          if (!innerElement) {
            throw new UserError(
              `在元素 "${args.selector}" 内未找到选择器 "${args.targetSelector}" 对应的元素。`
            );
          }

          const summary = await summarizeElement(innerElement, { withWxml: args.withWxml });

          return toTextResult(
            formatJson({
              parentSelector: args.selector,
              parentInnerSelector: args.innerSelector ?? null,
              targetSelector: args.targetSelector,
              ...summary,
            })
          );
        }
      );
    },
  };
}

function createGetInnerElementsTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_getInnerElements",
    description: "在元素范围内获取元素数组，相当于 element.$$(selector)。设置 withWxml 为 true 可额外返回每个元素的完整 outerWxml。",
    parameters: getInnerElementsParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getInnerElementsParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.$$ !== "function") {
            throw new UserError(
              `元素 "${args.selector}" 不支持查询内部元素数组。`
            );
          }

          const innerElements = await element.$$(args.targetSelector);
          if (!Array.isArray(innerElements)) {
            throw new UserError(
              `在元素 "${args.selector}" 内查询选择器 "${args.targetSelector}" 失败。`
            );
          }

          const elementsInfo = await Promise.all(
            innerElements.map(async (el, index) => {
              const summary = await summarizeElement(el, { withWxml: args.withWxml });
              return {
                index,
                ...summary,
              };
            })
          );

          return toTextResult(
            formatJson({
              parentSelector: args.selector,
              parentInnerSelector: args.innerSelector ?? null,
              targetSelector: args.targetSelector,
              count: innerElements.length,
              elements: elementsInfo,
            })
          );
        }
      );
    },
  };
}

function createGetElementWxmlTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_getWxml",
    description: "获取元素 WXML。默认获取内部 WXML(element.wxml())，设置 outer 为 true 可获取包含元素本身的 WXML(element.outerWxml())。",
    parameters: getElementWxmlParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getElementWxmlParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          const methodName = args.outer ? "outerWxml" : "wxml";
          if (typeof element[methodName] !== "function") {
            throw new UserError(
              `元素 "${args.selector}" 不支持获取 ${methodName}。`
            );
          }

          const wxml = await element[methodName]();
          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              type: args.outer ? "outerWxml" : "wxml",
              wxml: toSerializableValue(wxml),
            })
          );
        }
      );
    },
  };
}

function createGetElementStylesTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_getStyles",
    description: "获取元素的样式值。names 为样式名数组（如 ['color', 'fontSize', 'backgroundColor']）。",
    parameters: getElementStylesParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getElementStylesParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.style !== "function") {
            throw new UserError(
              `元素 "${args.selector}" 不支持获取样式。`
            );
          }

          const styles: Record<string, unknown> = {};

          await Promise.all(
            args.names.map(async (name) => {
              try {
                styles[name] = await element.style(name);
              } catch {
                styles[name] = null;
              }
            })
          );

          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              styles,
            })
          );
        }
      );
    },
  };
}

function createScrollToTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_scrollTo",
    description: "滚动 scroll-view 组件到指定位置。仅适用于 scroll-view 组件。",
    parameters: scrollToParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = scrollToParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.scrollTo !== "function") {
            throw new UserError(
              `元素 "${args.selector}" 不支持滚动操作，仅 scroll-view 组件可使用此功能。`
            );
          }

          await element.scrollTo(args.x, args.y);

          return toTextResult(
            `已将元素 "${args.selector}"${args.innerSelector ? ` -> "${args.innerSelector}"` : ""} 滚动到位置 (${args.x}, ${args.y})。`
          );
        }
      );
    },
  };
}

function createSwipeToTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_swipeTo",
    description: "Swipe a swiper component to the given index.",
    parameters: swipeToParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = swipeToParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.swipeTo !== "function") {
            throw new UserError(
              `Element "${args.selector}" does not support swipeTo().`
            );
          }

          await element.swipeTo(args.index);
          await waitOnPage(page, args.waitMs);

          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              index: args.index,
            })
          );
        }
      );
    },
  };
}

function createMoveToTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_moveTo",
    description: "Move a movable-view component to x/y.",
    parameters: moveToParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = moveToParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.moveTo !== "function") {
            throw new UserError(
              `Element "${args.selector}" does not support moveTo().`
            );
          }

          await element.moveTo(args.x, args.y);
          await waitOnPage(page, args.waitMs);

          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              x: args.x,
              y: args.y,
            })
          );
        }
      );
    },
  };
}

function createSlideToTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_slideTo",
    description: "Set the value of a slider component.",
    parameters: slideToParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = slideToParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.slideTo !== "function") {
            throw new UserError(
              `Element "${args.selector}" does not support slideTo().`
            );
          }

          await element.slideTo(args.value);
          await waitOnPage(page, args.waitMs);

          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              value: args.value,
            })
          );
        }
      );
    },
  };
}

function createCallContextMethodTool(
  manager: WeappAutomatorManager
): AnyTool {
  return {
    name: "element_callContextMethod",
    description: "Call a component context method, for example on video.",
    parameters: callContextMethodParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = callContextMethodParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.callContextMethod !== "function") {
            throw new UserError(
              `Element "${args.selector}" does not support callContextMethod().`
            );
          }

          const result = await element.callContextMethod(
            args.method,
            ...(args.args ?? [])
          );

          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              method: args.method,
              arguments: args.args ?? [],
              result: toSerializableValue(result),
            })
          );
        }
      );
    },
  };
}

function createCallFunctionTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_callFunction",
    description:
      "Call a low-level automator element function by its internal name.",
    parameters: callFunctionParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = callFunctionParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.callFunction !== "function") {
            throw new UserError(
              `Element "${args.selector}" does not support callFunction().`
            );
          }

          const result = await element.callFunction(
            args.functionName,
            ...(args.args ?? [])
          );

          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              functionName: args.functionName,
              arguments: args.args ?? [],
              result: toSerializableValue(result),
            })
          );
        }
      );
    },
  };
}

function createGetAttributesTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_getAttributes",
    description: "获取元素的特性值。names 为特性名数组（如 ['class', 'id', 'data-index']）。",
    parameters: getAttributesParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getAttributesParameters.parse(rawArgs ?? {});
      return manager.withPage(
        context.log,
        { overrides: args.connection },
        async (page) => {
          const element = await resolveElement(
            page,
            args.selector,
            args.innerSelector
          );

          if (typeof element.attribute !== "function") {
            throw new UserError(
              `元素 "${args.selector}" 不支持获取特性。`
            );
          }

          const attributes: Record<string, unknown> = {};

          await Promise.all(
            args.names.map(async (name) => {
              try {
                attributes[name] = await element.attribute(name);
              } catch {
                attributes[name] = null;
              }
            })
          );

          return toTextResult(
            formatJson({
              selector: args.selector,
              innerSelector: args.innerSelector ?? null,
              attributes,
            })
          );
        }
      );
    },
  };
}

function createGetBoundingClientRectTool(manager: WeappAutomatorManager): AnyTool {
  return {
    name: "element_getBoundingClientRect",
    description: "获取元素相对于视口的边界矩形信息（left、top、width、height、right、bottom）。此方法返回的是考虑 CSS transform 变换后的实际渲染尺寸和位置。支持跨组件查询：若需获取自定义组件内部元素，可将 selector 设为组件选择器，innerSelector 设为内部元素选择器。注意：目前仅支持 ID 选择器、类选择器。",
    parameters: getBoundingClientRectParameters,
    execute: async (rawArgs, context: ToolContext) => {
      const args = getBoundingClientRectParameters.parse(rawArgs ?? {});
      const { selector, innerSelector } = args;

      return manager.withMiniProgram(
        context.log,
        { overrides: args.connection },
        async (miniProgram) => {
          const fullSelector = innerSelector ? `${selector} >>> ${innerSelector}` : selector;

          let result;
          try {
            result = await miniProgram.evaluate(
              (sel: string, innerSel?: string) => {
                return new Promise((resolve, reject) => {
                  // @ts-expect-error - wx 是小程序运行时全局对象
                  const query = wx.createSelectorQuery();

                  // 如果有 innerSelector，使用 >>> 拼接成穿透选择器，这比 selectComponent 更可靠
                  const full = innerSel ? `${sel} >>> ${innerSel}` : sel;

                  query.select(full).boundingClientRect();

                  query.exec((res: unknown[]) => {
                    if (res && res.length > 0 && res[0]) {
                      resolve(res[0]);
                    } else {
                      reject(new Error(`Element not found or not rendered: "${full}". (exec returned ${JSON.stringify(res)})`));
                    }
                  });
                });
              },
              selector,
              innerSelector
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new UserError(
              `获取元素 "${fullSelector}" 的边界矩形失败: ${message}`
            );
          }

          return toTextResult(
            formatJson({
              selector,
              innerSelector: innerSelector ?? null,
              boundingClientRect: toSerializableValue(result),
            })
          );
        }
      );
    },
  };
}
