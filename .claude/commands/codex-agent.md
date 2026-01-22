---
name: codex-agent
description: Delegates tasks to GPT Codex agents via tmux sessions. Supports single agents and multi-agent orchestration for parallel work, long-running tasks, code review, security audits, or implementation. Use when spawning background agents, running tasks in parallel, delegating to Codex, or any request that benefits from parallel AI execution. Trigger phrases include "spawn an agent", "run in background", "use codex", "parallel agents", "delegate to codex".
---

# Codex Agent Orchestrator

$ARGUMENTS

## CLI Reference

**Start agents:**
```bash
codex-agent start "<prompt>" [options]
```
Options: `-r` reasoning (low/medium/high/xhigh), `-m` model, `-s` sandbox (read-only/workspace-write/danger-full-access), `-f` file glob, `-d` dir, `--map` codebase map, `--dry-run`

**Manage agents:**
```bash
codex-agent status <jobId>        # Check status
codex-agent jobs --json           # List all with metadata
codex-agent capture <jobId> [n]   # Last n lines (default 50)
codex-agent output <jobId>        # Complete output
codex-agent send <jobId> "<msg>"  # Redirect agent (Unix/WSL only)
codex-agent kill <jobId>          # Terminate
codex-agent watch <jobId>         # Stream output
codex-agent health                # Check dependencies
```

## Platform Notes

**Windows native**: `send` disabled, no tmux. Use WSL for interactive sessions.
**Unix/WSL**: Full tmux integration with `send` and `attach`.

## Single Agent Workflow

```bash
codex-agent start "Fix TypeScript errors in src/utils.ts" -r medium
codex-agent status <jobId>
codex-agent output <jobId> --strip-ansi
```

## Multi-Agent Orchestration Workflow

Copy this checklist and track progress:

```
Orchestration Progress:
- [ ] Step 1: Start parallel agents
- [ ] Step 2: Monitor until completion
- [ ] Step 3: Collect outputs
- [ ] Step 4: Synthesize results
```

**Step 1: Start parallel agents**

By module:
```bash
codex-agent start "Audit auth module" -f "src/auth/**/*.ts" -r high
codex-agent start "Audit api module" -f "src/api/**/*.ts" -r high
codex-agent start "Audit db module" -f "src/db/**/*.ts" -r high
```

By concern:
```bash
codex-agent start "Review for performance issues" -s read-only -r high --map
codex-agent start "Review for security vulnerabilities" -s read-only -r high --map
```

**Step 2: Monitor until completion**
```bash
codex-agent jobs --json
# Unix: while ! codex-agent status <jobId> | grep -q "completed\|failed"; do sleep 30; done
# PowerShell: do { Start-Sleep 30 } while ((codex-agent status <jobId>) -notmatch "completed|failed")
```

**Step 3: Collect outputs**
```bash
codex-agent output <jobId1> --strip-ansi
codex-agent output <jobId2> --strip-ansi
codex-agent output <jobId3> --strip-ansi
```

**Step 4: Synthesize results**
- Deduplicate overlapping discoveries
- Categorize by severity/type
- Prioritize by impact
- Create unified action items

## Redirect Running Agent (Unix/WSL)

```bash
codex-agent send <jobId> "Focus on authentication flow instead"
```

## Best Practices

1. Scope agents narrowly with `-f` patterns
2. Use `-s read-only` for analysis tasks
3. Use `-r high` or `-r xhigh` for complex reasoning
4. Add `--map` for codebase context
5. Monitor with `jobs --json`
