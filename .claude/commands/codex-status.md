# Codex Agent Status

Check the status of a specific Codex agent job.

## Arguments

$ARGUMENTS

## Instructions

Run the following command to get the status of the specified job:

```bash
codex-agent status $ARGUMENTS
```

This will show:
- Job ID and current status (pending/running/completed/failed)
- Model and reasoning effort level
- Sandbox mode
- Working directory
- Timestamps (created, started, completed)
- tmux session name
- Error messages if the job failed

**Next steps based on status:**
- If `running`: Use `/codex-capture <jobId>` to see recent output
- If `completed`: Use `/codex-output <jobId>` to get full results
- If `failed`: Check the error message and consider restarting
