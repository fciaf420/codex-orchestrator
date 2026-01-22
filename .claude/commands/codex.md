# Codex Agent Orchestrator

Delegate tasks to GPT Codex agents running in tmux sessions. Supports single agents and multi-agent orchestration.

## Arguments

$ARGUMENTS

## Instructions

You have access to the `codex-agent` CLI for managing Codex agents. Parse the user's request and execute the appropriate commands.

### CLI Reference

**Starting agents:**
```bash
codex-agent start "<prompt>" [options]
```
Options:
- `-r, --reasoning <level>` - low, medium, high, xhigh (default: medium)
- `-m, --model <model>` - Model name (default: gpt-5.2-codex)
- `-s, --sandbox <mode>` - read-only, workspace-write, danger-full-access
- `-f, --file <glob>` - Include files matching pattern (repeatable)
- `-d, --dir <path>` - Working directory
- `--map` - Include codebase map
- `--dry-run` - Preview without executing

**Managing agents:**
```bash
codex-agent status <jobId>        # Check job status
codex-agent jobs --json           # List all jobs with metadata
codex-agent capture <jobId> [n]   # Get last n lines (default 50)
codex-agent output <jobId>        # Get complete output
codex-agent send <jobId> "<msg>"  # Send message to running agent
codex-agent kill <jobId>          # Terminate a job
codex-agent watch <jobId>         # Stream output updates
codex-agent sessions              # List tmux sessions
codex-agent health                # Check dependencies
```

---

### Single Agent Tasks

For simple tasks, start one agent:

```bash
codex-agent start "Fix the TypeScript errors in src/utils.ts" -r medium
```

Monitor and retrieve results:
```bash
codex-agent status <jobId>
codex-agent output <jobId> --strip-ansi
```

---

### Multi-Agent Orchestration

For complex tasks, spawn multiple agents in parallel:

**Pattern 1 - Divide by module:**
```bash
codex-agent start "Audit auth module for security issues" -f "src/auth/**/*.ts" -r high
codex-agent start "Audit api module for security issues" -f "src/api/**/*.ts" -r high
codex-agent start "Audit db module for security issues" -f "src/db/**/*.ts" -r high
```

**Pattern 2 - Divide by concern:**
```bash
codex-agent start "Review for performance issues" -s read-only -r high --map
codex-agent start "Review for security vulnerabilities" -s read-only -r high --map
codex-agent start "Review for code quality" -s read-only -r medium --map
```

**Pattern 3 - Sequential pipeline:**
```bash
# Phase 1: Analysis
codex-agent start "Analyze codebase and create implementation plan" -r high --map
# Wait for completion, then...
# Phase 2: Implementation (using phase 1 output as context)
codex-agent start "Implement the auth refactor based on the plan" -r high
```

---

### Monitoring Multiple Agents

Check all running jobs:
```bash
codex-agent jobs --json
```

Poll until specific jobs complete:
```bash
while ! codex-agent status <jobId> | grep -q "completed\|failed"; do
  sleep 30
done
```

---

### Aggregating Results

After multiple agents complete, gather their outputs:
```bash
codex-agent output <jobId1> --strip-ansi
codex-agent output <jobId2> --strip-ansi
codex-agent output <jobId3> --strip-ansi
```

Then synthesize findings:
- Deduplicate overlapping discoveries
- Categorize by severity/type
- Prioritize by impact
- Create unified action items

---

### Coordination

Redirect a running agent:
```bash
codex-agent send <jobId> "Focus on the authentication flow instead"
```

Kill a stuck agent:
```bash
codex-agent kill <jobId>
```

---

### Best Practices

1. **Scope agents narrowly** - Use `-f` patterns to give each agent a focused area
2. **Use read-only for analysis** - Add `-s read-only` when agents only need to read
3. **High reasoning for complex tasks** - Use `-r high` or `-r xhigh` for deep analysis
4. **Include codebase map** - Add `--map` so agents understand project structure
5. **Monitor progress** - Check `codex-agent jobs --json` periodically
6. **Aggregate results** - Collect outputs from all agents and synthesize

---

### Example Workflows

**Security audit with 3 parallel agents:**
```bash
codex-agent start "Find SQL injection vulnerabilities" -r high -f "src/**/*.ts"
codex-agent start "Find XSS vulnerabilities" -r high -f "src/**/*.ts"
codex-agent start "Find auth/session issues" -r high -f "src/**/*.ts"
# Monitor with: codex-agent jobs --json
# Collect results when complete
```

**Feature implementation with planning:**
```bash
# Agent 1: Plan
codex-agent start "Design the new caching layer architecture" -r xhigh --map
# Wait, review plan, then...
# Agent 2: Implement
codex-agent start "Implement Redis caching for the API endpoints" -r high
# Agent 3: Test
codex-agent start "Write integration tests for the new caching" -r medium
```
