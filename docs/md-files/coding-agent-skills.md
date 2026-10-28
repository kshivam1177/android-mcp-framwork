# Coding-agent skills

AndroidMCP Framework can install a project-local skill so supported coding agents know when and how to use the framework, where to find project test instructions, and how to report test evidence without overstating what ran.

## Setup flow

Run this from the Android or Flutter repository root:

```bash
androidmcp-framework setup
```

The command initializes `.androidmcp-framework/`, then asks which coding agent you use when running in an interactive terminal. You can choose Claude Code, OpenAI Codex, Gemini CLI, Antigravity, Cursor, GitHub Copilot, or a generic agent. In non-interactive shells, it detects known agent folders when possible and otherwise uses the generic `.agents/skills/` location.

The generated `SKILL.md` is placed in the selected agent's project-local skills directory:

| Agent | Skill location |
| --- | --- |
| Claude Code | `.claude/skills/androidmcp-framework/SKILL.md` |
| OpenAI Codex | `.agents/skills/androidmcp-framework/SKILL.md` |
| Gemini CLI | `.gemini/skills/androidmcp-framework/SKILL.md` |
| Antigravity | `.agent/skills/androidmcp-framework/SKILL.md` |
| Cursor | `.cursor/skills/androidmcp-framework/SKILL.md` |
| GitHub Copilot | `.github/skills/androidmcp-framework/SKILL.md` |
| Other / generic | `.agents/skills/androidmcp-framework/SKILL.md` |

Existing skill files are never overwritten. A confirmation prints the selected agent and absolute path after generation.

## Generate or repair separately

You can generate the skill without rerunning project setup:

```bash
androidmcp-framework skill-gen
androidmcp-framework skill-gen --agent claude
androidmcp-framework skill-gen --agent codex
```

A standalone executable is also exposed:

```bash
npx -y androidmcp-framework@latest skill-gen --agent antigravity
```

Supported `--agent` values: `claude`, `codex`, `gemini`, `antigravity`, `cursor`, `copilot`, `other`, and `auto`. When multiple agent folders exist, specify an agent to avoid ambiguity. This command writes only the skill file; it does not change coding-agent configuration or grant the agent new permissions.

## What the skill instructs the agent to do

- Inspect project type, local instructions, and existing tests before changing code.
- Prefer targeted, project-native tests and use the existing AndroidMCP tools.
- Distinguish passed, failed, blocked, skipped, unavailable, and not-run outcomes.
- Keep reports and artifacts inside `.androidmcp-framework/`.
- Verify report freshness and Git provenance, redact sensitive output, and never claim device testing passed unless it actually ran.
- Ask before destructive device operations and keep retries bounded.
