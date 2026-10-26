# AndroidBuildMCP

AndroidBuildMCP is an MCP server and CLI that gives coding agents tools for Android development, including project discovery, Gradle builds, emulator and physical-device operations, UI automation, debugging, coverage, and testing intelligence.

## Requirements

- Node.js 18 or newer
- Android SDK Platform Tools (`adb`)
- Gradle for projects that use Gradle
- An Android emulator or connected device for device operations

## Setup

```bash
npm ci
npm run build
npm test
npm run doctor
```

## Run the MCP server

```bash
node build/cli/index.js mcp
```

Configure your MCP client to launch the command above from this project directory. See `docs/md-files/agent-setup.md` and the client-specific documentation for details.

## Capabilities

- Android project and Gradle configuration discovery
- Build, install, launch, and test operations
- Emulator and device management
- UI hierarchy inspection, screenshots, gestures, and text input
- Logs, crash/ANR diagnostics, and coverage tools
- Test-case management, screen audits, and evidence-oriented reports
- **Testing intelligence:** Git change impact recommendations, structured plan validation, scoped instruction merging, and redacted Markdown/JSON run reports

## Testing intelligence

The initial testing-intelligence MCP tools are:

- `android_test_analyze_changes`
- `android_test_validate_plan`
- `android_test_resolve_instructions`
- `android_test_write_report`

They support planning and evidence-based reporting, but do not claim to execute tests or provide verified integration with Google's Android CLI. See [Testing intelligence documentation](docs/testing-intelligence.md) for schemas, report paths, behavior, and limitations.

## Documentation

Start with `docs/md-files/README.md` for the existing documentation index. Inspect actual tool contracts for the checked-out version with the CLI after building.

## Development status

Testing-intelligence functionality is an initial orchestration layer. Its path-based impact mapping is heuristic and must fall back to broad regression when uncertain. Validate with a clean install, build, unit suite, and emulator/device tests before relying on a release build. The `dev` branch is the integration branch for current development.

## License

MIT. See [LICENSE](LICENSE).
