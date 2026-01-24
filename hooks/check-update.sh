#!/bin/bash
# Auto-update check for codex-agent CLI
# Runs on SessionStart to check if CLI needs updating

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
MARKER_FILE="$HOME/.codex-agent/installed-hash"

# Function to compute hash of source files
compute_hash() {
    local dir="$1"
    # Hash key source files that affect the CLI
    if command -v sha256sum &> /dev/null; then
        find "$dir/src" -name "*.ts" -type f 2>/dev/null | sort | xargs cat 2>/dev/null | sha256sum | cut -d' ' -f1
    elif command -v shasum &> /dev/null; then
        find "$dir/src" -name "*.ts" -type f 2>/dev/null | sort | xargs cat 2>/dev/null | shasum -a 256 | cut -d' ' -f1
    else
        # Fallback: use modification time of newest file
        find "$dir/src" -name "*.ts" -type f -printf '%T@\n' 2>/dev/null | sort -rn | head -1
    fi
}

# Check if we're on Windows (Git Bash/MSYS)
is_windows() {
    [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ -n "$WINDIR" ]]
}

# Get installed hash
if [[ ! -f "$MARKER_FILE" ]]; then
    # No marker file - CLI was never installed or installed before this feature
    # Don't auto-update on first run, let user do it manually
    exit 0
fi

INSTALLED_HASH=$(cat "$MARKER_FILE" 2>/dev/null)
CURRENT_HASH=$(compute_hash "$PLUGIN_ROOT")

if [[ "$INSTALLED_HASH" != "$CURRENT_HASH" ]]; then
    echo "[codex-agent] Plugin updated, reinstalling CLI..."

    if is_windows; then
        # Windows: use PowerShell to run install script
        powershell -ExecutionPolicy Bypass -File "$PLUGIN_ROOT/install.ps1" 2>&1
    else
        # Unix: run bash install script
        "$PLUGIN_ROOT/install.sh" 2>&1
    fi

    if [[ $? -eq 0 ]]; then
        echo "[codex-agent] CLI auto-updated successfully"
    else
        echo "[codex-agent] CLI auto-update failed - run install script manually" >&2
    fi
fi

exit 0
