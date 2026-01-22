// OAuth credential management for Codex sessions

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import { config } from "./config.ts";

type StoredAuth = {
  access_token: string;
  source: string;
  updated_at: string;
};

const openAiAuthCandidates = [
  join(homedir(), ".config", "openai", "auth.json"),
  join(homedir(), ".config", "openai", "credentials.json"),
  join(homedir(), ".openai", "auth.json"),
  join(homedir(), ".openai", "credentials.json"),
];

function parseTokenFromObject(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const tokenCandidates = [
    record.access_token,
    record.accessToken,
    record.token,
    record.id_token,
  ];
  for (const candidate of tokenCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function readJsonFile(path: string): unknown | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as unknown;
}

function getEnvAccessToken(): string | null {
  const envToken = process.env.OPENAI_ACCESS_TOKEN || process.env.OPENAI_AUTH_TOKEN;
  if (typeof envToken === "string" && envToken.trim()) {
    return envToken.trim();
  }
  return null;
}

function loadCachedToken(): string | null {
  if (!existsSync(config.authFile)) return null;
  try {
    const raw = readFileSync(config.authFile, "utf-8");
    const parsed = JSON.parse(raw) as StoredAuth;
    if (typeof parsed?.access_token === "string" && parsed.access_token.trim()) {
      return parsed.access_token.trim();
    }
    return null;
  } catch (err) {
    console.error(`Warning: unable to read cached auth token at ${config.authFile}:`, err);
    return null;
  }
}

function saveCachedToken(accessToken: string, source: string): void {
  mkdirSync(dirname(config.authFile), { recursive: true });
  const payload: StoredAuth = {
    access_token: accessToken,
    source,
    updated_at: new Date().toISOString(),
  };
  writeFileSync(config.authFile, JSON.stringify(payload, null, 2));
  try {
    chmodSync(config.authFile, 0o600);
  } catch (err) {
    console.error(`Warning: unable to set permissions on ${config.authFile}:`, err);
  }
}

function loadOpenAiConfigToken(): string | null {
  for (const path of openAiAuthCandidates) {
    if (!existsSync(path)) continue;
    try {
      const parsed = readJsonFile(path);
      const token = parseTokenFromObject(parsed);
      if (token) return token;
    } catch (err) {
      console.error(`Warning: unable to read OpenAI auth file ${path}:`, err);
    }
  }
  return null;
}

export function resolveAuthToken(): string | null {
  const envToken = getEnvAccessToken();
  if (envToken) {
    saveCachedToken(envToken, "env");
    return envToken;
  }

  const openAiToken = loadOpenAiConfigToken();
  if (openAiToken) {
    saveCachedToken(openAiToken, "openai_config");
    return openAiToken;
  }

  const cachedToken = loadCachedToken();
  if (cachedToken) return cachedToken;

  return null;
}
