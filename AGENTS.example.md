# AGENTS.md Example For WeChatMCP

Use `WeChatMCP` whenever the task involves WeChat Mini Program development, WeChat DevTools control, UI automation, CI preview, or CI upload.

Before acting on the page:

1. Ensure the connection is ready.
2. Read the current page or relevant elements first.
3. Prefer state inspection before navigation or clicks.

For release workflows:

1. Prefer `ci_showDefaults` to confirm local defaults.
2. Use `ci_quickPreview` before `ci_quickUpload` when preview verification is needed.
3. Use `ci_quickUpload` for the final upload when defaults are already configured.

If a task only needs WeChat DevTools status or CLI information, prefer the lighter tools first:

- `dt_httpPort`
- `dt_httpRequest`
- `dt_cli`

If credentials are missing, explain what is required instead of guessing:

- `appid`
- `privateKeyPath`
- WeChat upload IP whitelist
