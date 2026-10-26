# Android CLI Integration

AndroidBuildMCP provides an integration surface for available Android CLI capabilities. Confirm the installed CLI version and supported commands on the target machine; do not assume that a command exists just because it is mentioned in older documentation. Use the framework's fallback ADB/Gradle adapters for operations not supported by the installed CLI.