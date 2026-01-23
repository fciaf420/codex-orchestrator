#!/usr/bin/env bun

// Codex Agent CLI - Delegate tasks to GPT Codex agents with tmux integration
// Designed for Claude Code orchestration with bidirectional communication

import { config, ReasoningEffort, SandboxMode } from "./config.ts";
import {
  startJob,
  loadJob,
  listJobs,
  killJob,
  refreshJobStatus,
  cleanupOldJobs,
  deleteJob,
  sendToJob,
  sendControlToJob,
  getJobOutput,
  getJobFullOutput,
  getAttachCommand,
  Job,
  getJobsJson,
  getJobResult,
  waitForJob,
  startJobAndWait,
  getJobProgress,
} from "./jobs.ts";
import { ensureAuthToken } from "./auth.ts";
import { loadFiles, formatPromptWithFiles, estimateTokens, loadCodebaseMap } from "./files.ts";
import { getTmuxInstallHint, isTmuxAvailable, listSessions } from "./tmux.ts";
import { stripAnsiCodes } from "./utils.ts";
import { closeSync, existsSync, openSync, readSync, statSync } from "fs";
import { join } from "path";

const HELP = `
Codex Agent - Delegate tasks to GPT Codex agents (tmux-based)

Usage:
  codex-agent start "prompt" [options]   Start agent in tmux session
  codex-agent run "prompt" [options]     Start agent and wait for completion
  codex-agent status <jobId>             Check job status
  codex-agent result <jobId>             Get structured result (JSON)
  codex-agent progress <jobId>           Get current progress and findings
  codex-agent wait <jobId> [timeout]     Wait for job to complete (default: 300s)
  codex-agent send <jobId> "message"     Send message to running agent
  codex-agent capture <jobId> [lines]    Capture recent output (default: 50 lines)
  codex-agent output <jobId>             Get full session output
  codex-agent attach <jobId>             Get tmux attach command
  codex-agent watch <jobId>              Stream output updates
  codex-agent jobs [--json]              List all jobs
  codex-agent sessions                   List active tmux sessions
  codex-agent kill <jobId>               Kill running job
  codex-agent clean                      Clean old completed jobs
  codex-agent health                     Check tmux and codex availability

Options:
  -r, --reasoning <level>    Reasoning effort: low, medium, high, xhigh (default: medium)
  --subagent-reasoning <level>  Subagent reasoning effort: low, medium, high, xhigh (default: medium)
  -m, --model <model>        Model name (default: gpt-5.2-codex)
  -s, --sandbox <mode>       Sandbox: read-only, workspace-write, danger-full-access
  -f, --file <glob>          Include files matching glob (can repeat)
  -d, --dir <path>           Working directory (default: cwd)
  --parent-session <id>      Parent session ID for linkage
  --protocol                 Enable orchestration protocol (status events, structured output)
  --timeout <seconds>        Timeout for wait/run commands (default: 300)
  --map                      Include codebase map if available
  --dry-run                  Show prompt without executing
  --strip-ansi               Remove ANSI escape codes from output (for capture/output)
  --json                     Output JSON (jobs, result commands)
  -h, --help                 Show this help

Examples:
  # Start an agent with protocol (for orchestration)
  codex-agent start "Review this code for security issues" -f "src/**/*.ts" --protocol

  # Start and wait for completion
  codex-agent run "Fix the bug in auth.ts" --timeout 600

  # Get structured result
  codex-agent result abc123

  # Check progress
  codex-agent progress abc123

  # Wait for a running job
  codex-agent wait abc123 120

Orchestration Protocol:
  - Use --protocol flag to enable structured communication
  - Agents emit status events: [CODEX-AGENT:STATUS:analyzing]
  - Agents emit findings: [CODEX-AGENT:FINDING:{"severity":"high",...}]
  - Use 'result' to get structured JSON output
  - Use 'progress' to check real-time status and findings
`;

interface Options {
  reasoning: ReasoningEffort;
  subagentReasoning: ReasoningEffort;
  model: string;
  sandbox: SandboxMode;
  files: string[];
  dir: string;
  includeMap: boolean;
  parentSessionId: string | null;
  dryRun: boolean;
  stripAnsi: boolean;
  json: boolean;
  protocol: boolean;
  timeout: number;
}

