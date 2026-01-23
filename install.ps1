# PowerShell installer for codex-orchestrator (Windows native)
# Run: .\install.ps1

$ErrorActionPreference = "Stop"

$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillSource = Join-Path $RepoDir ".claude\skills\codex-agent"
$SkillDest = Join-Path $env:USERPROFILE ".claude\skills\codex-agent"
$BinSource = Join-Path $RepoDir "bin"
$BinName = "codex-agent"

Write-Host "Installing codex-orchestrator (Windows native)..." -ForegroundColor Cyan
Write-Host ""

# Check dependencies
Write-Host "Checking dependencies..." -ForegroundColor Yellow

# Check Bun
try {
    $bunVersion = bun --version 2>$null
    Write-Host "  bun: $bunVersion" -ForegroundColor Green
} catch {
    Write-Host "  bun: NOT FOUND" -ForegroundColor Red
    Write-Host "  Install from: https://bun.sh/docs/installation" -ForegroundColor Yellow
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
bun install
Pop-Location

Write-Host ""

# Add bin directory to user PATH if not already there
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$BinSource*") {
    Write-Host "Adding $BinSource to user PATH..." -ForegroundColor Yellow
    $newPath = "$userPath;$BinSource"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    $env:Path = "$env:Path;$BinSource"
    Write-Host "  Added to PATH (restart terminal for full effect)" -ForegroundColor Green
} else {
    Write-Host "  $BinSource already in PATH" -ForegroundColor Green
}

# Create a Windows batch wrapper
$BatchWrapper = Join-Path $BinSource "codex-agent.cmd"
$BatchContent = @"
@echo off
bun run "$RepoDir\src\cli.ts" %*
"@
Set-Content -Path $BatchWrapper -Value $BatchContent -Encoding ASCII
Write-Host "  Created $BatchWrapper" -ForegroundColor Green

# Install Claude skill globally (folder structure)
Write-Host ""
Write-Host "Installing Claude skill..." -ForegroundColor Yellow
$SkillsDir = Join-Path $env:USERPROFILE ".claude\skills"
if (-not (Test-Path $SkillsDir)) {
    New-Item -ItemType Directory -Path $SkillsDir -Force | Out-Null
}
if (Test-Path $SkillDest) { Remove-Item -Recurse -Force $SkillDest }
Copy-Item -Path $SkillSource -Destination $SkillDest -Recurse
Write-Host "  Installed to $SkillDest" -ForegroundColor Green

Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Installed:" -ForegroundColor Cyan
Write-Host "  CLI:   $BatchWrapper"
Write-Host "  Skill: $SkillDest\SKILL.md"
Write-Host ""
Write-Host "Usage:" -ForegroundColor Cyan
Write-Host "  CLI:   codex-agent start `"your task`" --map"
Write-Host "  Skill: /codex-agent in Claude Code (any repo)"
Write-Host ""
Write-Host "IMPORTANT: Restart your terminal, then run:" -ForegroundColor Yellow
Write-Host "  codex-agent health" -ForegroundColor White
Write-Host ""
Write-Host "Note: Windows native mode does not support 'send' command." -ForegroundColor Gray
Write-Host "Use WSL for interactive agent sessions." -ForegroundColor Gray
