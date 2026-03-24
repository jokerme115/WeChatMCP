import { createApplicationTools } from "./tools/application.js";
import { createCiTools } from "./tools/ci.js";
import { AnyTool } from "./tools/common.js";
import { createDevtoolsTools } from "./tools/devtools.js";
import { createElementTools } from "./tools/element.js";
import { createMiniProgramTools } from "./tools/miniprogram.js";
import { createNativeTools } from "./tools/native.js";
import { createPageTools } from "./tools/page.js";
import { createServerTools } from "./tools/server.js";
import { WeappAutomatorManager } from "./weappClient.js";

export function createTools(manager: WeappAutomatorManager): AnyTool[] {
  return [
    ...createServerTools(),
    ...createApplicationTools(manager),
    ...createDevtoolsTools(),
    ...createCiTools(),
    ...createMiniProgramTools(manager),
    ...createNativeTools(manager),
    ...createPageTools(manager),
    ...createElementTools(manager),
  ];
}
