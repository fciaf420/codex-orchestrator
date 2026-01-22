# Codex Agent Start

Start a new Codex agent to work on a task in a tmux session.

## Usage

Delegate tasks to a GPT Codex agent that runs autonomously in the background.

## Arguments

$ARGUMENTS

## Instructions

Run the codex-agent CLI to start a new agent with the provided task. Use the following command:

```bash
codex-agent start "$ARGUMENTS"
```

**Available options to consider based on the task:**

- For complex reasoning tasks, add `-r high` or `-r xhigh`
- For read-only analysis, add `-s read-only`
- To include specific files, add `-f "pattern"` (e.g., `-f "src/**/*.ts"`)
- To include the codebase map, add `--map`
- To preview without executing, add `--dry-run`

**After starting:**
1. Note the job ID returned
2. Use `/codex-jobs` to list all running jobs
3. Use `/codex-status <jobId>` to check progress
4. Use `/codex-capture <jobId>` to see recent output
5. Use `/codex-send <jobId> <message>` to redirect the agent

**Example invocations:**

```bash
# Simple task
codex-agent start "Fix the TypeScript errors in src/utils.ts"

# Complex analysis with high reasoning
codex-agent start "Review this codebase for security vulnerabilities" -r high --map

# Include specific files
codex-agent start "Add unit tests for the auth module" -f "src/auth/**/*.ts" -f "tests/**/*.ts"

# Read-only code review
codex-agent start "Review the PR changes for best practices" -s read-only
```
