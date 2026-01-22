// Shared utilities for codex-agent

/**
 * Strip ANSI escape codes and control characters from text.
 * Handles colors, cursor movements, OSC sequences, carriage returns, and other control chars.
 */
export function stripAnsiCodes(text: string): string {
  return text
    // Remove ANSI escape sequences (colors, cursor movements, etc)
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    // Remove other escape sequences (OSC, etc)
    .replace(/\x1b\][^\x07]*\x07/g, '')
    // Remove carriage returns (used for spinner overwrites)
    .replace(/\r/g, '')
    // Remove other control characters except newline and tab
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}

/**
 * Validate job ID format to prevent path traversal attacks.
 * Job IDs must be exactly 8 hex characters.
 */
export function isValidJobId(jobId: string): boolean {
  return /^[0-9a-f]{8}$/.test(jobId);
}
