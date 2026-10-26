# Declarative UI workflows

The runner uses Node.js built-in modules for file access, path validation, child-process execution, timeouts, and report writing. It adds no runtime dependencies. Google Android CLI is the preferred adapter for semantic UI inspection and input; ADB is used only for explicit coordinate tap fallbacks.

## File layout

```text
.android-build-mcp/
  screens/
    login.json
    home.json
  workflows/
    login-flow.json
  test-reports/
    YYYY-MM-DD/
      HHMMSS-<run-id>/
        workflow-report.json
```

Example screen definition:

```json
{
  "schemaVersion": "1.0",
  "id": "login",
  "name": "Login",
  "screenshot": { "width": 1080, "height": 2400 },
  "detection": { "requiredElements": ["email", "password", "submit"] },
  "form": [
    { "id": "email", "type": "input", "selector": { "resourceId": "com.example:id/email" }, "required": true },
    { "id": "password", "type": "input", "selector": { "resourceId": "com.example:id/password" }, "required": true, "sensitive": true },
    { "id": "submit", "type": "button", "selector": { "text": "Sign in" }, "required": true }
  ]
}
```

Example workflow:

```json
{
  "schemaVersion": "1.0",
  "id": "login-flow",
  "name": "Login flow",
  "forms": { "login": "login.json", "home": "home.json" },
  "actions": [
    { "id": "check-login", "type": "assert_screen", "screen": "login", "timeoutMs": 10000 },
    { "id": "email", "type": "type", "screen": "login", "element": "email", "value": "${env:TEST_EMAIL}" },
    { "id": "password", "type": "type", "screen": "login", "element": "password", "value": "${env:TEST_PASSWORD}" },
    { "id": "submit", "type": "tap", "screen": "login", "element": "submit" },
    { "id": "check-home", "type": "wait_for_screen", "screen": "home", "timeoutMs": 20000 }
  ],
  "settings": { "stopOnFailure": true, "verifyAfterAction": true }
}
```

Supported actions are `tap`, `type`, `wait`, `wait_for_screen`, `assert_screen`, `back`, and `key`. Prefer semantic selectors over fixed coordinates. Environment placeholders use `${env:VARIABLE_NAME}`; the value is resolved at runtime and never copied into the report.

Call MCP tool `run_ui_workflow` with a workflow JSON path relative to `.android-build-mcp/workflows/`. Absolute paths and traversal outside managed directories are rejected. Workflow files are size-limited, action counts and types are validated, and workflow text is never evaluated as code. Reports are written under `.android-build-mcp/test-reports/`.

Install Google Android CLI separately and make `android` available on `PATH`, or set `ANDROID_CLI_PATH`. Install ADB for coordinate fallback. The runner executes the whole workflow in one MCP call and stops on the first failed step by default.
