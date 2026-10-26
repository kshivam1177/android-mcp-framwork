# Fast UI Form Automation

## Motivation

Repeated screenshot capture, AI interpretation, coordinate discovery, and action calls introduce unnecessary latency when completing ordinary form interactions. AndroidBuildMCP can reduce this overhead by resolving stable UI hierarchy selectors locally and issuing a sequence of input actions through one MCP tool call.

## Current prototype

The `fill_form` tool accepts selectors based on text, resource ID, content description, and class name; it rejects ambiguous matches and can optionally submit the form. It refreshes the hierarchy around field actions because the keyboard may shift the visible controls.

## Important limitations

- This first version consumes the Android UI hierarchy; it does not yet perform screenshot-only OpenCV element detection.
- Coordinate maps are not assumed valid across screen transitions or keyboard changes.
- A successful tool result means input actions were issued, not that backend validation or submission succeeded.
- Run a clean install, build/typecheck, unit tests, and emulator validation before a stable release.

## Next steps

1. Integrate with the existing shared automation backend and session/device defaults.
2. Add a screen fingerprint and short-lived UI-map cache.
3. Add benchmark scenarios comparing latency and action counts to screenshot-per-action automation.
4. Verify text replacement semantics and selector behavior across Android versions and custom UI widgets.