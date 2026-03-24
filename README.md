# WeChatMCP

WeChatMCP 是一个面向微信小程序开发的 MCP Server，提供页面自动化、元素操作、开发者工具控制、预览、上传与成员管理能力。它同时支持 `STDIO` 与 `Streamable HTTP` 两种连接方式，既可以本地接入 Codex / Claude / Cursor / Cherry Studio，也可以按 ModelScope MCP 广场的要求进行提交与托管检测。

## 服务配置（STDIO，ModelScope 托管部署）

```json
{
  "mcpServers": {
    "WeChatMCP": {
      "command": "npx",
      "args": [
        "-y",
        "wechatmcp@latest"
      ]
    }
  }
}
```

## 服务配置（STDIO，本地完整能力）

```json
{
  "mcpServers": {
    "WeChatMCP": {
      "command": "npx",
      "args": [
        "-y",
        "wechatmcp@latest"
      ],
      "env": {
        "WECHATMCP_CONFIG": "C:\\path\\to\\wechatmcp.config.json",
        "WECHATMCP_LOCAL_CONFIG": "C:\\path\\to\\wechatmcp.local.json",
        "WEAPP_AUTOMATOR_MODE": "launch",
        "WEAPP_PROJECT_PATH": "C:\\path\\to\\your\\mini-program",
        "WECHAT_DEVTOOLS_CLI_PATH": "C:\\path\\to\\wechat-devtools\\cli.bat",
        "WEAPP_DEVTOOLS_PORT": "9420",
        "WEAPP_DEVTOOLS_TIMEOUT": "30000",
        "WEAPP_TRUST_PROJECT": "true"
      }
    }
  }
}
```

## 服务配置（Streamable HTTP，自托管）

```json
{
  "mcpServers": {
    "WeChatMCP": {
      "type": "streamable_http",
      "url": "http://127.0.0.1:3333/mcp"
    }
  }
}
```

## 服务介绍

WeChatMCP 把微信小程序相关的开发能力封装为 MCP 工具，便于模型直接调用：

- 连接或拉起微信开发者工具
- 读取当前页面、页面栈、日志、截图和页面数据
- 查询元素属性、样式、WXML、组件数据与组件方法
- 执行点击、输入、滚动、页面导航、调用 `wx.*`
- 调用微信开发者工具 CLI 与 HTTP 调试接口
- 校验上传私钥、生成预览二维码、执行上传
- 进行云开发上传与成员管理
- 提供 `server_runtimeInfo`，便于在托管环境中直接测试服务运行状态

## 运行模式

### STDIO

适合本地 MCP Client 直接启动本服务，例如 Codex、Claude Desktop、Cursor、Cherry Studio，以及 ModelScope 对 `STDIO` 类型服务的快速解析与托管检测。

本地从源码运行：

```bash
npm install
npm run build
npm start
```

开发模式：

```bash
npm run dev
```

### Streamable HTTP

适合你把 WeChatMCP 部署到一台本机、开发机或服务器上，再通过 URL 暴露给支持远程 MCP 的客户端。

从源码运行：

```bash
npm install
npm run build
npm run start:http
```

开发模式：

```bash
npm run dev:http
```

默认地址：

- MCP Endpoint: `http://127.0.0.1:3333/mcp`
- Health Endpoint: `http://127.0.0.1:3333/health`

也可以使用参数覆盖：

```bash
node dist/index.js --transport httpStream --host 0.0.0.0 --port 3333 --endpoint /mcp
```

## 配置文件

WeChatMCP 支持共享配置与本地私有配置同时存在：

- `wechatmcp.config.json`
  适合存放服务级默认值，例如传输模式、HTTP 监听地址、健康检查路径。
- `wechatmcp.local.json`
  适合存放本机项目路径、开发者工具路径、`appid`、`privateKeyPath` 等私有信息。

配置优先级从低到高如下：

1. `wechatmcp.config.json`
2. `wechatmcp.local.json`
3. 环境变量
4. CLI 参数
5. 工具调用参数

项目已提供：

- `.env.example`
- `wechatmcp.config.json`
- `wechatmcp.local.example.json`

## 环境变量

常用变量如下：

- `WECHATMCP_CONFIG`
  共享配置文件路径。
- `WECHATMCP_LOCAL_CONFIG`
  本地私有配置文件路径。
- `WECHATMCP_TRANSPORT`
  可选 `stdio`、`httpStream`、`streamable-http`。
- `WECHATMCP_HOST`
  Streamable HTTP 监听地址。
- `WECHATMCP_PORT`
  Streamable HTTP 监听端口。
- `WECHATMCP_ENDPOINT`
  Streamable HTTP MCP 路径。
- `WECHATMCP_HEALTH_ENABLED`
  是否开启健康检查。
- `WECHATMCP_HEALTH_PATH`
  健康检查路径。
