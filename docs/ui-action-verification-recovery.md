# UI action verification and recovery

UI transitions can take longer than a fixed delay. When a saved test step includes `expectedOutcome`, the test runner now polls the UI hierarchy until the assertion passes or its timeout expires.

Both `run_test_case` and `run_test_workflow` accept `assertionTimeoutMs` (100–30,000 ms; default 3,000 ms). This setting only controls how long the runner waits for an explicit expected outcome; it does not retry taps or text entry, because repeating a non-idempotent UI action can cause duplicate submissions.

Example:

```json
{
  "action": "tap",
  "target": "Sign in",
  "expectedOutcome": "visible: Dashboard"
}
```

If the outcome is not observed before the timeout, the step fails with the last assertion or hierarchy-read error. Existing failure handling captures screenshot/hierarchy evidence when available. Steps without an expected outcome retain their previous behavior.

Polling verifies semantic UI hierarchy content, not pixel-perfect appearance or hidden app state. Device/emulator smoke testing is still recommended for each app and workflow.