function parseArgs(args: string[]): {
  command: string;
  positional: string[];
  options: Options;
} {
  const options: Options = {
    reasoning: config.defaultReasoningEffort,
    subagentReasoning: config.defaultSubagentReasoningEffort,
    model: config.model,
    sandbox: config.defaultSandbox,
    files: [],
    dir: process.cwd(),
    includeMap: false,
    parentSessionId: null,
    dryRun: false,
    stripAnsi: false,
    json: false,
    protocol: false,
    timeout: 300,
  };

  const positional: string[] = [];
  let command = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      console.log(HELP);
      process.exit(0);
    } else if (arg === "-r" || arg === "--reasoning") {
      const level = args[++i] as ReasoningEffort;
      if (config.reasoningEfforts.includes(level)) {
        options.reasoning = level;
      } else {
        console.error(`Invalid reasoning level: ${level}`);
        console.error(`Valid options: ${config.reasoningEfforts.join(", ")}`);
        process.exit(1);
      }
    } else if (arg === "--subagent-reasoning") {
      const level = args[++i] as ReasoningEffort;
      if (config.reasoningEfforts.includes(level)) {
        options.subagentReasoning = level;
      } else {
        console.error(`Invalid subagent reasoning level: ${level}`);
        console.error(`Valid options: ${config.reasoningEfforts.join(", ")}`);
        process.exit(1);
      }
    } else if (arg === "-m" || arg === "--model") {
      const model = args[++i];
      if (!model || !model.trim()) {
        console.error("Error: Model name cannot be empty");
        process.exit(1);
      }
      options.model = model;
    } else if (arg === "-s" || arg === "--sandbox") {
      const mode = args[++i] as SandboxMode;
      if (config.sandboxModes.includes(mode)) {
        options.sandbox = mode;
      } else {
        console.error(`Invalid sandbox mode: ${mode}`);
        console.error(`Valid options: ${config.sandboxModes.join(", ")}`);
        process.exit(1);
      }
    } else if (arg === "-f" || arg === "--file") {
      options.files.push(args[++i]);
    } else if (arg === "-d" || arg === "--dir") {
      const dir = args[++i];
      if (!existsSync(dir)) {
        console.error(`Error: Directory does not exist: ${dir}`);
        process.exit(1);
      }
      const dirStat = statSync(dir);
      if (!dirStat.isDirectory()) {
        console.error(`Error: Path is not a directory: ${dir}`);
        process.exit(1);
      }
      options.dir = dir;
    } else if (arg === "--parent-session") {
      options.parentSessionId = args[++i] ?? null;
    } else if (arg === "--map") {
      options.includeMap = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--strip-ansi") {
      options.stripAnsi = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--protocol") {
      options.protocol = true;
    } else if (arg === "--timeout") {
      const timeout = parseInt(args[++i], 10);
      if (Number.isNaN(timeout) || timeout <= 0) {
        console.error(`Error: Invalid timeout: ${args[i]}`);
        console.error("Timeout must be a positive integer (seconds)");
        process.exit(1);
      }
      options.timeout = timeout;
    } else if (!arg.startsWith("-")) {
      if (!command) {
        command = arg;
      } else {
        positional.push(arg);
      }
    }
  }

  return { command, positional, options };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatJobStatus(job: Job): string {
  const elapsed = job.startedAt
    ? formatDuration(
        (job.completedAt ? new Date(job.completedAt).getTime() : Date.now()) -
          new Date(job.startedAt).getTime()
      )
    : "-";

  const status = job.status.toUpperCase().padEnd(10);
  const promptPreview = job.prompt.slice(0, 50) + (job.prompt.length > 50 ? "..." : "");

  return `${job.id}  ${status}  ${elapsed.padEnd(8)}  ${job.reasoningEffort.padEnd(6)}  ${promptPreview}`;
}

