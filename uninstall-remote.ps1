# Uninstall codex-orchestrator (Windows)
$ErrorActionPreference = "Stop"

Write-Host "Uninstalling codex-orchestrator..." -ForegroundColor Cyan

$InstallDir = Join-Path $env:USERPROFILE ".codex-orchestrator"
$BinFile = Join-Path $env:USERPROFILE ".local\bin\codex-agent.cmd"
$SkillFile = Join-Path $env:USERPROFILE ".claude\commands\codex-agent.md"

if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
if (Test-Path $BinFile) { Remove-Item -Force $BinFile }
if (Test-Path $SkillFile) { Remove-Item -Force $SkillFile }

Write-Host ""
Write-Host "Uninstalled:" -ForegroundColor Green
Write-Host "  - $InstallDir"
Write-Host "  - $BinFile"
Write-Host "  - $SkillFile"
Write-Host ""
Write-Host "Note: Job data in ~/.codex-agent/ was preserved." -ForegroundColor Gray
Write-Host "Run 'Remove-Item -Recurse ~/.codex-agent' to remove it." -ForegroundColor Gray
