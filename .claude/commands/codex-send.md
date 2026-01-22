# Codex Agent Send

Send a message to a running Codex agent to provide additional context or redirect its work.

## Arguments

$ARGUMENTS

## Instructions

Parse the arguments to extract the job ID and message. The format should be:
- First word: job ID
- Remaining words: the message to send

Run the following command:

```bash
codex-agent send <jobId> "<message>"
```

**Use cases:**
- Redirect the agent to focus on a different area
- Provide additional context or clarification
- Answer questions the agent may have asked
- Correct misunderstandings about the task

**Example:**

```bash
# Redirect focus
codex-agent send a1b2c3d4 "Focus on the authentication module instead of the database layer"

# Provide clarification
codex-agent send a1b2c3d4 "The config file is located at src/config/settings.ts"

# Answer a question
codex-agent send a1b2c3d4 "Yes, you should update the tests as well"
```

**Note:** This only works for jobs with status `running`. Check status first with `/codex-status <jobId>`.
