# Codex Agent

CLI tool for delegating tasks to GPT Codex agents via tmux sessions. Designed for Claude Code orchestration with bidirectional communication.

**Stack**: TypeScript, Bun, tmux, OpenAI Codex CLI

**Structure**: Shell wrapper -> CLI entry point -> Job management -> tmux sessions

For detailed architecture, see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).

## Development

```bash
# Run directly
bun run src/cli.ts --help

# Or via shell wrapper
./bin/codex-agent --help

# Health check
bun run src/cli.ts health
```

## Key Files

| File | Purpose |
|------|---------|
| `src/cli.ts` | CLI commands and argument parsing |
| `src/jobs.ts` | Job lifecycle and persistence |
| `src/tmux.ts` | tmux session management |
| `src/config.ts` | Configuration constants |
| `src/files.ts` | File loading for context injection |

## Dependencies

- **Runtime**: Bun, tmux, codex CLI
- **NPM**: glob (file matching)

## Notes

- Jobs stored in `~/.codex-agent/jobs/`
- Uses `script` command for output logging
- Completion detected via marker string in output

## Setup Notes

- Native installation exists but `C:\Users\fciaf\.local\bin` is not in your PATH
- Add it via System Properties -> Environment Variables -> Edit User PATH -> New -> add the path above, then restart your terminal

## Local Constraints

- Use `trash` for file deletion, never `rm`
- TypeScript runtime is Bun only: use `bun`, `bun run`, `bun test`, `bunx`
- Python uses UV: `uv run`, `uv pip`, `uv venv`
- No emojis in output
- No em dashes, use hyphens or colons
- Research unfamiliar APIs before use, do not guess

## Local Constraints

- Use `trash` instead of `rm` for deletions.
- Bun is the runtime for TypeScript commands. Never use npm, yarn, or pnpm.
- UV is required for Python commands.
- No emojis and no em dashes in responses.
- Use Exa code search or web search before implementing unfamiliar APIs.
- Avoid assumptions. Measure when uncertain.
- Follow OPAR: observe, plan, act, verify, repeat.
- TDD: write failing tests first, then implement.
- Always run tests and typecheck after code changes.
- Never ignore ESLint.
- Never cast to `any`.
- Never swallow errors silently.
- Avoid scattered log statements. Use one wide event per request when logging.
