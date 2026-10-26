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

## Documentation

Start with `docs/md-files/README.md` for the documentation index. Inspect actual tool contracts for the checked-out version with the CLI after building.

## Development status

This repository is being initialized from the existing AndroidBuildMCP project. Validate with a clean install, build, unit suite, and emulator/device tests before relying on a release build. The `dev` branch is the integration branch for current development.

## License

MIT. See [LICENSE](LICENSE).