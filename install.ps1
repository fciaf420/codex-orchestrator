# PowerShell installer for codex-orchestrator CLI (Windows native)
# This script is called automatically by Claude Code plugin install
# Or run manually: .\install.ps1

$ErrorActionPreference = "Stop"

$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BinDir = Join-Path $env:USERPROFILE ".local\bin"

Write-Host "Installing codex-orchestrator CLI (Windows native)..." -ForegroundColor Cyan
Write-Host ""

# Check dependencies
Write-Host "Checking dependencies..." -ForegroundColor Yellow

# Check Bun (with fallback to common install locations)
$bunFound = $false
try {
    $bunVersion = bun --version 2>$null
    if ($bunVersion) {
        $bunFound = $true
        Write-Host "  bun: $bunVersion" -ForegroundColor Green
    }
} catch {}

if (-not $bunFound) {
    # Check common bun install locations
    $bunPaths = @(
        "$env:USERPROFILE\.bun\bin",
        "$env:BUN_INSTALL\bin",
        "$env:LOCALAPPDATA\bun\bin"
    )
    foreach ($bunPath in $bunPaths) {
        $bunExe = Join-Path $bunPath "bun.exe"
        if (Test-Path $bunExe) {
            Write-Host "  bun: Found at $bunPath (adding to PATH)" -ForegroundColor Yellow
            $env:PATH += ";$bunPath"
            $bunVersion = & $bunExe --version 2>$null
            Write-Host "  bun: $bunVersion" -ForegroundColor Green
            $bunFound = $true
            break
        }
    }
}

if (-not $bunFound) {
    Write-Host "  bun: NOT FOUND" -ForegroundColor Red
    Write-Host "  Install from: https://bun.sh/docs/installation" -ForegroundColor Yellow
    Write-Host "  Then restart your terminal and try again" -ForegroundColor Yellow
    exit 1
}

# Check Codex CLI
try {
    $codexVersion = codex --version 2>$null
    Write-Host "  codex: $codexVersion" -ForegroundColor Green
} catch {
    Write-Host "  codex: NOT FOUND" -ForegroundColor Red
    Write-Host "  Install with: npm install -g @openai/codex" -ForegroundColor Yellow
    exit 1
}

Write-Host "  tmux: SKIPPED (not required on Windows)" -ForegroundColor Gray
Write-Host ""

# Install npm dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
Push-Location $RepoDir
bun install --silent
Pop-Location

Write-Host ""

# Create bin directory if needed
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}

# Create a Windows batch wrapper
$BatchWrapper = Join-Path $BinDir "codex-agent.cmd"
$BatchContent = @"
@echo off
bun run "$RepoDir\src\cli.ts" %*
"@
Set-Content -Path $BatchWrapper -Value $BatchContent -Encoding ASCII
Write-Host "  Created CLI wrapper: $BatchWrapper" -ForegroundColor Green

# Add bin directory to user PATH if not already there
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$BinDir*") {
    Write-Host "Adding $BinDir to user PATH..." -ForegroundColor Yellow
    $newPath = "$userPath;$BinDir"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    $env:Path = "$env:Path;$BinDir"
    Write-Host "  Added to PATH (restart terminal for full effect)" -ForegroundColor Green
} else {
    Write-Host "  $BinDir already in PATH" -ForegroundColor Green
}

Write-Host ""
Write-Host "CLI installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Usage:" -ForegroundColor Cyan
Write-Host "  CLI:   codex-agent start `"your task`" --map"
Write-Host "  Skill: /codex-agent in Claude Code (any project)"
Write-Host ""
Write-Host "IMPORTANT: Restart your terminal, then run:" -ForegroundColor Yellow
Write-Host "  codex-agent health" -ForegroundColor White
Write-Host ""
Write-Host "Note: Windows native mode does not support 'send' command." -ForegroundColor Gray
Write-Host "Use WSL for interactive agent sessions." -ForegroundColor Gray
