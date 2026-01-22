// File loading utilities for context injection

import { glob } from "glob";
import { readFileSync, statSync } from "fs";
import { resolve, relative } from "path";

export interface FileContent {
  path: string;
  content: string;
}

export async function loadFiles(
  patterns: string[],
  baseDir: string = process.cwd()
): Promise<FileContent[]> {
  // Separate positive and negation patterns
  const positivePatterns = patterns.filter((p) => !p.startsWith("!"));
  const negationPatterns = patterns.filter((p) => p.startsWith("!")).map((p) => p.slice(1));

  // Collect all files matching positive patterns
  const seen = new Set<string>();
  const fileMap = new Map<string, FileContent>();

  for (const pattern of positivePatterns) {
    const matches = await glob(pattern, { cwd: baseDir, absolute: true });

    for (const match of matches) {
      if (seen.has(match)) continue;

      try {
        const stat = statSync(match);
        if (!stat.isFile()) continue;

        // Skip binary files and very large files
        if (stat.size > 500000) continue; // 500KB limit

        const content = readFileSync(match, "utf-8");

        // Skip binary content
        if (content.includes("\0")) continue;

        seen.add(match);
        fileMap.set(match, {
          path: relative(baseDir, match),
          content,
        });
      } catch {
        // Skip files we can't read
      }
    }
  }

  // Apply negation patterns to filter out excluded files
  for (const negPattern of negationPatterns) {
    const excludeMatches = await glob(negPattern, { cwd: baseDir, absolute: true });
    for (const match of excludeMatches) {
      fileMap.delete(match);
    }
  }

  return Array.from(fileMap.values());
}

export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

export function formatPromptWithFiles(
  prompt: string,
  files: FileContent[]
): string {
  if (files.length === 0) return prompt;

  let result = prompt + "\n\n---\n\n## File Context\n\n";

  for (const file of files) {
    const ext = file.path.split(".").pop() || "";
    result += `### ${file.path}\n\n\`\`\`${ext}\n${file.content}\n\`\`\`\n\n`;
  }

  return result;
}

export async function loadCodebaseMap(cwd: string): Promise<string | null> {
  const mapPaths = [
    resolve(cwd, "docs/CODEBASE_MAP.md"),
    resolve(cwd, "CODEBASE_MAP.md"),
    resolve(cwd, "docs/ARCHITECTURE.md"),
  ];

  for (const mapPath of mapPaths) {
    try {
      const content = readFileSync(mapPath, "utf-8");
      return content;
    } catch {
      // Try next path
    }
  }

  return null;
}