async function main() {
  const isWindows = process.platform === "win32";
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(HELP);
    process.exit(0);
  }

  const { command, positional, options } = parseArgs(args);

  try {
    switch (command) {
      case "health": {
        if (isWindows) {
          console.log("tmux: n/a (windows native mode)");
        } else {
          // Check tmux
          if (!isTmuxAvailable()) {
            console.error("tmux not found");
            console.error(getTmuxInstallHint());
            process.exit(1);
          }
          console.log("tmux: OK");
        }

        // Check codex
        const { execSync } = await import("child_process");
        try {
          const version = execSync("codex --version", { encoding: "utf-8" }).trim();
          console.log(`codex: ${version}`);
        } catch {
          console.error("codex CLI not found");
          console.error("Install with: npm install -g @openai/codex");
          process.exit(1);
        }

        console.log("Status: Ready");
        break;
      }

      case "start": {
        if (positional.length === 0) {
          console.error("Error: No prompt provided");
          process.exit(1);
        }

        if (!isWindows) {
          // Check tmux first
          if (!isTmuxAvailable()) {
            console.error("Error: tmux is required but not installed");
            console.error(getTmuxInstallHint());
            process.exit(1);
          }
        }

        let prompt = positional.join(" ");

        // Load file context if specified
        if (options.files.length > 0) {
          const files = await loadFiles(options.files, options.dir);
          prompt = formatPromptWithFiles(prompt, files);
          console.error(`Included ${files.length} files`);
        }

        // Include codebase map if requested
        if (options.includeMap) {
          const map = await loadCodebaseMap(options.dir);
          if (map) {
            prompt = `## Codebase Map\n\n${map}\n\n---\n\n${prompt}`;
            console.error("Included codebase map");
          } else {
            console.error("No codebase map found");
          }
        }

        if (options.dryRun) {
          const tokens = estimateTokens(prompt);
          console.log(`Would send ~${tokens.toLocaleString()} tokens`);
          console.log(`Model: ${options.model}`);
          console.log(`Reasoning: ${options.reasoning}`);
          console.log(`Subagent reasoning: ${options.subagentReasoning}`);
          console.log(`Sandbox: ${options.sandbox}`);
          console.log("\n--- Prompt Preview ---\n");
          console.log(prompt.slice(0, 3000));
          if (prompt.length > 3000) {
            console.log(`\n... (${prompt.length - 3000} more characters)`);
          }
          process.exit(0);
        }

        const authToken = ensureAuthToken();
        if (!authToken) {
          console.error("Error: OpenAI OAuth token not found.");
          console.error("Run: codex login");
          process.exit(1);
        }

        const job = startJob({
          prompt,
          model: options.model,
          reasoningEffort: options.reasoning,
          subagentReasoningEffort: options.subagentReasoning,
          sandbox: options.sandbox,
          parentSessionId: options.parentSessionId ?? undefined,
          cwd: options.dir,
          authToken,
          useProtocol: options.protocol,
          contextFiles: options.files,
        });

        console.log(`Job started: ${job.id}`);
        console.log(
          `Model: ${job.model} (${job.reasoningEffort}, subagents: ${job.subagentReasoningEffort ?? config.defaultSubagentReasoningEffort})`
        );
        console.log(`Working dir: ${job.cwd}`);
        if (job.tmuxSession) {
          console.log(`tmux session: ${job.tmuxSession}`);
        }
        console.log("");
        console.log("Commands:");
        console.log(`  Capture output:  codex-agent capture ${job.id}`);
        if (job.backend !== "native") {
          console.log(`  Send message:    codex-agent send ${job.id} "message"`);
        }
        const attachCmd = getAttachCommand(job.id);
        if (attachCmd) {
          console.log(`  Attach session:  ${attachCmd}`);
        }
        break;
      }

      case "status": {
        if (positional.length === 0) {
          console.error("Error: No job ID provided");
          process.exit(1);
        }

        const job = refreshJobStatus(positional[0]);
        if (!job) {
          console.error(`Job ${positional[0]} not found`);
          process.exit(1);
        }

        console.log(`Job: ${job.id}`);
        console.log(`Status: ${job.status}`);
        console.log(
          `Model: ${job.model} (${job.reasoningEffort}, subagents: ${job.subagentReasoningEffort ?? config.defaultSubagentReasoningEffort})`
        );
        console.log(`Sandbox: ${job.sandbox}`);
        console.log(`Created: ${job.createdAt}`);
        if (job.startedAt) {
          console.log(`Started: ${job.startedAt}`);
        }
        if (job.completedAt) {
          console.log(`Completed: ${job.completedAt}`);
        }
        if (job.tmuxSession) {
          console.log(`tmux session: ${job.tmuxSession}`);
        }
        if (job.error) {
          console.log(`Error: ${job.error}`);
        }
        break;
      }

      case "send": {
        if (positional.length < 2) {
          console.error("Error: Usage: codex-agent send <jobId> \"message\"");
          process.exit(1);
        }

        const jobId = positional[0];
        const message = positional.slice(1).join(" ");
        const job = loadJob(jobId);
        if (job?.backend === "native") {
          console.error("Send is not supported in Windows native mode.");
          console.error("Use WSL/Docker for interactive sessions.");
          process.exit(1);
        }

        if (sendToJob(jobId, message)) {
          console.log(`Sent to ${jobId}: ${message}`);
        } else {
          console.error(`Could not send to job ${jobId}`);
          console.error("Job may not be running or tmux session not found");
          process.exit(1);
        }
        break;
      }

      case "capture": {
        if (positional.length === 0) {
          console.error("Error: No job ID provided");
          process.exit(1);
        }

        let lines = 50;
        if (positional[1]) {
          const parsed = parseInt(positional[1], 10);
          if (Number.isNaN(parsed) || parsed <= 0) {
            console.error(`Error: Invalid line count: ${positional[1]}`);
            console.error("Line count must be a positive integer");
            process.exit(1);
          }
          lines = parsed;
        }
        let output = getJobOutput(positional[0], lines);

        if (output) {
          if (options.stripAnsi) {
            output = stripAnsiCodes(output);
          }
          console.log(output);
        } else {
          console.error(`Could not capture output for job ${positional[0]}`);
          process.exit(1);
        }
        break;
      }

      case "output": {
        if (positional.length === 0) {
          console.error("Error: No job ID provided");
          process.exit(1);
        }

        let output = getJobFullOutput(positional[0]);
        if (output) {
          if (options.stripAnsi) {
            output = stripAnsiCodes(output);
          }
          console.log(output);
        } else {
          console.error(`Could not get output for job ${positional[0]}`);
          process.exit(1);
        }
        break;
      }

      case "attach": {
        if (positional.length === 0) {
          console.error("Error: No job ID provided");
          process.exit(1);
        }

        const attachCmd = getAttachCommand(positional[0]);
        if (attachCmd) {
          console.log(attachCmd);
        } else {
          console.error(`Job ${positional[0]} not found or no tmux session`);
          process.exit(1);
        }
        break;
      }

      case "watch": {
        if (positional.length === 0) {
          console.error("Error: No job ID provided");
          process.exit(1);
        }

        const job = loadJob(positional[0]);
        if (!job || !job.tmuxSession) {
          console.error(`Job ${positional[0]} not found or no tmux session`);
          process.exit(1);
        }

        console.error(`Watching ${job.tmuxSession}... (Ctrl+C to stop)`);
        const attachCmd = getAttachCommand(job.id);
        if (attachCmd) {
          console.error("For interactive mode, use: " + attachCmd);
        }
        console.error("");

        // Prefer tailing the log file to avoid repeated full captures.
        const logFile = join(config.jobsDir, `${job.id}.log`);
        let logFd: number | null = null;
        let logOffset = 0;

        const maybeOpenLog = () => {
          if (logFd !== null) return;
          try {
            logFd = openSync(logFile, "r");
            const stats = statSync(logFile);
            logOffset = stats.size;
          } catch {
            logFd = null;
          }
        };

        const printDelta = (output: string | null, lastOutput: string) => {
          if (!output || output === lastOutput) return { printed: false, next: lastOutput };
          if (lastOutput && output.startsWith(lastOutput)) {
            const newPart = output.slice(lastOutput.length);
            if (newPart.trim()) {
              process.stdout.write(newPart);
              return { printed: true, next: output };
            }
            return { printed: false, next: output };
          }
          console.log(output);
          return { printed: true, next: output };
        };

        // Emit an initial snapshot for context.
        let lastOutput = "";
        const initial = getJobOutput(positional[0], 100);
        const initialPrinted = printDelta(initial, lastOutput);
        lastOutput = initialPrinted.next;

        const pollInterval = setInterval(() => {
          maybeOpenLog();
          if (logFd !== null) {
            try {
              const stats = statSync(logFile);
              if (stats.size > logOffset) {
                const length = stats.size - logOffset;
                const buffer = Buffer.alloc(length);
                const bytesRead = readSync(logFd, buffer, 0, length, logOffset);
                logOffset += bytesRead;
                const chunk = buffer.toString("utf-8", 0, bytesRead);
                if (chunk.trim()) {
                  process.stdout.write(chunk);
                }
                return;
              }
            } catch {
              // Fall back to tmux capture if log tailing fails.
              if (logFd !== null) {
                closeSync(logFd);
                logFd = null;
              }
            }
          }

          const output = getJobOutput(positional[0], 100);
          const printed = printDelta(output, lastOutput);
          lastOutput = printed.next;

          // Check if job is still running
          const refreshed = refreshJobStatus(positional[0]);
          if (refreshed && refreshed.status !== "running") {
            console.error(`\nJob ${refreshed.status}`);
            clearInterval(pollInterval);
            if (logFd !== null) {
              closeSync(logFd);
            }
            process.exit(0);
          }
        }, 1000);

        // Handle Ctrl+C
        process.on("SIGINT", () => {
          clearInterval(pollInterval);
          if (logFd !== null) {
            closeSync(logFd);
          }
          console.error("\nStopped watching");
          process.exit(0);
        });
        break;
      }

      case "jobs": {
        if (options.json) {
          const payload = getJobsJson();
          console.log(JSON.stringify(payload, null, 2));
          break;
        }

        const jobs = listJobs();
        if (jobs.length === 0) {
          console.log("No jobs");
        } else {
          console.log("ID        STATUS      ELAPSED   EFFORT  PROMPT");
          console.log("-".repeat(80));
          for (const job of jobs) {
            // Refresh running jobs and use the updated status
            const displayJob = job.status === "running"
              ? refreshJobStatus(job.id) ?? job
              : job;
            console.log(formatJobStatus(displayJob));
          }
        }
        break;
      }

      case "sessions": {
        const sessions = listSessions();
        if (sessions.length === 0) {
          console.log("No active codex-agent sessions");
        } else {
          console.log("SESSION NAME                    ATTACHED  CREATED");
          console.log("-".repeat(60));
          for (const session of sessions) {
            const attached = session.attached ? "yes" : "no";
            console.log(
              `${session.name.padEnd(30)}  ${attached.padEnd(8)}  ${session.created}`
            );
          }
        }
        break;
      }

      case "kill": {
        if (positional.length === 0) {
          console.error("Error: No job ID provided");
          process.exit(1);
        }

        if (killJob(positional[0])) {
          console.log(`Killed job: ${positional[0]}`);
        } else {
          console.error(`Could not kill job: ${positional[0]}`);
          process.exit(1);
        }
        break;
      }

      case "clean": {
        const cleaned = cleanupOldJobs(7);
        console.log(`Cleaned ${cleaned} old jobs`);
        break;
      }

      case "delete": {
        if (positional.length === 0) {
          console.error("Error: No job ID provided");
          process.exit(1);
        }

        if (deleteJob(positional[0])) {
          console.log(`Deleted job: ${positional[0]}`);
        } else {
          console.error(`Could not delete job: ${positional[0]}`);
          process.exit(1);
        }
        break;
      }

      case "result": {
        if (positional.length === 0) {
          console.error("Error: No job ID provided");
          process.exit(1);
        }

        const result = getJobResult(positional[0]);
        if (result) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.error(`Could not get result for job ${positional[0]}`);
          process.exit(1);
        }
        break;
      }

      case "progress": {
        if (positional.length === 0) {
          console.error("Error: No job ID provided");
          process.exit(1);
        }

        const job = refreshJobStatus(positional[0]);
        if (!job) {
          console.error(`Job ${positional[0]} not found`);
          process.exit(1);
        }

        const progress = getJobProgress(positional[0]);
        if (options.json) {
          console.log(JSON.stringify({
            job_id: job.id,
            job_status: job.status,
            ...progress,
          }, null, 2));
        } else {
          console.log(`Job: ${job.id}`);
          console.log(`Status: ${job.status}`);
          if (progress) {
            if (progress.status) console.log(`Agent status: ${progress.status}`);
            if (progress.progress !== null) console.log(`Progress: ${progress.progress}%`);
            if (progress.findings.length > 0) {
              console.log(`Findings: ${progress.findings.length}`);
              for (const finding of progress.findings) {
                const loc = finding.file ? ` (${finding.file}${finding.line ? `:${finding.line}` : ""})` : "";
                console.log(`  [${finding.severity}]${loc} ${finding.issue}`);
              }
            }
          }
        }
        break;
      }

      case "wait": {
        if (positional.length === 0) {
          console.error("Error: No job ID provided");
          process.exit(1);
        }

        let timeoutSec = options.timeout;
        if (positional[1]) {
          const parsed = parseInt(positional[1], 10);
          if (Number.isNaN(parsed) || parsed <= 0) {
            console.error(`Error: Invalid timeout: ${positional[1]}`);
            process.exit(1);
          }
          timeoutSec = parsed;
        }

        console.error(`Waiting for job ${positional[0]} (timeout: ${timeoutSec}s)...`);
        const completedJob = await waitForJob(positional[0], timeoutSec * 1000);

        if (!completedJob) {
          console.error(`Job ${positional[0]} not found`);
          process.exit(1);
        }

        if (completedJob.status === "running") {
          console.error(`Timeout: job still running after ${timeoutSec}s`);
          process.exit(1);
        }

        console.log(`Job ${completedJob.status}: ${completedJob.id}`);
        if (options.json) {
          const result = getJobResult(completedJob.id);
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }

      case "run": {
        if (positional.length === 0) {
          console.error("Error: No prompt provided");
          process.exit(1);
        }

        if (!isWindows) {
          if (!isTmuxAvailable()) {
            console.error("Error: tmux is required but not installed");
            console.error(getTmuxInstallHint());
            process.exit(1);
          }
        }

        let prompt = positional.join(" ");

        // Load file context if specified
        if (options.files.length > 0) {
          const files = await loadFiles(options.files, options.dir);
          prompt = formatPromptWithFiles(prompt, files);
          console.error(`Included ${files.length} files`);
        }

        // Include codebase map if requested
        if (options.includeMap) {
          const map = await loadCodebaseMap(options.dir);
          if (map) {
            prompt = `## Codebase Map\n\n${map}\n\n---\n\n${prompt}`;
            console.error("Included codebase map");
          }
        }

        const authToken = ensureAuthToken();
        if (!authToken) {
          console.error("Error: OpenAI OAuth token not found.");
          console.error("Run: codex login");
          process.exit(1);
        }

        console.error(`Starting job and waiting (timeout: ${options.timeout}s)...`);

        const outcome = await startJobAndWait({
          prompt,
          model: options.model,
          reasoningEffort: options.reasoning,
          subagentReasoningEffort: options.subagentReasoning,
          sandbox: options.sandbox,
          parentSessionId: options.parentSessionId ?? undefined,
          cwd: options.dir,
          authToken,
          useProtocol: true, // Always use protocol for run command
          contextFiles: options.files,
        }, options.timeout * 1000);

        if (!outcome) {
          console.error("Error: Job failed to start or timed out");
          process.exit(1);
        }

        const { job, result } = outcome;
        console.error(`Job ${job.status}: ${job.id}`);

        if (result) {
          console.log(JSON.stringify(result, null, 2));
        } else if (job.error) {
          console.error(`Error: ${job.error}`);
          process.exit(1);
        }
        break;
      }

      default:
        // Treat as prompt for start command
        if (command) {
          // Check tmux first
          if (!isWindows) {
            if (!isTmuxAvailable()) {
              console.error("Error: tmux is required but not installed");
              console.error(getTmuxInstallHint());
              process.exit(1);
            }
          }

          const prompt = [command, ...positional].join(" ");

          if (options.dryRun) {
            const tokens = estimateTokens(prompt);
            console.log(`Would send ~${tokens.toLocaleString()} tokens`);
            process.exit(0);
          }

          const authToken = ensureAuthToken();
          if (!authToken) {
            console.error("Error: OpenAI OAuth token not found.");
            console.error("Run: codex login");
            process.exit(1);
          }

          const job = startJob({
            prompt,
            model: options.model,
            reasoningEffort: options.reasoning,
            subagentReasoningEffort: options.subagentReasoning,
            sandbox: options.sandbox,
            parentSessionId: options.parentSessionId ?? undefined,
            cwd: options.dir,
            authToken,
          });

          console.log(`Job started: ${job.id}`);
          if (job.tmuxSession) {
            console.log(`tmux session: ${job.tmuxSession}`);
          }
          const attachCmd = getAttachCommand(job.id);
          if (attachCmd) {
            console.log(`Attach: ${attachCmd}`);
          }
        } else {
          console.log(HELP);
        }
    }
  } catch (err) {
    console.error("Error:", (err as Error).message);
    process.exit(1);
  }
}

main();
