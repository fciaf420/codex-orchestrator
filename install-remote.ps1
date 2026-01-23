# One-liner install for codex-orchestrator (Windows)
# Usage: irm https://raw.githubusercontent.com/fciaf420/codex-orchestrator/main/install-remote.ps1 | iex
$ErrorActionPreference = "Stop"

$Repo = "fciaf420/codex-orchestrator"
$Branch = "main"
$InstallDir = Join-Path $env:USERPROFILE ".codex-orchestrator"
$SkillDir = Join-Path $env:USERPROFILE ".claude\skills\codex-agent"
$BinDir = Join-Path $env:USERPROFILE ".local\bin"

Write-Host "Installing codex-orchestrator..." -ForegroundColor Cyan
Write-Host ""

# Check dependencies
Write-Host "Checking dependencies..." -ForegroundColor Yellow

try {
    $bunVersion = bun --version 2>$null
    Write-Host "  bun: $bunVersion" -ForegroundColor Green
} catch {
    Write-Host "  bun: NOT FOUND" -ForegroundColor Red
    Write-Host "  Install from: https://bun.sh/docs/installation" -ForegroundColor Yellow
    exit 1
}

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

# Download and extract
Write-Host "Downloading from GitHub..." -ForegroundColor Yellow
$TempZip = Join-Path $env:TEMP "codex-orchestrator.zip"
$TempExtract = Join-Path $env:TEMP "codex-orchestrator-extract"

if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
if (Test-Path $TempExtract) { Remove-Item -Recurse -Force $TempExtract }

Invoke-WebRequest -Uri "https://github.com/$Repo/archive/refs/heads/$Branch.zip" -OutFile $TempZip
Expand-Archive -Path $TempZip -DestinationPath $TempExtract -Force
Move-Item -Path (Join-Path $TempExtract "codex-orchestrator-$Branch") -Destination $InstallDir
Remove-Item $TempZip -Force
Remove-Item $TempExtract -Recurse -Force

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
Push-Location $InstallDir
bun install --silent
Pop-Location

# Create CLI wrapper
Write-Host "Setting up CLI..." -ForegroundColor Yellow
if (-not (Test-Path $BinDir)) { New-Item -ItemType Directory -Path $BinDir -Force | Out-Null }

$WrapperPath = Join-Path $BinDir "codex-agent.cmd"
$WrapperContent = @"
@echo off
bun run "%USERPROFILE%\.codex-orchestrator\src\cli.ts" %*
"@
Set-Content -Path $WrapperPath -Value $WrapperContent -Encoding ASCII

# Add to PATH if needed
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$BinDir*") {
    Write-Host "Adding $BinDir to PATH..." -ForegroundColor Yellow
    $NewPath = "$UserPath;$BinDir"
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    $env:Path = "$env:Path;$BinDir"
}

# Install Claude skill (folder structure)
Write-Host "Installing Claude Code skill..." -ForegroundColor Yellow
$SkillsDir = Join-Path $env:USERPROFILE ".claude\skills"
if (-not (Test-Path $SkillsDir)) { New-Item -ItemType Directory -Path $SkillsDir -Force | Out-Null }
if (Test-Path $SkillDir) { Remove-Item -Recurse -Force $SkillDir }
Copy-Item -Path (Join-Path $InstallDir ".claude\skills\codex-agent") -Destination $SkillDir -Recurse

Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Installed:" -ForegroundColor Cyan
Write-Host "  CLI:   $WrapperPath"
Write-Host "  Skill: $SkillDir\SKILL.md (global)"
Write-Host ""
Write-Host "IMPORTANT: Restart your terminal, then run:" -ForegroundColor Yellow
Write-Host "  codex-agent health" -ForegroundColor White
Write-Host ""
Write-Host "Usage:" -ForegroundColor Cyan
Write-Host "  CLI:   codex-agent start `"your task`" --map"
Write-Host "  Skill: /codex-agent in Claude Code"
Write-Host ""
Write-Host "Note: Windows native mode does not support 'send' command." -ForegroundColor Gray
Write-Host "Use WSL for interactive agent sessions." -ForegroundColor Gray
