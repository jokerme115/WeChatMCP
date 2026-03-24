# WeChatMCP

WeChatMCP 是一个面向微信小程序开发的本地 MCP Server。

它通过 `stdio` 方式运行，适合接入 Codex、Cherry Studio、Cursor、Claude Desktop 等支持 MCP 的客户端，帮助模型直接调用微信开发者工具、读取页面、操作元素、执行预览和上传。

本项目依赖本地微信开发者工具、本地小程序工程以及本地私钥等资源，因此推荐在 ModelScope 创建 MCP 服务时将托管类型设置为“仅本地可用”。

## 服务介绍

WeChatMCP 主要提供三类能力：

- 小程序运行时自动化
- 微信开发者工具 CLI / HTTP 调试接口调用
- 小程序 CI 预览、上传、成员管理相关能力

当前已经在真实项目上验证通过：

- 连接微信开发者工具
- 读取页面与元素
- 点击、输入、截图
- 调用 DevTools CLI / HTTP
- 校验上传私钥
- 生成预览二维码
- 执行实际上传

## 服务配置

下面是本项目用于本地接入的标准 `STDIO` MCP 配置。

```json
{
  "mcpServers": {
    "WeChatMCP": {
      "command": "node",
      "args": [
        "C:\\path\\to\\WeChatMCP\\dist\\index.js"
      ],
      "env": {
        "WEAPP_AUTOMATOR_MODE": "launch",
        "WEAPP_PROJECT_PATH": "C:\\path\\to\\your\\mini-program",
        "WECHAT_DEVTOOLS_CLI_PATH": "C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat",
        "WEAPP_DEVTOOLS_PORT": "9420",
        "WEAPP_DEVTOOLS_TIMEOUT": "30000",
        "WEAPP_TRUST_PROJECT": "true",
        "WECHATMCP_LOCAL_CONFIG": "C:\\path\\to\\WeChatMCP\\wechatmcp.local.json"
      }
    }
  }
}
```

说明：

- `command` 使用本地 `node`
- `args` 指向构建后的 `dist/index.js`
- `env` 中的值建议全部使用大写环境变量形式维护
- 该配置适合本地使用，不适合远程托管部署

如果你后续将包发布到 npm，也可以把 `command` 改成 `npx`，但当前仓库默认以源码本地部署为主。

## 环境要求

在使用 WeChatMCP 前，请确保本机已经满足以下条件：

- 已安装 Node.js 18+
- 已安装微信开发者工具
- 目标小程序项目可以在微信开发者工具中正常打开
- 已在微信开发者工具中开启 `自动化`
- 如需使用 DevTools HTTP 相关工具，已开启 `HTTP 调试`

如需使用上传、预览或成员管理能力，还需要：

- 小程序 `appid`
- 代码上传私钥文件
- 微信公众平台中已配置代码上传 IP 白名单

## 本地部署

### 1. 安装依赖

```bash
npm install
```

### 2. 构建

```bash
npm run build
```

### 3. 本地运行

```bash
npm start
```

开发模式：

```bash
npm run dev
```

## 本地配置文件

项目支持使用本地配置文件 `wechatmcp.local.json` 保存连接信息与 CI 默认值。

你可以从模板开始：

```bash
copy wechatmcp.local.example.json wechatmcp.local.json
```

模板内容示例：

```json
{
  "connection": {
    "mode": "launch",
    "projectPath": "C:\\path\\to\\your\\mini-program",
    "cliPath": "C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat",
    "port": 9420,
    "timeout": 30000,
    "trustProject": true
  },
  "ciDefaults": {
    "projectPath": "C:\\path\\to\\your\\mini-program",
    "appid": "wx1234567890abcdef",
    "privateKeyPath": "C:\\path\\to\\private.key",
    "robot": 1,
    "qrcodeFormat": "terminal"
  }
}
```

说明：

- `connection` 用于自动化连接默认值
- `ciDefaults` 用于 `ci_quickPreview` 和 `ci_quickUpload`
- 本地配置文件已被 `.gitignore` 忽略

## 常用工具

### 连接与页面操作

- `mp_ensureConnection`
- `mp_navigate`
- `mp_currentPage`
- `mp_getLogs`
- `mp_screenshot`

### 页面与元素读取

- `page_getElement`
- `page_getElements`
- `page_getElementByXpath`
- `element_tap`
- `element_input`
- `element_getAttributes`
- `element_getWxml`

### DevTools

- `dt_httpPort`
- `dt_httpRequest`
- `dt_cli`

### CI

- `ci_showDefaults`
- `ci_saveDefaults`
- `ci_validateKey`
- `ci_quickPreview`
- `ci_quickUpload`
- `ci_preview`
- `ci_upload`

## 一条指令上传

第一次使用时，先通过 `ci_saveDefaults` 保存默认值：

```json
{
  "projectPath": "C:\\path\\to\\your\\mini-program",
  "appid": "wx1234567890abcdef",
  "privateKeyPath": "C:\\path\\to\\private.key",
  "robot": 1
}
```

后续直接调用：

- `ci_quickPreview`
- `ci_quickUpload`

如果不传 `version`，系统会自动生成版本号。

## 与 ModelScope 提交相关的说明

按照 ModelScope 创建 MCP 服务文档，这个项目已经满足快速创建所需的核心要素：

- 根目录有 `README.md`
- README 正文中包含了服务介绍
- README 正文中包含了有效的 `STDIO` 服务配置
- README 中提供了本地使用指引

由于本项目依赖本地微信开发者工具、本地工程路径和本地私钥，提交到 ModelScope 时建议：

- 创建方式：优先使用“从 GitHub 仓库快速创建”
- 托管类型：选择“仅本地可用”

## 目录说明

- `src/`：MCP Server 源码
- `wechatmcp.local.example.json`：本地配置模板
- `.env.example`：环境变量模板

## 安全说明

- 不要把私钥正文提交进仓库
- 推荐只在本地配置文件中保存 `privateKeyPath`
- 如果私钥曾在聊天、截图或其他公开场景暴露，请及时轮换

## License

MIT