- `WEAPP_AUTOMATOR_MODE`
  可选 `launch` 或 `connect`。
- `WEAPP_PROJECT_PATH`
  小程序项目路径。
- `WEAPP_WS_ENDPOINT`
  已打开微信开发者工具时的 websocket 地址。
- `WECHAT_DEVTOOLS_CLI_PATH`
  微信开发者工具 CLI 路径。
- `WEAPP_DEVTOOLS_PORT`
  开发者工具自动化端口。
- `WEAPP_DEVTOOLS_TIMEOUT`
  超时时间，单位毫秒。
- `WEAPP_TRUST_PROJECT`
  是否信任当前项目。

## 常用工具

- `server_runtimeInfo`
- `mp_ensureConnection`
- `mp_navigate`
- `mp_currentPage`
- `mp_getLogs`
- `mp_screenshot`
- `page_getElement`
- `page_getElements`
- `page_getData`
- `page_callMethod`
- `element_tap`
- `element_input`
- `element_getAttributes`
- `element_getStyles`
- `element_getWxml`
- `dt_httpPort`
- `dt_httpRequest`
- `dt_cli`
- `ci_showDefaults`
- `ci_saveDefaults`
- `ci_validateKey`
- `ci_quickPreview`
- `ci_quickUpload`
- `ci_preview`
- `ci_upload`
- `mpci_manageMembers`

## 一条指令上传

先通过 `ci_saveDefaults` 保存默认值，通常至少包含：

- `projectPath`
- `appid`
- `privateKeyPath`
- `robot`

保存之后即可直接调用：

- `ci_quickPreview`
- `ci_quickUpload`

如果不传 `version`，WeChatMCP 会自动生成版本号。

## 使用要求

使用本服务前，请确认：

- 已安装 Node.js 18+
- 已安装微信开发者工具
- 目标小程序项目可以在微信开发者工具中正常打开
- 已在微信开发者工具中开启“自动化”
- 如需使用 HTTP 调试工具，已开启“HTTP 调试”

如需使用预览、上传、成员管理，还需要：

- 小程序 `appid`
- 代码上传私钥文件
- 微信公众平台中的上传 IP 白名单

## ModelScope 部署说明

根据 ModelScope MCP 广场官方文档，想要从 GitHub 快速创建并通过托管检测，README 根目录中必须包含有效的 `STDIO` 配置，而且建议使用 `npx` 或 `uvx`，JSON 代码块中不能写注释。当同时提供多种配置时，平台会优先按 `STDIO > StreamableHttp > SSE` 的顺序选择检测对象，并默认采用第一个服务配置进行部署检测。

因此本仓库把最上方的第一个配置块固定为“最小可托管 STDIO 配置”，不再要求用户提前填写本地绝对路径或私有参数。这样 ModelScope 在托管检测时可以直接安装 `wechatmcp@latest`，启动服务并执行 `list_tools`。

推荐的提交方式：

1. 在 ModelScope 选择“从 GitHub 仓库快速创建”。
2. 仓库地址填写 `https://github.com/jokerme115/WeChatMCP`。
3. 若你希望平台执行托管检测，选择“可托管部署”。
4. 若你只是想发布给本地用户使用，也可以选择“仅本地可用”。

## ModelScope Hosted 能力边界

根据 ModelScope 官方文档，平台托管环境会为用户提供远程服务化能力，并在连接后分配专属 `SSE URL`。但官方也明确说明：托管检测目前只验证能否成功连接并调用 `list_tools`，并不保证每个工具在托管环境中都可正常工作。

这对 WeChatMCP 很重要：

- `server_runtimeInfo` 这类纯服务级工具可以直接在托管环境中使用。
- 微信开发者工具自动化、页面读取、元素操作、预览、上传等工具，本质上仍依赖本地微信开发者工具、本地小程序工程或私钥。
- 因此如果你的目标是真正操作小程序，推荐使用本地 `STDIO` 模式，或者在你自己的 Windows 机器上以 `Streamable HTTP` 方式自托管。

## ModelScope 免费资源限制

按官方文档当前说明，免费部署资源存在以下限制：

- 每位用户最多可创建 `20` 个免费部署的 MCP 服务。
- 每个 MCP 服务最多仅允许存在 `1` 个免费部署实例。
- 任意 `5` 秒窗口内总请求次数不得超过 `500` 次。
- 单个用户的 MCP 请求总量限制为 `50000` 次，请求类型包含 `initialize`、`list_tools`、`tool_call` 等。

如果你需要更稳定的线上运行，官方建议使用个人专属云资源。

## 安全说明

- 不要把私钥正文写入仓库。
- 推荐只在 `wechatmcp.local.json` 中保存 `privateKeyPath`。
- 如果私钥曾经暴露，请立即轮换。
- ModelScope 提供的 Hosted SSE URL 属于敏感连接地址，不应外泄。

## License

MIT
