---
name: codex-agent
description: Delegates tasks to GPT Codex agents via tmux sessions. Supports single agents and multi-agent orchestration for parallel work, long-running tasks, code review, security audits, or implementation. Use when spawning background agents, running tasks in parallel, delegating to Codex, or any request that benefits from parallel AI execution. Trigger phrases include "spawn an agent", "run in background", "use codex", "parallel agents", "delegate to codex".
---

# Codex Agent Orchestrator

$ARGUMENTS

## CLI Reference

```bash
codex-agent start "<prompt>" [options]   # Start agent
codex-agent status <jobId>               # Check status
codex-agent jobs --json                  # List all with metadata
codex-agent output <jobId> --strip-ansi  # Complete output
codex-agent capture <jobId> [n]          # Last n lines (default 50)
codex-agent send <jobId> "<msg>"         # Redirect agent (Unix/WSL only)
codex-agent kill <jobId>                 # Terminate
codex-agent watch <jobId>                # Stream output
codex-agent health                       # Check dependencies
```

**Options:** `-r` reasoning (low/medium/high/xhigh), `-m` model, `-s` sandbox (read-only/workspace-write/danger-full-access), `-f` file glob, `-d` dir, `--map` codebase map, `--dry-run`

**Platform:** Windows native disables `send` (no tmux). Use WSL for interactive sessions.

## Single Agent Workflow

```bash
codex-agent start "Fix TypeScript errors in src/utils.ts" -r medium -s workspace-write
codex-agent status <jobId>
codex-agent output <jobId> --strip-ansi
```

## Multi-Agent Orchestration

**State tracking:** Maintain a job status table in each response during orchestration:

| Job ID | Task | Status |
|--------|------|--------|
| abc123 | Audit auth module | running |
| def456 | Audit api module | completed |

Update this table after each step to track progress across turns.

### 1. Start Parallel Agents

By module:
```bash
codex-agent start "Audit auth module" -f "src/auth/**/*.ts" -r high -s read-only
codex-agent start "Audit api module" -f "src/api/**/*.ts" -r high -s read-only
codex-agent start "Audit db module" -f "src/db/**/*.ts" -r high -s read-only
```

By concern:
```bash
codex-agent start "Review for performance issues" -s read-only -r high --map
codex-agent start "Review for security vulnerabilities" -s read-only -r high --map
```

### 2. Monitor Until Completion

```bash
codex-agent jobs --json
codex-agent status <jobId>
```

Poll periodically until status shows "completed" or "failed".

### 3. Collect and Synthesize

```bash
codex-agent output <jobId1> --strip-ansi
codex-agent output <jobId2> --strip-ansi
```

Deduplicate overlapping findings, categorize by severity/type, prioritize by impact.

## Redirect Running Agent (Unix/WSL)

```bash
codex-agent send <jobId> "Focus on authentication flow instead"
```

For full CLI options: `codex-agent --help`
