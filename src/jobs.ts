// Job management for async codex agent execution with tmux

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { spawn, spawnSync } from "child_process";
import { join } from "path";
import { config, ReasoningEffort, SandboxMode } from "./config.ts";
import { randomBytes } from "crypto";
import { extractSessionId, findSessionFile, parseSessionFile, type ParsedSessionData } from "./session-parser.ts";
import { isValidJobId } from "./utils.ts";
import {
  type TaskEnvelope,
  type ResultOutput,
  type Finding,
  parseAgentEvents,
  extractFindingsFromEvents,
  extractModifiedFiles,
  isCompleteFromEvents,
  generateProtocolInstructions,
  createEmptyResult,
} from "./protocol.ts";
import {
  createSession,
  killSession,
  sessionExists,
  getSessionName,
  capturePane,
  captureFullHistory,
  isSessionActive,
  sendMessage,
  sendControl,
} from "./tmux.ts";

export interface Job {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  prompt: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  subagentReasoningEffort?: ReasoningEffort;
  sandbox: SandboxMode;
  parentSessionId?: string;
  cwd: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  tmuxSession?: string;
  backend?: "tmux" | "native";
  pid?: number;
  result?: string;
  error?: string;
}

function isWindows(): boolean {
  return process.platform === "win32";
}

function ensureJobsDir(): void {
  mkdirSync(config.jobsDir, { recursive: true });
}

function generateJobId(): string {
  return randomBytes(4).toString("hex");
}

function getJobPath(jobId: string): string {
  return join(config.jobsDir, `${jobId}.json`);
}

export function saveJob(job: Job): void {
  ensureJobsDir();
  writeFileSync(getJobPath(job.id), JSON.stringify(job, null, 2), { mode: 0o600 });
}

