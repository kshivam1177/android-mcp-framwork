# Test execution recovery and evidence

The saved-test-case runner retries semantic target lookup before an action (default two retries). It never blindly repeats a tap or text-entry action after the action itself has started, because repeating a submit or purchase could have side effects.

## Failure handling

- Text/resource-ID target matching must resolve to exactly one element. Ambiguous matches fail instead of tapping the first candidate.
- Failed steps capture a screenshot and UI hierarchy when the backend supports them.
- Reports include the failed step, evidence paths, and recovery suggestions such as refreshing the learned screen definition or using a unique resource ID/content description.
- Unsupported action names fail explicitly rather than being recorded as successful no-ops.
- Evidence capture can be disabled with `captureFailureEvidence: false`; lookup retries can be configured with `targetRetries` from 0 to 5.

The runner does not automatically edit saved test cases or claim that a suggested repair is correct. Review evidence and update the test definition deliberately, then rerun the test.
