# Workflows

A **workflow** is a named group of related tools. AndroidMCP Framework enables six workflows by default, including testing intelligence, and lets you turn optional workflows on as needed.

## Default state

Six workflows ship enabled: `device`, `ui-automation`, `session-management`, `doctor`, `workflow-discovery`, and `testing-intelligence`. This includes test-project analysis, screen audits, test-case persistence, and report writing without a manual enable step.

Everything else (`emulator-management`, `debugging`, `project-discovery`, `gradle-module`, and `android-cli`) is opt-in.

## Full list

| Workflow | Tools | Default | Description |
|---|---|---|---|
| `device` | 11 | on | Build, install, launch, stop, test, and transfer files to/from Android targets - emulators and physical devices together, since adb doesn't distinguish the way Xcode's simctl/devicectl split does. |
| `emulator-management` | 10 | off | Create, boot, wipe, and configure AVDs: location, dark/light appearance, status-bar demo mode, screen recording. |
| `ui-automation` | 18 | on | Semantic snapshots, screenshot OCR, selector-based form filling, JSON UI workflows, and device interactions. |
| `debugging` | 6 | off | Logcat streaming, crash and ANR extraction, log clearing, full adb bugreport. Log/crash-focused by design - no JDWP breakpoint debugging in this version. |
| `project-discovery` | 4 | off | Find Gradle project roots, list modules and build variants, inspect build configuration. |
| `gradle-module` | 5 | off | Build/test/run/list/stop a standalone Gradle module (pure-JVM/Kotlin library or CLI) - the roughest analogy in this project to Xcode's swift-package workflow; Android has no exact equivalent to a runnable SPM target. |
| `session-management` | 4 | on | View, set, clear, and switch between named session-default profiles (projectPath/module/variant/targetId/...). |
| `doctor` | 1 | on | Environment diagnostics: adb, Java, Gradle, Android SDK, emulator, optional Android CLI and Tesseract OCR. |
| `workflow-discovery` | 1 | on | List and toggle which workflows are enabled for this running server session. |
| `android-cli` | 6 | off | Optional integration with Google Android CLI 1.0: environment info, Android Studio semantic analysis/navigation, dependency version lookup, and skills discovery. |\n| `testing-intelligence` | 10 | on | Project test discovery, saved test cases/instructions, screen QA audits, change-impact analysis, plan validation, and reports. |

See [tools.md](./tools.md) for every individual tool.

## Turning workflows on persistently

Edit `.androidmcp-framework/config.yaml`:

```yaml
enabledWorkflows:
  - device
  - ui-automation
  - session-management
  - doctor
  - workflow-discovery
  - android-cli # optional: requires Google Android CLI installed separately
  - emulator-management   # <- added
  - coverage              # <- added
```

An explicit `enabledWorkflows: []` means *nothing* is enabled - it does not fall back to the defaults. Restart your MCP client after editing.

## Turning workflows on for just this session

Call the `manage_workflows` tool (part of `workflow-discovery`, which is why it's on by default - without it there'd be no way to enable anything else at runtime):

```json
{ "action": "enable", "workflowName": "emulator-management" }
```

```json
{ "action": "list" }
```

Session-only changes don't touch `config.yaml` and don't survive a server restart.

## Custom workflows

`customWorkflows` in `config.yaml` lets you enable individual tools by name, independent of their parent workflow - useful for a narrow use case like a CI smoke-test agent:

```yaml
customWorkflows:
  ci-smoke:
    - build_run_device
    - get_crash_report
    - stop_app_device
```

Any tool listed under a custom workflow is enabled even if its real workflow isn't.

## CLI

`androidmcp-framework workflows` prints this same table from the command line, no MCP client needed.


| `testing-intelligence` | Disabled | Repository analysis, persistent test instructions, timestamped reports; foundation for change-aware testing. |