export function loadJob(jobId: string): Job | null {
  if (!isValidJobId(jobId)) return null;
  try {
    const content = readFileSync(getJobPath(jobId), "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function listJobs(): Job[] {
  ensureJobsDir();
  const files = readdirSync(config.jobsDir).filter((f) => f.endsWith(".json"));
  return files
    .map((f) => {
      try {
        const content = readFileSync(join(config.jobsDir, f), "utf-8");
        return JSON.parse(content) as Job;
      } catch {
        return null;
      }
    })
    .filter((j): j is Job => j !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function truncateText(value: string | undefined | null, maxLength: number): string {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength);
}

function computeElapsedMs(job: Job): number {
  const start = job.startedAt ?? job.createdAt;
  const startMs = Date.parse(start);
  const endMs = job.completedAt ? Date.parse(job.completedAt) : Date.now();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, endMs - startMs);
}

function loadSessionData(jobId: string): ParsedSessionData | null {
  const logFile = join(config.jobsDir, `${jobId}.log`);
  let logContent: string;

  try {
    logContent = readFileSync(logFile, "utf-8");
  } catch {
    return null;
  }

  const sessionId = extractSessionId(logContent);
  if (!sessionId) return null;

  const sessionFile = findSessionFile(sessionId);
  if (!sessionFile) return null;

  return parseSessionFile(sessionFile);
}

export type JobsJsonEntry = {
  id: string;
  status: Job["status"];
  prompt: string;
  model: string;
  reasoning: ReasoningEffort;
  subagent_reasoning: ReasoningEffort;
  cwd: string;
  elapsed_ms: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  tokens: ParsedSessionData["tokens"] | null;
  files_modified: ParsedSessionData["files_modified"] | null;
  summary: string | null;
};

export type JobsJsonOutput = {
  generated_at: string;
  jobs: JobsJsonEntry[];
};

export function getJobsJson(): JobsJsonOutput {
  const jobs = listJobs();
  const enriched = jobs.map((job) => {
    const refreshed = job.status === "running" ? refreshJobStatus(job.id) : null;
    const effective = refreshed ?? job;
    const elapsedMs = computeElapsedMs(effective);

    let tokens: ParsedSessionData["tokens"] | null = null;
    let filesModified: ParsedSessionData["files_modified"] | null = null;
    let summary: string | null = null;

    if (effective.status === "completed") {
      const sessionData = loadSessionData(effective.id);
      if (sessionData) {
        tokens = sessionData.tokens;
        filesModified = sessionData.files_modified;
        summary = sessionData.summary ? truncateText(sessionData.summary, 500) : null;
      }
    }

    return {
      id: effective.id,
      status: effective.status,
      prompt: truncateText(effective.prompt, 100),
      model: effective.model,
      reasoning: effective.reasoningEffort,
      subagent_reasoning:
        effective.subagentReasoningEffort || config.defaultSubagentReasoningEffort,
      cwd: effective.cwd,
      elapsed_ms: elapsedMs,
      created_at: effective.createdAt,
      started_at: effective.startedAt ?? null,
      completed_at: effective.completedAt ?? null,
      tokens,
      files_modified: filesModified,
      summary,
    };
  });

  return {
    generated_at: new Date().toISOString(),
    jobs: enriched,
  };
}

export function deleteJob(jobId: string): boolean {
  if (!isValidJobId(jobId)) return false;
  const job = loadJob(jobId);

  // Kill tmux session if running
  if (job?.tmuxSession && sessionExists(job.tmuxSession)) {
    killSession(job.tmuxSession);
  }
  if (job?.backend === "native" && job.pid) {
    killNativeProcess(job.pid);
  }

  try {
    unlinkSync(getJobPath(jobId));
    // Clean up associated files if they exist
    const filesToClean = [
      `${jobId}.prompt`,
      `${jobId}.log`,
      `${jobId}.runner.cjs`,
      `${jobId}.runner.json`,
      `${jobId}.ps1`,
      `${jobId}.done.json`,
      `${jobId}.task.json`,
      `${jobId}.result.json`,
    ];
    for (const file of filesToClean) {
      try {
        unlinkSync(join(config.jobsDir, file));
      } catch {
        // File may not exist
      }
    }
    return true;
  } catch {
    return false;
  }
}

export interface StartJobOptions {
  prompt: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  subagentReasoningEffort?: ReasoningEffort;
  sandbox?: SandboxMode;
  parentSessionId?: string;
  cwd?: string;
  authToken?: string;
  // Protocol options
  useProtocol?: boolean;
  contextFiles?: string[];
}

function buildCodexArgs(options: {
  model: string;
  reasoningEffort: ReasoningEffort;
  subagentReasoningEffort: ReasoningEffort;
  sandbox: SandboxMode;
}): string[] {
  return [
    "-c",
    `model="${options.model}"`,
    "-c",
    `model_reasoning_effort="${options.reasoningEffort}"`,
    "-c",
    `subagent_model_reasoning_effort="${options.subagentReasoningEffort}"`,
    "-c",
    "skip_update_check=true",
    "-a",
    "never",
    "-s",
    options.sandbox,
  ];
}

function buildExecArgs(options: {
  model: string;
  reasoningEffort: ReasoningEffort;
  subagentReasoningEffort: ReasoningEffort;
  sandbox: SandboxMode;
}): string[] {
  return [
    "exec",
    "--skip-git-repo-check",
    "-c",
    `model="${options.model}"`,
    "-c",
    `model_reasoning_effort="${options.reasoningEffort}"`,
    "-c",
    `subagent_model_reasoning_effort="${options.subagentReasoningEffort}"`,
    "-c",
    "skip_update_check=true",
    "-s",
    options.sandbox,
    "--color",
    "never",
    "-",
  ];
}

function startNativeSession(options: {
  jobId: string;
  prompt: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  subagentReasoningEffort: ReasoningEffort;
  sandbox: SandboxMode;
  cwd: string;
  authToken?: string;
}): { success: boolean; pid?: number; error?: string } {
  const logFile = join(config.jobsDir, `${options.jobId}.log`);
  const promptFile = join(config.jobsDir, `${options.jobId}.prompt`);
  const runnerConfig = join(config.jobsDir, `${options.jobId}.runner.json`);
  const runnerScript = join(config.jobsDir, `${options.jobId}.runner.cjs`);
  const doneFile = join(config.jobsDir, `${options.jobId}.done.json`);

  try {
    writeFileSync(promptFile, options.prompt, { mode: 0o600 });
    writeFileSync(logFile, "", { flag: "a", mode: 0o600 });
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }

  const args = buildExecArgs({
    model: options.model,
    reasoningEffort: options.reasoningEffort,
    subagentReasoningEffort: options.subagentReasoningEffort,
    sandbox: options.sandbox,
  });

  const env = {
    ...process.env,
    ...(options.authToken ? { OPENAI_ACCESS_TOKEN: options.authToken } : {}),
  };

  try {
    const runnerConfigPayload = {
      cwd: options.cwd,
      promptFile,
      logFile,
      doneFile,
      args,
    };
    writeFileSync(runnerConfig, JSON.stringify(runnerConfigPayload), { encoding: "utf-8", mode: 0o600 });

    const runnerScriptContent = `
const fs = require("fs");
const { spawn } = require("child_process");

const configPath = process.argv[2];
if (!configPath) {
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
} catch (err) {
  process.exit(1);
}

try {
  process.chdir(config.cwd);
} catch {}

const logStream = fs.createWriteStream(config.logFile, { flags: "a" });
const logLine = (line) => {
  try {
    logStream.write(line);
  } catch {}
};

let prompt = "";
try {
  prompt = fs.readFileSync(config.promptFile, "utf-8");
} catch {}

const child = spawn("codex", config.args, {
  cwd: config.cwd,
  env: process.env,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

child.stdout.on("data", (chunk) => logStream.write(chunk));
child.stderr.on("data", (chunk) => logStream.write(chunk));
child.on("error", (err) => {
  logLine("[codex-agent] spawn error: " + err.message + "\\n");
});

if (child.stdin) {
  child.stdin.write(prompt);
  if (!prompt.endsWith("\\n")) child.stdin.write("\\n");
  child.stdin.end();
}

child.on("exit", (code, signal) => {
  logLine("\\n[codex-agent] exit code: " + String(code ?? "") + (signal ? " signal: " + signal : "") + "\\n");
  try {
    fs.writeFileSync(config.doneFile, JSON.stringify({ code, signal, at: new Date().toISOString() }));
  } catch {}
  logStream.end();
});
`;
    writeFileSync(runnerScript, runnerScriptContent, { encoding: "utf-8", mode: 0o600 });

    const child = spawn(process.execPath, [runnerScript, runnerConfig], {
      cwd: options.cwd,
      env,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    child.unref();
    return { success: true, pid: child.pid ?? undefined };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killNativeProcess(pid: number): boolean {
  if (isWindows()) {
    const result = spawnSync("taskkill", ["/PID", pid.toString(), "/T", "/F"], {
      stdio: "ignore",
    });
    return result.status === 0;
  }

  try {
    process.kill(pid);
    return true;
  } catch {
    return false;
  }
}

export function startJob(options: StartJobOptions): Job {
  ensureJobsDir();

  const jobId = generateJobId();
  const cwd = options.cwd || process.cwd();

  // Build the prompt, optionally with protocol instructions
  let finalPrompt = options.prompt;
  const resultPath = join(config.jobsDir, `${jobId}.result.json`);

  if (options.useProtocol) {
    const taskEnvelope: TaskEnvelope = {
      task_id: jobId,
      parent_session: options.parentSessionId,
      objective: options.prompt,
      context_files: options.contextFiles || [],
      report_to: resultPath,
      created_at: new Date().toISOString(),
    };

    // Write task envelope
    const taskEnvelopePath = join(config.jobsDir, `${jobId}.task.json`);
    writeFileSync(taskEnvelopePath, JSON.stringify(taskEnvelope, null, 2), { mode: 0o600 });

    // Prepend protocol instructions to prompt
    finalPrompt = generateProtocolInstructions(taskEnvelope) + options.prompt;
  }

  const job: Job = {
    id: jobId,
    status: "pending",
    prompt: options.prompt, // Store original prompt
    model: options.model || config.model,
    reasoningEffort: options.reasoningEffort || config.defaultReasoningEffort,
    subagentReasoningEffort:
      options.subagentReasoningEffort || config.defaultSubagentReasoningEffort,
    sandbox: options.sandbox || config.defaultSandbox,
    parentSessionId: options.parentSessionId,
    cwd,
    createdAt: new Date().toISOString(),
  };

  saveJob(job);

  if (isWindows()) {
    const result = startNativeSession({
      jobId,
      prompt: finalPrompt,
      model: job.model,
      reasoningEffort: job.reasoningEffort,
      subagentReasoningEffort:
        job.subagentReasoningEffort || config.defaultSubagentReasoningEffort,
      sandbox: job.sandbox,
      cwd,
      authToken: options.authToken,
    });

    if (result.success) {
      job.status = "running";
      job.startedAt = new Date().toISOString();
      job.backend = "native";
      job.pid = result.pid;
    } else {
      job.status = "failed";
      job.backend = "native";
      job.error = result.error || "Failed to start native session";
      job.completedAt = new Date().toISOString();
    }
  } else {
    // Create tmux session with codex
    const result = createSession({
      jobId,
      prompt: finalPrompt,
      model: job.model,
      reasoningEffort: job.reasoningEffort,
      subagentReasoningEffort:
        job.subagentReasoningEffort || config.defaultSubagentReasoningEffort,
      sandbox: job.sandbox,
      cwd,
      authToken: options.authToken,
    });

    if (result.success) {
      job.status = "running";
      job.startedAt = new Date().toISOString();
      job.tmuxSession = result.sessionName;
      job.backend = "tmux";
    } else {
      job.status = "failed";
      job.backend = "tmux";
      job.error = result.error || "Failed to create tmux session";
      job.completedAt = new Date().toISOString();
    }
  }

  saveJob(job);
  return job;
}

export function killJob(jobId: string): boolean {
  if (!isValidJobId(jobId)) return false;
  const job = loadJob(jobId);
  if (!job) return false;

  if (job.backend === "native" && job.pid) {
    killNativeProcess(job.pid);
  } else if (job.tmuxSession) {
    killSession(job.tmuxSession);
  }

  job.status = "failed";
  job.error = "Killed by user";
  job.completedAt = new Date().toISOString();
  saveJob(job);
  return true;
}

export function sendToJob(jobId: string, message: string): boolean {
  if (!isValidJobId(jobId)) return false;
  const job = loadJob(jobId);
  if (!job || job.backend === "native" || !job.tmuxSession) return false;

  return sendMessage(job.tmuxSession, message);
}

export function sendControlToJob(jobId: string, key: string): boolean {
  if (!isValidJobId(jobId)) return false;
  const job = loadJob(jobId);
  if (!job || job.backend === "native" || !job.tmuxSession) return false;

  return sendControl(job.tmuxSession, key);
}

export function getJobOutput(jobId: string, lines?: number): string | null {
  if (!isValidJobId(jobId)) return null;
  const job = loadJob(jobId);
  if (!job) return null;

  // First try tmux capture if session exists
  if (job.tmuxSession && sessionExists(job.tmuxSession)) {
    const output = capturePane(job.tmuxSession, { lines });
    if (output) return output;
  }

  // Fall back to log file
  const logFile = join(config.jobsDir, `${jobId}.log`);
  try {
    const content = readFileSync(logFile, "utf-8");
    if (lines) {
      const allLines = content.split("\n");
      return allLines.slice(-lines).join("\n");
    }
    return content;
  } catch {
    return null;
  }
}

export function getJobFullOutput(jobId: string): string | null {
  if (!isValidJobId(jobId)) return null;
  const job = loadJob(jobId);
  if (!job) return null;

  // First try tmux capture if session exists
  if (job.tmuxSession && sessionExists(job.tmuxSession)) {
    const output = captureFullHistory(job.tmuxSession);
    if (output) return output;
  }

  // Fall back to log file
  const logFile = join(config.jobsDir, `${jobId}.log`);
  try {
    return readFileSync(logFile, "utf-8");
  } catch {
    return null;
  }
}

export function cleanupOldJobs(maxAgeDays: number = 7): number {
  const jobs = listJobs();
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let cleaned = 0;

  for (const job of jobs) {
    const jobTime = new Date(job.completedAt || job.createdAt).getTime();
    if (jobTime < cutoff && (job.status === "completed" || job.status === "failed")) {
      if (deleteJob(job.id)) cleaned++;
    }
  }

  return cleaned;
}

export function isJobRunning(jobId: string): boolean {
  if (!isValidJobId(jobId)) return false;
  const job = loadJob(jobId);
  if (!job) return false;
  if (job.backend === "native" && job.pid) {
    return isPidRunning(job.pid);
  }
  if (!job.tmuxSession) return false;

  return isSessionActive(job.tmuxSession);
}

export function refreshJobStatus(jobId: string): Job | null {
  if (!isValidJobId(jobId)) return null;
  const job = loadJob(jobId);
  if (!job) return null;

  if (job.status === "running") {
    if (job.backend === "native") {
      if (!job.pid) {
        job.status = "failed";
        job.error = "Native job missing PID";
        job.completedAt = new Date().toISOString();
        saveJob(job);
      } else if (!isPidRunning(job.pid)) {
        job.status = "completed";
        job.completedAt = new Date().toISOString();
        const logFile = join(config.jobsDir, `${jobId}.log`);
        try {
          job.result = readFileSync(logFile, "utf-8");
        } catch {
          // No log file
        }
        saveJob(job);
      }
    } else if (job.tmuxSession) {
      // Check if tmux session still exists
      if (!sessionExists(job.tmuxSession)) {
        // Session ended completely
        job.status = "completed";
        job.completedAt = new Date().toISOString();
        const logFile = join(config.jobsDir, `${jobId}.log`);
        try {
          job.result = readFileSync(logFile, "utf-8");
        } catch {
          // No log file
        }
        saveJob(job);
      } else {
        // Session exists - check if codex is still running
        // Look for the "[codex-agent: Session complete" marker in output
        const output = capturePane(job.tmuxSession, { lines: 20 });
        if (output && output.includes("[codex-agent: Session complete")) {
          job.status = "completed";
          job.completedAt = new Date().toISOString();
          // Capture full output
          const fullOutput = captureFullHistory(job.tmuxSession);
          if (fullOutput) {
            job.result = fullOutput;
          }
          saveJob(job);
        }
      }
    }
  }

  return loadJob(jobId);
}

export function getAttachCommand(jobId: string): string | null {
  if (!isValidJobId(jobId)) return null;
  const job = loadJob(jobId);
  if (!job) return null;

  if (job.backend === "native") {
    const logFile = join(config.jobsDir, `${jobId}.log`);
    const escaped = logFile.replace(/'/g, "''");
    return `start powershell -NoExit -Command "Get-Content -Path '${escaped}' -Wait"`;
  }

  if (!job.tmuxSession) return null;
  return `tmux attach -t "${job.tmuxSession}"`;
}

// ============================================================================
// Protocol-based Result Functions
// ============================================================================

/**
 * Generate a structured result from job output by parsing agent events
 */
export function generateJobResult(jobId: string): ResultOutput | null {
  if (!isValidJobId(jobId)) return null;
  const job = loadJob(jobId);
  if (!job) return null;

  const output = getJobFullOutput(jobId);
  if (!output) {
    return createEmptyResult(jobId);
  }

  // Parse events from output
  const events = parseAgentEvents(output);
  const findings = extractFindingsFromEvents(events);
  const filesModified = extractModifiedFiles(events);
  const completion = isCompleteFromEvents(events);

  // Try to get tokens from session data
  let tokensUsed: ResultOutput["tokens_used"] = null;
  const sessionData = loadSessionData(jobId);
  if (sessionData?.tokens) {
    tokensUsed = {
      input: sessionData.tokens.input,
      output: sessionData.tokens.output,
    };
  }

  // Merge files_modified from session data if not found in events
  const allFilesModified = filesModified.length > 0
    ? filesModified
    : sessionData?.files_modified || [];

  // Use session summary if no events provided one
  const summary = sessionData?.summary || (findings.length > 0
    ? `Found ${findings.length} issue(s)`
    : "No findings");

  const result: ResultOutput = {
    task_id: jobId,
    status: completion.complete
      ? (completion.success ? "completed" : "failed")
      : (job.status === "completed" ? "completed" : "partial"),
    findings,
    files_modified: allFilesModified,
    summary,
    tokens_used: tokensUsed,
    completed_at: job.completedAt || new Date().toISOString(),
    error: job.error,
  };

  // Save result to file
  const resultPath = join(config.jobsDir, `${jobId}.result.json`);
  writeFileSync(resultPath, JSON.stringify(result, null, 2), { mode: 0o600 });

  return result;
}

/**
 * Get the structured result for a job
 * Returns cached result if available, otherwise generates it
 */
export function getJobResult(jobId: string): ResultOutput | null {
  if (!isValidJobId(jobId)) return null;

  const resultPath = join(config.jobsDir, `${jobId}.result.json`);

  // Try to load cached result
  if (existsSync(resultPath)) {
    try {
      const content = readFileSync(resultPath, "utf-8");
      return JSON.parse(content) as ResultOutput;
    } catch {
      // Fall through to regenerate
    }
  }

  // Generate result from output
  return generateJobResult(jobId);
}

/**
 * Wait for a job to complete
 * @param jobId - Job ID to wait for
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 5 minutes)
 * @param pollIntervalMs - How often to check status (default: 1 second)
 * @returns The completed job, or null if timeout or not found
 */
export async function waitForJob(
  jobId: string,
  timeoutMs: number = 300000,
  pollIntervalMs: number = 1000
): Promise<Job | null> {
  if (!isValidJobId(jobId)) return null;

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const job = refreshJobStatus(jobId);
    if (!job) return null;

    if (job.status === "completed" || job.status === "failed") {
      // Generate result on completion
      generateJobResult(jobId);
      return job;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Timeout - return current state
  return loadJob(jobId);
}

/**
 * Start a job and wait for it to complete
 * @param options - Job options
 * @param timeoutMs - Maximum time to wait (default: 5 minutes)
 * @returns Object with job and result, or null if failed
 */
export async function startJobAndWait(
  options: StartJobOptions,
  timeoutMs: number = 300000
): Promise<{ job: Job; result: ResultOutput | null } | null> {
  // Enable protocol by default for spawn-and-wait
  const jobOptions: StartJobOptions = {
    ...options,
    useProtocol: options.useProtocol !== false,
  };

  const job = startJob(jobOptions);
  if (job.status === "failed") {
    return { job, result: null };
  }

  const completedJob = await waitForJob(job.id, timeoutMs);
  if (!completedJob) {
    return null;
  }

  const result = getJobResult(completedJob.id);
  return { job: completedJob, result };
}

/**
 * Get job progress from events
 * @returns Progress info or null if not available
 */
export function getJobProgress(jobId: string): {
  status: string | null;
  progress: number | null;
  findings: Finding[];
} | null {
  if (!isValidJobId(jobId)) return null;

  const output = getJobOutput(jobId, 100);
  if (!output) return null;

  const events = parseAgentEvents(output);

  // Get latest status
  let status: string | null = null;
  let progress: number | null = null;

  for (let i = events.length - 1; i >= 0; i--) {
    if (!status && events[i].type === "STATUS") {
      status = events[i].payload;
    }
    if (progress === null && events[i].type === "PROGRESS") {
      const match = events[i].payload.match(/(\d+)/);
      if (match) {
        progress = parseInt(match[1], 10);
      }
    }
    if (status && progress !== null) break;
  }

  const findings = extractFindingsFromEvents(events);

  return { status, progress, findings };
}
