# WeChatMCP

> 一个面向 Codex / Cursor / Claude / Cherry Studio 等 MCP Client 的生产级工具服务器。
> 目标不是“做一个 MCP 演示”，而是让代码模型真正拥有可调用的微信小程序开发能力。

WeChatMCP 把三类能力整合到同一个项目里，并以 MCP Server 的形式暴露给上层模型：

- `miniprogram-automator` 运行时自动化
- 微信开发者工具 `CLI / HTTP v2`
- `miniprogram-ci` / `miniprogram-mp-ci` 的构建、预览、上传与成员管理

它适合下面这些场景：

- 让 AI 助手直接操控你已经打开的小程序项目
- 通过 MCP 自动读取页面、点击、输入、截图、调试
- 统一管理 DevTools、CI 上传、预览二维码和云开发上传
- 把 MCP 服务部署到一台服务器上，通过 HTTP 端点供外部客户端调用

## Highlights

- 双运行模式：同时支持 `stdio` 和 `httpStream`
- 双配置层：支持共享配置文件和本地私有配置文件
- 一键上传：保存一次默认值后，后续直接 `ci_quickUpload`
- 面向 Codex-like clients：内置 Codex / Cursor / Claude / Cherry Studio 配置模板
- 面向真实项目验证：已在真实微信小程序工程上通过连接、页面操控、预览和上传测试
- 对 GitHub 友好：内置 `LICENSE`、配置模板、客户端示例和环境变量模板

## Positioning

如果把关系讲清楚，WeChatMCP 的定位其实很简单：

- WeChatMCP 是 `MCP Server`
- Codex / Cursor / Claude / Cherry Studio 是 `MCP Client`
- 你的真实目标是：让这些模型通过 MCP 来调用微信小程序开发工具链

换句话说，WeChatMCP 不是终点，而是模型的“工具能力层”。

## Architecture

WeChatMCP 采用四层结构：

1. 运行时自动化层：连接微信开发者工具、控制页面、读取元素与组件状态
2. DevTools 控制层：封装微信开发者工具 CLI 与 HTTP 调试接口
3. CI 发布层：统一处理预览、上传、SourceMap、云开发、成员管理
4. 配置编排层：把 `JSON 配置文件`、`本地私有配置`、`环境变量` 与 `CLI 参数` 合并成最终运行配置

## Features

### 小程序自动化

- 启动或连接微信开发者工具
- 获取页面栈、系统信息、日志、截图
- 页面跳转、点击、输入、等待元素
- 读取 WXML、DOM 属性、样式、组件数据
- XPath、嵌套组件、scroll-view 等能力

### DevTools 控制

- 自动发现 HTTP 调试端口
- 调用 HTTP v2 调试接口
- 调用 DevTools CLI 命令

### CI 与发布

- `ci_validateKey`
- `ci_preview`
- `ci_upload`
- `ci_quickPreview`
- `ci_quickUpload`
- `ci_packNpm`
- `ci_analyseCode`
- 云开发函数 / 静态资源 / 存储 / 容器上传
- 小程序成员管理

## Run Modes

### 1. 本地客户端模式：`stdio`

适合：

- Claude Desktop
- Cursor
- Cherry Studio
- 任何只接受本地命令启动 MCP 的客户端

启动方式：

```bash
npm install
npm run build
npm start
```

开发时：

```bash
npm run dev
```

### 2. 服务器模式：`httpStream`

适合：

- 需要把 WeChatMCP 部署成一个网络服务
- 需要通过 URL 形式接入支持远程 MCP 的客户端
- 希望统一暴露 `/mcp` 和 `/health`

启动方式：

```bash
npm run build
npm run start:http
```

开发时：

```bash
npm run dev:http
```

默认监听：

- MCP 端点：`http://127.0.0.1:3333/mcp`
- 健康检查：`http://127.0.0.1:3333/health`

也可以使用命令行参数覆盖：

```bash
node dist/index.js --transport httpStream --host 0.0.0.0 --port 3333 --endpoint /mcp
```

## Codex Integration

如果你主要面向的是 Codex，这一部分最重要。

