#!/usr/bin/env node
/**
 * npx installer for codex-orchestrator
 * Usage: npx codex-orchestrator
 *
 * This script downloads and installs codex-orchestrator from GitHub,
 * sets up the CLI, and installs the Claude Code skill.
 */

import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync, cpSync, chmodSync, readFileSync, appendFileSync } from "fs";
import { homedir, platform } from "os";
import { join } from "path";
import { createWriteStream } from "fs";
import https from "https";

const REPO = "fciaf420/codex-orchestrator";
const BRANCH = "main";
const HOME = homedir();
const IS_WINDOWS = platform() === "win32";

const INSTALL_DIR = IS_WINDOWS
  ? join(HOME, ".codex-orchestrator")
  : join(HOME, ".codex-orchestrator");

const SKILL_DIR = join(HOME, ".claude", "commands", "codex-agent");
const LOCAL_BIN = join(HOME, ".local", "bin");

function log(msg) {
  console.log(msg);
}

function error(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function commandExists(cmd) {
  try {
    if (IS_WINDOWS) {
      execSync(`where ${cmd}`, { stdio: "ignore" });
    } else {
      execSync(`command -v ${cmd}`, { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

function runCommand(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: "inherit", ...options });
  } catch (e) {
    if (!options.ignoreError) {
      error(`Command failed: ${cmd}`);
    }
    return null;
  }
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (url, redirects = 0) => {
      if (redirects > 5) {
        reject(new Error("Too many redirects"));
        return;
      }

      https.get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          follow(response.headers.location, redirects + 1);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const file = createWriteStream(dest);
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", reject);
      }).on("error", reject);
    };

    follow(url);
  });
}

async function extractTarGz(file, dest) {
  runCommand(`tar -xzf "${file}" -C "${dest}" --strip-components=1`);
}

async function extractZip(file, dest) {
  if (IS_WINDOWS) {
    runCommand(`powershell -Command "Expand-Archive -Path '${file}' -DestinationPath '${dest}' -Force"`);
    // Move contents from nested folder
    const nested = join(dest, `codex-orchestrator-${BRANCH}`);
    if (existsSync(nested)) {
      const items = require("fs").readdirSync(nested);
      for (const item of items) {
        const src = join(nested, item);
        const target = join(dest, item);
        if (existsSync(target)) rmSync(target, { recursive: true, force: true });
        require("fs").renameSync(src, target);
      }
      rmSync(nested, { recursive: true, force: true });
    }
  } else {
    runCommand(`unzip -o "${file}" -d "${dest}"`);
  }
}

function checkDependencies() {
  log("Checking dependencies...");

  // Check Bun
  if (!commandExists("bun")) {
    log("  bun: NOT FOUND");
    log("");
    log("Bun is required. Install with:");
    if (IS_WINDOWS) {
      log("  powershell -c \"irm bun.sh/install.ps1 | iex\"");
    } else {
      log("  curl -fsSL https://bun.sh/install | bash");
    }
    error("Please install Bun and re-run this installer.");
  }
  log("  bun: OK");

  // Check tmux (Unix only)
  if (!IS_WINDOWS) {
    if (!commandExists("tmux")) {
      log("  tmux: NOT FOUND");
      log("  Install with: brew install tmux (macOS) or apt install tmux (Linux)");
      error("tmux is required on Unix systems.");
    }
    log("  tmux: OK");
  } else {
    log("  tmux: SKIPPED (Windows native mode)");
  }

  // Check Codex CLI
  if (!commandExists("codex")) {
    log("  codex: NOT FOUND");
    log("  Install with: npm install -g @openai/codex");
    error("Codex CLI is required.");
  }
  log("  codex: OK");

  log("");
}

async function downloadAndExtract() {
  log("Downloading from GitHub...");

  // Clean existing installation
  if (existsSync(INSTALL_DIR)) {
    rmSync(INSTALL_DIR, { recursive: true, force: true });
  }
  mkdirSync(INSTALL_DIR, { recursive: true });

  const archiveUrl = `https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz`;
  const archiveFile = join(INSTALL_DIR, "repo.tar.gz");

  await downloadFile(archiveUrl, archiveFile);
  await extractTarGz(archiveFile, INSTALL_DIR);
  rmSync(archiveFile, { force: true });

  log("  Downloaded and extracted to ~/.codex-orchestrator");
}

