# Codex Agent Health

Check if the Codex agent system is ready and all dependencies are available.

## Instructions

Run the following command to check system health:

```bash
codex-agent health
```

This verifies:
- tmux is installed and accessible
- Codex CLI is installed and accessible
- All required dependencies are available

**Expected output:** "Ready" if everything is configured correctly.

**If checks fail:**
- Ensure tmux is installed: `brew install tmux` or `apt install tmux`
- Ensure Codex CLI is installed and in PATH
- Check that Bun runtime is available