WeChatMCP 可以按两种方式接入 Codex：

Codex CLI 与 IDE 扩展可以共用同一份配置，通常位于：

```text
~/.codex/config.toml
```

### 1. Codex 本地 `stdio` 模式

适合本机开发、调试、直接操控本地 DevTools。

配置文件：

- `examples/mcp/codex-stdio.toml`

核心思路：

```toml
[mcp_servers.WeChatMCP]
command = "node"
args = ["C:\\path\\to\\WeChatMCP\\dist\\index.js"]
```

### 2. Codex 远程 `http` 模式

适合把 WeChatMCP 部署成一个 MCP 服务，再由 Codex 远程调用。

配置文件：

- `examples/mcp/codex-http.toml`

核心思路：

```toml
[mcp_servers.WeChatMCP]
url = "http://127.0.0.1:3333/mcp"
```

### 3. 让 Codex 更稳定地使用它

项目提供了：

- `AGENTS.example.md`

你可以把其中的提示词片段放进自己的 `AGENTS.md`，告诉 Codex：

- 什么时候优先使用 WeChatMCP
- 什么时候先读页面状态再执行操作
- 什么时候用 `ci_quickUpload`

## Requirements

使用 WeChatMCP 之前，请先确认：

- 已安装微信开发者工具
- 目标小程序项目可以被微信开发者工具正常打开
- 已在微信开发者工具中开启 `自动化`
- 如需 DevTools HTTP 工具，已开启 `HTTP 调试`

如果要使用上传、预览或成员管理，还需要：

- 小程序 `appid`
- 代码上传私钥 `privateKeyPath`
- 微信公众平台中已正确配置代码上传 IP 白名单

## Configuration System

WeChatMCP 现在支持四级配置合并，优先级从低到高如下：

1. 仓库共享配置：`wechatmcp.config.json`
2. 本地私有配置：`wechatmcp.local.json`
3. 环境变量：`.env` 或系统环境变量
4. 工具调用参数 / CLI 参数

这意味着：

- 团队可以把通用配置提交到 GitHub
- 每位开发者只把自己的敏感配置放在本地私有文件
- 线上部署可以用环境变量覆盖
- 临时测试可以在工具调用时显式传参

### 共享配置文件

文件：`wechatmcp.config.json`

适合存放：

- 服务名称
- 运行模式默认值
- HTTP 监听地址
- 健康检查路径
- DevTools 常规端口
- 非敏感的 CI 默认值，比如 `robot`

### 本地私有配置文件

文件：`wechatmcp.local.json`

适合存放：

- 本机项目路径
- WebSocket 地址
- DevTools CLI 绝对路径
- `appid`
- `privateKeyPath`

该文件已被 `.gitignore` 忽略，不会被提交到仓库。

兼容说明：

- 旧版本的 `weapp-dev.local.json` 仍然会被自动读取
- 新版本默认使用 `wechatmcp.local.json`

### 环境变量模板

项目已提供：

- `.env.example`

常用变量包括：

```bash
WECHATMCP_TRANSPORT=stdio
WECHATMCP_HOST=127.0.0.1
WECHATMCP_PORT=3333
WECHATMCP_ENDPOINT=/mcp
WECHATMCP_CONFIG=./wechatmcp.config.json
WECHATMCP_LOCAL_CONFIG=./wechatmcp.local.json

WEAPP_AUTOMATOR_MODE=launch
WEAPP_PROJECT_PATH=
WEAPP_WS_ENDPOINT=
WEAPP_DEVTOOLS_PORT=9420
WECHAT_DEVTOOLS_CLI_PATH=C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat
WEAPP_TRUST_PROJECT=true
```

## Quick Start

### 场景 A：本地接入 Claude / Cursor / Cherry Studio

1. 安装依赖并构建

```bash
npm install
npm run build
```

2. 复制本地模板

```bash
copy wechatmcp.local.example.json wechatmcp.local.json
```

3. 把 `wechatmcp.local.json` 里的项目路径、`appid`、私钥路径改成你的真实值

4. 在 MCP 客户端中把启动命令指向：

```bash
node C:\path\to\WeChatMCP\dist\index.js
```

