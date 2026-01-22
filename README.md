# codex-orchestrator

Delegate tasks to OpenAI Codex agents via tmux sessions. Designed for Claude Code orchestration.

<p align="center">
  <img src="codex-agent-hero.jpeg" alt="Claude orchestrating Codex agents" width="600">
</p>

## Install

**macOS / Linux / WSL:**
```bash
curl -fsSL https://raw.githubusercontent.com/fciaf420/codex-orchestrator/main/install-remote.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/fciaf420/codex-orchestrator/main/install-remote.ps1 | iex
```

This installs:
- `codex-agent` CLI to `~/.local/bin/`
- `/codex-agent` skill to `~/.claude/commands/`

### Prerequisites

Install these first:

| Dependency | macOS | Linux/WSL | Windows |
|------------|-------|-----------|---------|
| Bun | `curl -fsSL https://bun.sh/install \| bash` | same | [bun.sh](https://bun.sh) |
| tmux | `brew install tmux` | `apt install tmux` | N/A (WSL only) |
| Codex CLI | `npm install -g @openai/codex` | same | same |

### Uninstall

```bash
# Unix
curl -fsSL https://raw.githubusercontent.com/fciaf420/codex-orchestrator/main/uninstall-remote.sh | bash

# Windows
irm https://raw.githubusercontent.com/fciaf420/codex-orchestrator/main/uninstall-remote.ps1 | iex
```

---

## Why?

When you're working with Claude Code and need parallel execution, investigation tasks, or long-running operations - spawn Codex agents in the background. They run in tmux sessions so you can:

- **Watch live**: Attach to any session and see exactly what the agent is doing
- **Talk back**: Send follow-up messages mid-task to redirect or add context
- **Run in parallel**: Spawn multiple agents investigating different parts of a codebase
- **Capture results**: Grab output programmatically when agents finish
- **Get structured data**: Extract tokens used, files modified, and summaries via JSON output

## Quick Start

```bash
# Start an agent
codex-agent start "Review this codebase for security vulnerabilities" --map

# Check status with structured JSON
codex-agent jobs --json

# See what it's doing
codex-agent capture <jobId>

# Redirect the agent mid-task
codex-agent send <jobId> "Focus on the authentication module instead"
```

## Commands

| Command | Description |
|---------|-------------|
| `start <prompt>` | Start a new agent with the given prompt |
| `status <id>` | Check job status and details |
| `send <id> <msg>` | Send a message to redirect a running agent |
| `capture <id> [n]` | Get last n lines of output (default: 50) |
| `output <id>` | Get full session output |
| `attach <id>` | Print tmux attach command |
| `watch <id>` | Stream output updates in real-time |
| `jobs` | List all jobs |
| `jobs --json` | List jobs with structured metadata (tokens, files, summary) |
| `sessions` | List active tmux sessions |
| `kill <id>` | Terminate a running job (last resort) |
| `delete <id>` | Delete a specific job and its files |
| `clean` | Remove jobs older than 7 days |
| `health` | Check tmux and codex availability |

## Options

| Option | Description |
|--------|-------------|
| `-r, --reasoning <level>` | Reasoning effort: `low`, `medium`, `high`, `xhigh` (default: medium) |
| `--subagent-reasoning <level>` | Subagent reasoning effort: `low`, `medium`, `high`, `xhigh` |
| `-m, --model <model>` | Model name (default: gpt-5.2-codex) |
| `-s, --sandbox <mode>` | `read-only`, `workspace-write`, `danger-full-access` (default: workspace-write) |
| `-f, --file <glob>` | Include files matching glob (repeatable) |
| `-d, --dir <path>` | Working directory |
| `--parent-session <id>` | Link to parent session ID |
| `--map` | Include codebase map (docs/CODEBASE_MAP.md) |
| `--strip-ansi` | Remove terminal control codes from output |
| `--json` | Output JSON (jobs command only) |
| `--dry-run` | Preview prompt and token estimate without executing |

## Jobs JSON Output

Get structured job data with `jobs --json`:

```json
{
  "id": "8abfab85",
  "status": "completed",
  "elapsed_ms": 14897,
  "subagent_reasoning": "medium",
  "tokens": {
    "input": 36581,
    "output": 282,
    "context_window": 258400,
    "context_used_pct": 14.16
  },
  "files_modified": ["src/auth.ts", "src/types.ts"],
  "summary": "Implemented the authentication flow..."
}
```

Fields:
- `subagent_reasoning`: Reasoning effort applied to child agents
- `tokens`: Input/output tokens and context window usage (parsed from Codex session files)
- `files_modified`: Files changed via apply_patch tool calls
- `summary`: Agent's final response (truncated to 500 chars)

## Examples

### Parallel Investigation

```bash
# Spawn multiple agents to investigate different areas
codex-agent start "Audit authentication flow" -r high --map -s read-only
codex-agent start "Review database queries for N+1 issues" -r high --map -s read-only
codex-agent start "Check for XSS vulnerabilities in templates" -r high --map -s read-only

# Check on all of them with structured output
codex-agent jobs --json

# Results include tokens used, files modified, and summary
```

### Redirecting an Agent

```bash
# Agent going down wrong path? Send a message to redirect
codex-agent send abc123 "Stop - focus on the auth module instead"

# Agent needs info? Send it
codex-agent send abc123 "The dependency is installed. Continue with typecheck."

# Attach for direct interaction if needed
tmux attach -t codex-agent-abc123
# (Ctrl+B, D to detach)
```

### With File Context

```bash
# Include specific files
codex-agent start "Review these files for bugs" -f "src/auth/**/*.ts" -f "src/api/**/*.ts"

# Include codebase map for orientation
codex-agent start "Understand the architecture" --map -r high

# Preview what will be sent (dry run)
codex-agent start "Complex task" -f "src/**/*.ts" --map --dry-run
```

### Streaming Output

```bash
# Watch output in real-time (polls every 1 second)
codex-agent watch abc123

# Capture recent output with ANSI codes stripped (for programmatic use)
codex-agent capture abc123 100 --strip-ansi
```

## How It Works

1. **You run** `codex-agent start "task"`
2. **It creates** a detached tmux session named `codex-agent-<jobId>`
3. **It launches** the Codex CLI inside that session with `script` for output logging
4. **It sends** your prompt to Codex (handles update prompts automatically)
5. **It returns** immediately with the job ID
6. **Codex works** in the background
7. **You check** with `jobs --json`, `capture`, `output`, or `attach`
8. **You redirect** with `send` if the agent needs course correction

### Session Data Extraction

When jobs complete, the tool parses Codex's JSONL session files (`~/.codex/sessions/`) to extract:
- Token usage (input, output, context window percentage)
- Files modified (from `apply_patch` tool calls)
- Summary (last assistant message)

This data is available via `jobs --json`.

## Architecture

```
User Input (CLI) -> Job Management -> Session Control -> External Processes
     |                  |                  |                   |
  cli.ts           jobs.ts            tmux.ts         tmux + codex CLI
                       |
              session-parser.ts (extracts metadata from Codex sessions)
```

### Source Files

| File | Purpose |
|------|---------|
| `src/cli.ts` | CLI commands, argument parsing, output formatting |
| `src/jobs.ts` | Job lifecycle, persistence, status management |
| `src/tmux.ts` | tmux session creation, messaging, output capture |
| `src/session-parser.ts` | Parse Codex JSONL files for tokens/files/summary |
| `src/config.ts` | Configuration constants and defaults |
| `src/files.ts` | File loading for context injection, token estimation |

## Job Storage

Jobs are stored in `~/.codex-agent/jobs/`:

```
~/.codex-agent/jobs/
├── <jobId>.json    # Job metadata (status, model, timestamps, etc.)
├── <jobId>.prompt  # Original prompt text
└── <jobId>.log     # Full terminal output (via script command)
```

## Configuration

Default values in `src/config.ts`:

| Setting | Default |
|---------|---------|
| Model | gpt-5.2-codex |
| Reasoning effort | medium |
| Subagent reasoning | medium |
| Sandbox mode | workspace-write |
| Jobs directory | ~/.codex-agent/jobs |
| tmux prefix | codex-agent |

## Tips

- Use `codex-agent send` to redirect agents - don't kill and respawn
- Use `jobs --json` to get structured data (tokens, files, summary) in one call
- Use `--strip-ansi` when capturing output programmatically
- Use `-r xhigh` for complex investigation tasks that need deep reasoning
- Use `--map` to give agents codebase context (requires docs/CODEBASE_MAP.md)
- Use `-s read-only` for research tasks that shouldn't modify files
- Use `--subagent-reasoning` when you want child agents to think less/more than the parent
- Use `--dry-run` to preview prompts and estimate tokens before execution
- Use `watch` for real-time output streaming instead of repeated `capture` calls
- Kill stuck jobs with `codex-agent kill <id>` only as a last resort

## Development

```bash
# Run directly
bun run src/cli.ts --help

# Or via shell wrapper
./bin/codex-agent --help

# Health check
bun run src/cli.ts health

# Build for distribution
bun build src/cli.ts --outdir dist --target node
```

## License

MIT