function installDependencies() {
  log("Installing dependencies...");
  process.chdir(INSTALL_DIR);
  runCommand("bun install --silent", { stdio: "pipe" });
  log("  Dependencies installed");
}

function setupCli() {
  log("Setting up CLI...");

  mkdirSync(LOCAL_BIN, { recursive: true });

  if (IS_WINDOWS) {
    // Create batch wrapper for Windows
    const cmdPath = join(LOCAL_BIN, "codex-agent.cmd");
    const cmdContent = `@echo off\r\nbun run "%USERPROFILE%\\.codex-orchestrator\\src\\cli.ts" %*\r\n`;
    writeFileSync(cmdPath, cmdContent);
    log(`  Created ${cmdPath}`);

    // Add to PATH via PowerShell
    try {
      execSync(
        `powershell -Command "[Environment]::SetEnvironmentVariable('PATH', [Environment]::GetEnvironmentVariable('PATH', 'User') + ';${LOCAL_BIN}', 'User')"`,
        { stdio: "pipe" }
      );
      log("  Added to Windows PATH");
    } catch {
      log("  Could not add to PATH automatically");
    }
  } else {
    // Create shell wrapper for Unix
    const shPath = join(LOCAL_BIN, "codex-agent");
    const shContent = `#!/bin/bash\nbun run "$HOME/.codex-orchestrator/src/cli.ts" "$@"\n`;
    writeFileSync(shPath, shContent);
    chmodSync(shPath, 0o755);
    log(`  Created ${shPath}`);

    // Add to PATH if needed
    const path = process.env.PATH || "";
    if (!path.includes(LOCAL_BIN)) {
      const shellConfigs = [
        join(HOME, ".zshrc"),
        join(HOME, ".bashrc"),
        join(HOME, ".bash_profile"),
      ];

      for (const config of shellConfigs) {
        if (existsSync(config)) {
          const content = readFileSync(config, "utf8");
          if (!content.includes('export PATH="$HOME/.local/bin:$PATH"')) {
            appendFileSync(config, '\n# Added by codex-orchestrator\nexport PATH="$HOME/.local/bin:$PATH"\n');
            log(`  Added ~/.local/bin to PATH in ${config}`);
          }
          break;
        }
      }
    }
  }
}

function installSkill() {
  log("Installing Claude Code skill...");

  const skillSource = join(INSTALL_DIR, ".claude", "commands", "codex-agent");
  mkdirSync(join(HOME, ".claude", "commands"), { recursive: true });

  if (existsSync(SKILL_DIR)) {
    rmSync(SKILL_DIR, { recursive: true, force: true });
  }

  cpSync(skillSource, SKILL_DIR, { recursive: true });
  log(`  Installed to ${SKILL_DIR}`);
}

function printSuccess() {
  log("");
  log("Installation complete!");
  log("");
  log("Installed:");
  log(`  CLI:   ${LOCAL_BIN}/codex-agent${IS_WINDOWS ? ".cmd" : ""}`);
  log(`  Skill: ${SKILL_DIR}/SKILL.md`);
  log("");

  if (!IS_WINDOWS) {
    const path = process.env.PATH || "";
    if (!path.includes(LOCAL_BIN)) {
      log("Restart your terminal or run: source ~/.zshrc (or ~/.bashrc)");
      log("");
    }
  }

  log("Run 'codex-agent health' to verify installation.");
  log("");
  log("Usage:");
  log("  CLI:   codex-agent start \"your task\" --map");
  log("  Skill: /codex-agent in Claude Code");
}

async function main() {
  log("Installing codex-orchestrator...");
  log("");

  checkDependencies();
  await downloadAndExtract();
  installDependencies();
  setupCli();
  installSkill();
  printSuccess();
}

main().catch((e) => {
  error(e.message);
});
