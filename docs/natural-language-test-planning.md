# Natural-language test planning

Use the `plan_test_run` MCP tool with a request such as "test login after the current changes". It ranks saved cases by request terms and explicit file mappings, reuses their recorded steps/assertions, and returns relevant custom instructions plus missing-coverage warnings.

The planner never invents UI steps from a title or assumes that similarly named cases cover code. A complete plan is returned as `planned` only when it contains stored steps and has no detected mapping gaps. Otherwise it returns `needs_coverage` and explains what needs to be added or reviewed.

This tool is planning-only. It does not launch Android, execute tests, or claim a pass. A coding agent should review the plan, validate any additional steps with `validate_test_plan`, then invoke the appropriate execution tools and write an explicit test report.
