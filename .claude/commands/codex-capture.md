# Codex Agent Capture

Get recent output from a running Codex agent job.

## Arguments

$ARGUMENTS

## Instructions

Parse the arguments. Format can be:
- Just job ID: `<jobId>` (defaults to 50 lines)
- Job ID and line count: `<jobId> <lines>`

Run the following command:

```bash
codex-agent capture $ARGUMENTS --strip-ansi
```

**Examples:**

```bash
# Get last 50 lines (default)
codex-agent capture a1b2c3d4 --strip-ansi

# Get last 100 lines
codex-agent capture a1b2c3d4 100 --strip-ansi
```

This is useful for monitoring progress of a running job without retrieving the entire output history.

**Related commands:**
- `/codex-output <jobId>` - Get complete output (for finished jobs)
- `/codex-status <jobId>` - Check if job is still running
