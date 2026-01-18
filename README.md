# codex-orchestrator

Delegate tasks to OpenAI Codex agents via tmux sessions. Designed for Claude Code orchestration.

<p align="center">
  <img src="codex-agent-hero.jpeg" alt="Claude orchestrating Codex agents" width="600">
</p>

## Why?

When you're working with Claude Code and need parallel execution, investigation tasks, or long-running operations - spawn Codex agents in the background. They run in tmux sessions so you can:

- **Watch live**: Attach to any session and see exactly what the agent is doing
- **Talk back**: Send follow-up messages mid-task to redirect or add context
- **Run in parallel**: Spawn multiple agents investigating different parts of a codebase
- **Capture results**: Grab output programmatically when agents finish
- **One-shot mode**: Agents exit when done - no more stuck "running" status

## Requirements

- [Bun](https://bun.sh) - JavaScript runtime
- [tmux](https://github.com/tmux/tmux) - Terminal multiplexer
- [Codex CLI](https://github.com/openai/codex) - OpenAI's coding agent

```bash
# macOS
brew install tmux
npm install -g @openai/codex

# Verify
codex --version
tmux -V
```

## Install

```bash
git clone https://github.com/kingbootoshi/codex-orchestrator.git
cd codex-orchestrator
bun install

# Add to PATH (optional)
sudo ln -sf "$(pwd)/bin/codex-agent" /usr/local/bin/codex-agent
```

## Quick Start

```bash
# Start an agent (one-shot mode - exits when done)
codex-agent start "Review this codebase for security vulnerabilities" --map --one-shot

# Check status with structured JSON
codex-agent jobs --json

# See what it's doing
codex-agent capture <jobId>

# Interactive mode (can send follow-ups)
codex-agent start "Help me refactor the user service"
codex-agent send <jobId> "Focus on the authentication module"
```

## Commands

| Command | Description |
|---------|-------------|
| `start <prompt>` | Start a new agent with the given prompt |
| `status <id>` | Check job status and details |
| `send <id> <msg>` | Send a message to a running agent |
| `capture <id> [n]` | Get last n lines of output (default: 50) |
| `output <id>` | Get full session output |
| `attach <id>` | Print tmux attach command |
| `watch <id>` | Stream output updates |
| `jobs` | List all jobs |
| `jobs --json` | List jobs with structured metadata (tokens, files, summary) |
| `sessions` | List active tmux sessions |
| `kill <id>` | Terminate a running job |
| `clean` | Remove jobs older than 7 days |
| `health` | Check tmux and codex availability |

## Options

| Option | Description |
|--------|-------------|
| `-r, --reasoning <level>` | Reasoning effort: `low`, `medium`, `high`, `xhigh` |
| `-m, --model <model>` | Model name (default: gpt-5.2-codex) |
| `-s, --sandbox <mode>` | `read-only`, `workspace-write`, `danger-full-access` |
| `-f, --file <glob>` | Include files matching glob (repeatable) |
| `-d, --dir <path>` | Working directory |
| `--map` | Include codebase map (docs/CODEBASE_MAP.md) |
| `--one-shot` | Non-interactive mode - agent exits when done |
| `--strip-ansi` | Remove terminal control codes from output |
| `--json` | Output JSON (jobs command only) |
| `--dry-run` | Preview prompt without executing |

## Jobs JSON Output

Get structured job data with `jobs --json`:

```json
{
  "id": "8abfab85",
  "status": "completed",
  "elapsed_ms": 14897,
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
- `tokens`: Input/output tokens and context window usage
- `files_modified`: Files changed via apply_patch
- `summary`: Agent's final response (truncated to 500 chars)

## One-Shot vs Interactive Mode

| Mode | Flag | Behavior |
|------|------|----------|
| Interactive (default) | none | Agent stays open for follow-ups, status may show "running" even when idle |
| One-shot | `--one-shot` | Agent exits when done, status accurately shows "completed" |

Use `--one-shot` for fire-and-forget tasks. Use interactive mode when you need to send follow-up messages.

## Examples

### Parallel Investigation (One-Shot)

```bash
# Spawn multiple agents to investigate different areas
codex-agent start "Audit authentication flow" -r high --map --one-shot
codex-agent start "Review database queries for N+1 issues" -r high --map --one-shot
codex-agent start "Check for XSS vulnerabilities in templates" -r high --map --one-shot

# Check on all of them with structured output
codex-agent jobs --json

# Results include tokens used, files modified, and summary
```

### Interactive Session

```bash
# Start an agent (interactive mode)
codex-agent start "Help me refactor the user service"

# Watch it work
codex-agent watch abc123

# Send a follow-up
codex-agent send abc123 "Also update the tests"

# Or attach directly for full interaction
tmux attach -t codex-agent-abc123
# (Ctrl+B, D to detach)
```

### With File Context

```bash
# Include specific files
codex-agent start "Review these files for bugs" -f "src/auth/**/*.ts" -f "src/api/**/*.ts"

# Include codebase map for orientation
codex-agent start "Understand the architecture" --map -r high
```

## How It Works

1. **You run** `codex-agent start "task"`
2. **It creates** a detached tmux session
3. **It launches** the Codex CLI inside that session
4. **It sends** your prompt to Codex
5. **It returns** immediately with the job ID
6. **Codex works** in the background
7. **You check** with `jobs --json`, `capture`, `output`, or `attach`

All session output is logged via the `script` command, so you can retrieve results even after the session ends.

Session metadata is parsed from Codex's JSONL files (`~/.codex/sessions/`) to extract tokens, file modifications, and summaries.

## Job Storage

Jobs are stored in `~/.codex-agent/jobs/`:

```
~/.codex-agent/jobs/
├── <jobId>.json    # Job metadata
├── <jobId>.prompt  # Original prompt
├── <jobId>.log     # Full terminal output
└── <jobId>.result  # Clean output (one-shot mode only)
```

## Tips

- Use `--one-shot` for tasks that don't need follow-ups - agents exit cleanly
- Use `jobs --json` to get structured data (tokens, files, summary) in one call
- Use `--strip-ansi` when capturing output programmatically
- Use `-r xhigh` for complex investigation tasks that need deep reasoning
- Use `--map` to give agents codebase context (requires docs/CODEBASE_MAP.md)
- Kill stuck jobs with `codex-agent kill <id>`

## License

MIT
