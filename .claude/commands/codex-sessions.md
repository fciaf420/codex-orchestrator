# Codex Agent Sessions

List all active tmux sessions for Codex agents.

## Instructions

Run the following command to list active sessions:

```bash
codex-agent sessions
```

This shows:
- Session names (format: `codex-agent-<jobId>`)
- Whether anyone is currently attached
- Creation timestamp

**Use cases:**
- See which agents are still running
- Find orphaned sessions
- Check if you can attach to a session

**To attach to a session interactively:**
1. Get the attach command: `codex-agent attach <jobId>`
2. Run the provided tmux attach command
3. Detach with `Ctrl+b d` when done