### 场景 B：部署成远程 MCP 服务

1. 修改 `wechatmcp.config.json`
2. 将 `server.transportType` 改为 `httpStream`
3. 设置 `host`、`port`、`endpoint`
4. 启动：

```bash
npm run start:http
```

5. 在支持远程 MCP 的客户端中使用：

```text
http://YOUR_HOST:3333/mcp
```

## One-Command Upload

WeChatMCP 内置了“只保存一次，后续一条指令上传”的工作流。

### 第一次保存默认值

调用 `ci_saveDefaults`，至少保存：

- `projectPath`
- `privateKeyPath`
- `appid`
- `robot` 可选

示例：

```json
{
  "projectPath": "C:\\path\\to\\mini-program",
  "appid": "wx1234567890abcdef",
  "privateKeyPath": "C:\\path\\to\\private.key",
  "robot": 1
}
```

### 之后快速预览

```json
{}
```

调用工具：

- `ci_quickPreview`

### 之后快速上传

```json
{}
```

调用工具：

- `ci_quickUpload`

如果不传 `version`，WeChatMCP 会自动生成版本号。

## Provided Files

项目里已经整理好了这些配置与模板文件：

- `wechatmcp.config.json`：共享配置
- `wechatmcp.local.example.json`：本地私有配置模板
- `.env.example`：环境变量模板
- `AGENTS.example.md`：给 Codex / Cursor 一类 agent 的提示模板
- `examples/mcp/codex-stdio.toml`
- `examples/mcp/codex-http.toml`
- `examples/mcp/claude-desktop-stdio.json`
- `examples/mcp/cherry-studio-stdio.json`
- `examples/mcp/cursor-stdio.json`
- `examples/mcp/generic-http-client.json`
- `LICENSE`

## MCP Client Examples

### Codex

示例文件：

- `examples/mcp/codex-stdio.toml`
- `examples/mcp/codex-http.toml`
- `AGENTS.example.md`

### Claude Desktop

示例文件：

- `examples/mcp/claude-desktop-stdio.json`

### Cherry Studio

示例文件：

- `examples/mcp/cherry-studio-stdio.json`

### Cursor

示例文件：

- `examples/mcp/cursor-stdio.json`

### 通用远程 HTTP 客户端

示例文件：

- `examples/mcp/generic-http-client.json`

适用于支持 `streamable-http` 的 MCP 客户端。

## Tool Groups

### Runtime

- `mp_ensureConnection`
- `mp_navigate`
- `mp_currentPage`
- `mp_getLogs`
- `mp_screenshot`

### MiniProgram

- `mp_pageStack`
- `mp_systemInfo`
- `mp_checkVersion`
- `mp_callWx`
- `mp_callPluginWx`
- `mp_mockWx`
- `mp_evaluate`
- `mp_remote`

### Page / Element

- `page_*`
- `element_*`
- `mp_native`

### DevTools

- `dt_httpPort`
- `dt_httpRequest`
- `dt_cli`

### CI / Delivery

- `ci_showDefaults`
- `ci_saveDefaults`
- `ci_validateKey`
- `ci_quickPreview`
- `ci_quickUpload`
- `ci_preview`
- `ci_upload`
- `ci_packNpm`
- `ci_analyseCode`
- `ci_cloud*`
- `mpci_manageMembers`

## Security Notes

- 不要把私钥正文直接提交进仓库
- 推荐只在 `wechatmcp.local.json` 中保存 `privateKeyPath`
- 上传与预览不仅依赖私钥，也依赖微信公众平台中的 IP 白名单
- 如果私钥曾在聊天、截图或公开场景中暴露，请及时轮换

## Real-World Validation

目前已经在真实小程序项目上验证通过：

- 连接微信开发者工具
- 读取页面和元素
- 点击、输入、截图
- 调用 DevTools HTTP 和 CLI
- 校验私钥
- 生成预览二维码
- 执行实际上传

## Development

```bash
npm install
npm run build
```

本地开发：

```bash
npm run dev
```

本地开发 HTTP 服务：

```bash
npm run dev:http
```

## License

MIT
