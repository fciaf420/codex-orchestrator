// Protocol definitions for orchestrator-agent communication

// ============================================================================
// Task Envelope - Input to agent
// ============================================================================

export interface TaskEnvelope {
  task_id: string;
  parent_session?: string;
  objective: string;
  context_files: string[];
  output_schema?: string;
  report_to: string;
  created_at: string;
}

// ============================================================================
// Result Output - Structured output from agent
// ============================================================================

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  severity: FindingSeverity;
  file?: string;
  line?: number;
  issue: string;
  suggestion?: string;
}

export interface ResultOutput {
  task_id: string;
  status: "completed" | "failed" | "partial";
  findings: Finding[];
  files_modified: string[];
  summary: string;
  tokens_used: {
    input: number;
    output: number;
  } | null;
  completed_at: string;
  error?: string;
}

// ============================================================================
// Agent Status Events - Real-time communication markers
// ============================================================================

export type AgentEventType =
  | "STATUS"
  | "PROGRESS"
  | "FINDING"
  | "FILE_MODIFIED"
  | "COMPLETE"
  | "ERROR";

export interface AgentEvent {
  type: AgentEventType;
  payload: string;
  timestamp: Date;
}

// Event marker format: [CODEX-AGENT:TYPE:payload]
const EVENT_PATTERN = /\[CODEX-AGENT:(\w+):([^\]]*)\]/g;

/**
 * Parse agent status events from output text
 */
export function parseAgentEvents(output: string): AgentEvent[] {
  const events: AgentEvent[] = [];
  let match: RegExpExecArray | null;

  while ((match = EVENT_PATTERN.exec(output)) !== null) {
    const type = match[1] as AgentEventType;
    const payload = match[2];

    events.push({
      type,
      payload,
      timestamp: new Date(),
    });
  }

  return events;
}

/**
 * Extract findings from FINDING events
 */
export function extractFindingsFromEvents(events: AgentEvent[]): Finding[] {
  const findings: Finding[] = [];

  for (const event of events) {
    if (event.type !== "FINDING") continue;

    try {
      const parsed = JSON.parse(event.payload);
      if (isValidFinding(parsed)) {
        findings.push(parsed);
      }
    } catch {
      // If not valid JSON, create a basic finding from the text
      findings.push({
        severity: "info",
        issue: event.payload,
      });
    }
  }

  return findings;
}

/**
 * Extract modified files from FILE_MODIFIED events
 */
export function extractModifiedFiles(events: AgentEvent[]): string[] {
  const files: string[] = [];

  for (const event of events) {
    if (event.type === "FILE_MODIFIED" && event.payload.trim()) {
      files.push(event.payload.trim());
    }
  }

  return files;
}

/**
 * Get the latest status from events
 */
export function getLatestStatus(events: AgentEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === "STATUS") {
      return events[i].payload;
    }
  }
  return null;
}

/**
 * Get progress percentage from events
 */
export function getProgress(events: AgentEvent[]): number | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === "PROGRESS") {
      const match = events[i].payload.match(/(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  }
  return null;
}

/**
 * Check if job completed based on events
 */
export function isCompleteFromEvents(events: AgentEvent[]): { complete: boolean; success: boolean } {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === "COMPLETE") {
      return {
        complete: true,
        success: events[i].payload.toLowerCase() === "success",
      };
    }
    if (events[i].type === "ERROR") {
      return {
        complete: true,
        success: false,
      };
    }
  }
  return { complete: false, success: false };
}

/**
 * Type guard for Finding
 */
function isValidFinding(obj: unknown): obj is Finding {
  if (!obj || typeof obj !== "object") return false;
  const record = obj as Record<string, unknown>;
  return typeof record.issue === "string";
}

// ============================================================================
// Prompt Generation - Instructions for agent to use protocol
// ============================================================================

/**
 * Generate protocol instructions to prepend to agent prompts
 */
export function generateProtocolInstructions(envelope: TaskEnvelope): string {
  return `## Orchestration Protocol

You are being orchestrated by a parent agent. Follow these communication guidelines:

### Task Information
- Task ID: ${envelope.task_id}
- Output Report: ${envelope.report_to}
${envelope.parent_session ? `- Parent Session: ${envelope.parent_session}` : ""}

### Status Events
Emit status events in this format so the orchestrator can track progress:

\`\`\`
[CODEX-AGENT:STATUS:analyzing]     - Current activity
[CODEX-AGENT:PROGRESS:25%]         - Percentage complete
[CODEX-AGENT:FINDING:{"severity":"high","file":"src/auth.ts","line":42,"issue":"SQL injection vulnerability"}]
[CODEX-AGENT:FILE_MODIFIED:src/utils.ts]
[CODEX-AGENT:COMPLETE:success]     - When done (success/failed)
[CODEX-AGENT:ERROR:description]    - If something fails
\`\`\`

### Finding Severities
- critical: Security vulnerability, data loss risk
- high: Significant bug or security issue
- medium: Code quality issue, potential bug
- low: Minor improvement suggestion
- info: Observation or note

### Output Requirements
1. Emit [CODEX-AGENT:STATUS:...] at major stages
2. Emit [CODEX-AGENT:FINDING:...] for each issue found (JSON format preferred)
3. Emit [CODEX-AGENT:FILE_MODIFIED:...] for each file you change
4. End with [CODEX-AGENT:COMPLETE:success] or [CODEX-AGENT:COMPLETE:failed]

---

`;
}

/**
 * Create an empty result template
 */
export function createEmptyResult(taskId: string): ResultOutput {
  return {
    task_id: taskId,
    status: "partial",
    findings: [],
    files_modified: [],
    summary: "",
    tokens_used: null,
    completed_at: new Date().toISOString(),
  };
}
