# WeChatMCP

WeChatMCP 是一个面向微信小程序开发的本地 MCP Server。

它通过 STDIO 方式运行，供支持 MCP 的客户端在本机调用，用于连接微信开发者工具、读取页面、操作元素、调用 DevTools CLI / HTTP 接口，以及执行小程序预览、上传等工作流。

该服务依赖本地微信开发者工具、本地小程序工程路径以及本地上传私钥，因此适合在 ModelScope 中作为“仅本地可用”的 MCP 服务提交。

## 服务配置

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
        "WEAPP_AUTOMATOR_MODE": "launch",
        "WEAPP_PROJECT_PATH": "C:\\path\\to\\your\\mini-program",
        "WECHAT_DEVTOOLS_CLI_PATH": "C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat",
        "WEAPP_DEVTOOLS_PORT": "9420",
        "WEAPP_DEVTOOLS_TIMEOUT": "30000",
        "WEAPP_TRUST_PROJECT": "true",
        "WECHATMCP_LOCAL_CONFIG": "C:\\path\\to\\wechatmcp.local.json"
      }
    }
  }
}
```

## 环境变量说明

- `WEAPP_AUTOMATOR_MODE`
  控制连接模式，可选 `launch` 或 `connect`。
- `WEAPP_PROJECT_PATH`
  本地小程序项目路径。
- `WECHAT_DEVTOOLS_CLI_PATH`
  微信开发者工具 CLI 路径。
- `WEAPP_DEVTOOLS_PORT`
  微信开发者工具自动化端口。
- `WEAPP_DEVTOOLS_TIMEOUT`
  连接超时时间，单位毫秒。
- `WEAPP_TRUST_PROJECT`
  是否信任本地项目。
- `WECHATMCP_LOCAL_CONFIG`
  WeChatMCP 本地配置文件路径。

## 功能概览

WeChatMCP 提供以下能力：

- 连接或拉起微信开发者工具
- 获取当前页面、页面栈、系统信息、日志、截图
- 查询页面元素、组件数据、WXML、DOM 属性与样式
- 点击、输入、滚动、调用页面方法和组件方法
- 调用微信开发者工具 CLI / HTTP 调试接口
- 校验上传私钥
- 生成预览二维码
- 执行小程序上传

## 常用工具

- `mp_ensureConnection`
- `mp_navigate`
- `mp_currentPage`
- `mp_getLogs`
- `mp_screenshot`
- `page_getElement`
- `page_getElements`
- `page_getElementByXpath`
- `element_tap`
- `element_input`
- `element_getAttributes`
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

## 使用要求

使用 WeChatMCP 前，请确保本机已经满足以下条件：

- 已安装 Node.js 18+
- 已安装微信开发者工具
- 目标小程序项目可以在微信开发者工具中正常打开
- 已在微信开发者工具中开启 `自动化`
- 如需调用 DevTools HTTP 接口，已开启 `HTTP 调试`

如需使用预览、上传或成员管理，还需要：

- 小程序 `appid`
- 代码上传私钥文件
- 微信公众平台中的代码上传 IP 白名单

## 本地部署

如果你是从源码本地运行，而不是从 npm 安装，可以使用下面的方式：

```bash
npm install
npm run build
npm start
```

开发模式：

```bash
npm run dev
```

## 本地配置文件

WeChatMCP 支持通过本地配置文件保存连接信息和 CI 默认值。

默认文件名为：

```text
wechatmcp.local.json
```

你可以从模板文件 `wechatmcp.local.example.json` 复制一份后自行填写。

## 一条指令上传

先通过 `ci_saveDefaults` 保存默认值：

- `projectPath`
- `appid`
- `privateKeyPath`
- `robot`

保存后可直接调用：

- `ci_quickPreview`
- `ci_quickUpload`

如果不传 `version`，系统会自动生成版本号。

## ModelScope 提交建议

如果你准备将本项目提交到 ModelScope MCP 广场，建议：

- 创建方式：从 GitHub 仓库快速创建
- 托管类型：仅本地可用

原因是该服务依赖本地微信开发者工具、本地项目路径和本地私钥，不适合远程托管部署。

## 安全说明

- 不要将私钥正文写入仓库
- 推荐只在本地配置中保存 `privateKeyPath`
- 如果私钥曾在公开场景暴露，请及时轮换

## License

MIT
