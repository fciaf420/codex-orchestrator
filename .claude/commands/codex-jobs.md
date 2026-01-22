# Codex Agent Jobs

List all Codex agent jobs and their statuses.

## Instructions

Run the following command to list all jobs:

```bash
codex-agent jobs --json
```

This provides a structured view of all jobs with:
- Job ID
- Status (pending/running/completed/failed)
- Prompt summary
- Model and reasoning effort
- Elapsed time
- Token usage statistics
- Files modified (for completed jobs)

**Interpreting results:**
- `running` jobs are actively working in tmux sessions
- `completed` jobs finished successfully - retrieve output with `/codex-output <jobId>`
- `failed` jobs encountered errors - check status for details
- `pending` jobs are initializing

**Management commands:**
- `/codex-status <jobId>` - Detailed status of a specific job
- `/codex-capture <jobId>` - Recent output from a running job
- `/codex-output <jobId>` - Full output from any job
- `/codex-send <jobId> <message>` - Send a message to a running job
- `/codex-kill <jobId>` - Terminate a running job
