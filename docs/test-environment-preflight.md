# Test environment preflight

Use the `validate_test_environment` MCP tool before executing saved Android UI tests. It is read-only: it does not build, install, launch, or interact with the app.

It checks:

- Native Android / Flutter project markers and framework project configuration.
- Saved test-case JSON validity, step completeness, and actions supported by `run_test_workflow`.
- ADB availability and connected/ready targets, including ambiguity when multiple targets are connected.
- Conventional Flutter integration/unit test directories or Android unit-test source directories.

Example for device execution:

```json
{
  "projectPath": ".",
  "targetId": "emulator-5554",
  "requireDevice": true
}
```

For a planning-only preflight that should not block solely because no device is connected, use `requireDevice: false`. Invalid or missing saved cases remain blockers because there would be nothing safe to execute.

A `ready` result is a static preflight, not proof that the app builds or that a test passes. Run `run_test_workflow` with `execute: false` to inspect the selected plan before explicitly enabling device execution.
