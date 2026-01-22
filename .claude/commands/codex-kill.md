# Codex Agent Kill

Terminate a running Codex agent job.

## Arguments

$ARGUMENTS

## Instructions

Run the following command to kill the specified job:

```bash
codex-agent kill $ARGUMENTS
```

**Warning:** This immediately terminates the agent. The job will be marked as `failed` with error "Killed by user".

**When to use:**
- The agent is stuck or unresponsive
- The agent is working on the wrong task and redirection via `/codex-send` did not help
- You need to free up resources

**Alternatives to consider first:**
- `/codex-send <jobId> <message>` - Try redirecting the agent
- `/codex-capture <jobId>` - Check what the agent is doing before killing

**After killing:**
- Use `/codex-jobs` to verify the job is marked as failed
- Start a new job with `/codex-start <new task>` if needed
