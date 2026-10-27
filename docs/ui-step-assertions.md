# UI step assertions

Saved test steps may include `expectedOutcome`. When provided, both `run_test_case` and `run_test_workflow` evaluate it against the UI hierarchy after the action completes. A failed assertion marks the step as failed and follows the normal failure-evidence path.

Supported syntax:

- `visible: Welcome back` — expected text, content description, or resource ID is present.
- `contains: com.example:id/title` — same positive check; this is also the default.
- `not_visible: Login failed` — expected string is absent.
- `not_contains: Login failed` — same negative check.
- `Welcome back` — shorthand for a positive check.

Matching is case-insensitive and searches the combined visible text, content descriptions, and resource IDs exposed by the UI hierarchy. This is a semantic substring assertion, not pixel matching, accessibility-completeness validation, or a check of hidden application state. Use stable labels or resource IDs where possible.

Example saved step:

```json
{
  "stepNumber": 2,
  "description": "Submit login form",
  "action": "tap",
  "target": "Sign in",
  "expectedOutcome": "visible: Dashboard"
}
```

Assertions are optional for backwards compatibility. Steps without `expectedOutcome` continue to report action execution only.
