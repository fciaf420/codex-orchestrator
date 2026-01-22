# Codex Agent Output

Get the complete output from a Codex agent job.

## Arguments

$ARGUMENTS

## Instructions

Run the following command to get the full output:

```bash
codex-agent output $ARGUMENTS --strip-ansi
```

The `--strip-ansi` flag removes terminal formatting codes for cleaner output.

This retrieves the entire terminal output from the job, including:
- All agent reasoning and decisions
- Commands executed
- Files read and modified
- Final results and summaries

**For running jobs:** Consider using `/codex-capture <jobId>` for just the recent output to avoid overwhelming output.

**For completed jobs:** This gives you the full history of what the agent did.
