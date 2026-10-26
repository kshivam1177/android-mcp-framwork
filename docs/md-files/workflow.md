# Workflows

A **workflow** is a named group of related tools. Instead of handing an agent all 66 tools at once, AndroidMCP Framework starts with a small default set and lets you turn the rest on as you need them - fewer tools in context, less chance of the wrong tool getting picked.

## Default state

Five workflows ship enabled: `device`, `ui-automation`, `session-management`, `doctor`, and `workflow-discovery`. That combination covers the common loop - build, install, launch, interact with the UI, and diagnose problems - without needing any config file at all.

Everything else (`emulator-management`, `debugging`, `project-discovery`, `gradle-module`, `android-cli`, `testing-intelligence`) is opt-in.

## Full list

| Workflow | Tools | Default | Description |
|---|---|---|---|
| `device` | 11 | on | Build, install, launch, stop, test, and transfer files to/from Android targets - emulators and physical devices together, since adb doesn't distinguish the way Xcode's simctl/devicectl split does. |
| `emulator-management` | 10 | off | Create, boot, wipe, and configure AVDs: location, dark/light appearance, status-bar demo mode, screen recording. |
| `ui-automation` | 13 | on | Semantic UI snapshots (elementRef-based) plus tap/swipe/drag/type/key/gesture/screenshot/wait/batch. |
| `debugging` | 6 | off | Logcat streaming, crash and ANR extraction, log clearing, full adb bugreport. Log/crash-focused by design - no JDWP breakpoint debugging in this version. |
| `coverage` | 2 | off | Read JaCoco XML coverage reports, overall and per source file. |
| `project-discovery` | 4 | off | Find Gradle project roots, list modules and build variants, inspect build configuration. |
| `gradle-module` | 5 | off | Build/test/run/list/stop a standalone Gradle module (pure-JVM/Kotlin library or CLI) - the roughest analogy in this project to Xcode's swift-package workflow; Android has no exact equivalent to a runnable SPM target. |
| `session-management` | 4 | on | View, set, clear, and switch between named session-default profiles (projectPath/module/variant/targetId/...). |
| `doctor` | 1 | on | Environment diagnostics: adb, java, gradle, Android SDK, emulator, ADB-based UI automation. |
| `workflow-discovery` | 1 | on | List and toggle which workflows are enabled for this running server session. |
| `android-cli` | 6 | off | Optional integration with Google Android CLI 1.0: environment info, Android Studio semantic analysis/navigation, dependency version lookup, and skills discovery. |

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
