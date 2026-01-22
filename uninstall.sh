#!/bin/bash
set -e

SKILL_DEST="$HOME/.claude/commands/codex-agent.md"
BIN_DEST="/usr/local/bin/codex-agent"

echo "Uninstalling codex-orchestrator..."

# Remove CLI
if [ -L "$BIN_DEST" ] || [ -f "$BIN_DEST" ]; then
    echo "Removing $BIN_DEST..."
    if [ -w /usr/local/bin ]; then
        rm -f "$BIN_DEST"
    else
        sudo rm -f "$BIN_DEST"
    fi
fi

# Remove Claude skill
if [ -f "$SKILL_DEST" ]; then
    echo "Removing $SKILL_DEST..."
    rm -f "$SKILL_DEST"
fi

echo ""
echo "Uninstalled successfully."
echo "Note: Dependencies (bun, tmux, codex) were not removed."
