# PowerShell uninstaller for codex-orchestrator
# Run: .\uninstall.ps1

$ErrorActionPreference = "Stop"

$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDest = Join-Path $env:USERPROFILE ".claude\commands\codex-agent"
$BinSource = Join-Path $RepoDir "bin"
$BatchWrapper = Join-Path $BinSource "codex-agent.cmd"

Write-Host "Uninstalling codex-orchestrator..." -ForegroundColor Cyan
Write-Host ""

# Remove batch wrapper
if (Test-Path $BatchWrapper) {
    Write-Host "Removing $BatchWrapper..." -ForegroundColor Yellow
    Remove-Item -Path $BatchWrapper -Force
}

# Remove from PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -like "*$BinSource*") {
    Write-Host "Removing $BinSource from PATH..." -ForegroundColor Yellow
    $newPath = ($userPath -split ";" | Where-Object { $_ -ne $BinSource }) -join ";"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
}

# Remove Claude skill (folder)
if (Test-Path $SkillDest) {
    Write-Host "Removing $SkillDest..." -ForegroundColor Yellow
    Remove-Item -Path $SkillDest -Recurse -Force
}

Write-Host ""
Write-Host "Uninstalled successfully." -ForegroundColor Green
Write-Host "Note: Dependencies (bun, codex) were not removed." -ForegroundColor Gray
Write-Host "Restart your terminal for PATH changes to take effect." -ForegroundColor Yellow
