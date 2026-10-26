# Setup

## Quick start

From your Android project's root:

```bash
androidmcp-framework setup
```

This writes `.android-build-mcp/config.yaml` (copied from the bundled `config.example.yaml`) if one doesn't already exist. It won't overwrite an existing config.

Then set your session defaults so you don't have to pass `projectPath`/`module`/`variant` on every tool call - either edit the file directly, or do it live once your MCP client is connected by calling `session_set_defaults`:

```json
{ "projectPath": ".", "module": ":app", "variant": "debug" }
```

Check what's active any time with `session_show_defaults`.

## The config file

`.android-build-mcp/config.yaml`, project-scoped (not global - a monorepo with several Android projects gets one per project). Every field is optional; see [`config.example.yaml`](../../config.example.yaml) in the repo root for the full annotated schema. The main sections:

- **`enabledWorkflows`** - which tool groups are exposed. See [workflow.md](./workflow.md).
- **`customWorkflows`** - enable individual tools outside their parent workflow.
- **`automationBackend`** - `adb` (zero setup), `uiautomator2` (richer, needs the Python bridge), or `auto` (tries uiautomator2, falls back to adb).
- **`disableSessionDefaults`** - set `true` to force every tool call to pass its own target/module/variant explicitly (useful for CI, where an implicit default silently picked is worse than an explicit error).
- **`sessionDefaults`** - the static baseline; `session_set_defaults` layers runtime overrides on top of this without editing the file.
- **`paths`** - override `adbPath`, `gradlePath`, `androidHome`, `javaHome`, `u2cliPath` if they're not the defaults / not on `PATH`.

## Session-default profiles

If you work across multiple Android projects from the same MCP client, `session_use_defaults_profile` switches between named profiles so each project keeps its own remembered target/module/variant instead of overwriting a single shared one:

```json
{ "profile": "my-other-app" }
```

## Verifying the environment

```bash
androidmcp-framework doctor
```

Checks `adb`, `java`, `gradle`, `ANDROID_HOME`/`ANDROID_SDK_ROOT`, the `emulator` binary, `build-tools` (for `aapt2`), and the optional `python3`/`u2cli` pair. Required checks (`adb`, `java`, `ANDROID_HOME`) failing exits non-zero - useful in a setup script or CI gate.

## Enhanced UI automation (optional)

The `adb` backend needs nothing beyond the SDK you already have. To enable the richer `uiautomator2` tier (used by `snapshot_ui`/`tap`/`swipe`/`drag`/`long_press`/`screenshot` when `automationBackend` is `uiautomator2` or `auto`):

```bash
pip install uiautomator2
python -m uiautomator2 init
```

`init` installs a small on-device service (`app-uiautomator.apk`) once per device/emulator. After that, `doctor` should report `u2cli (uiautomator2)` as OK.
