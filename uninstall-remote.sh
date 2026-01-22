#!/bin/bash
# Uninstall codex-orchestrator
set -e

echo "Uninstalling codex-orchestrator..."

rm -rf "$HOME/.codex-orchestrator"
rm -f "$HOME/.local/bin/codex-agent"
rm -f "$HOME/.claude/commands/codex-agent.md"

echo ""
echo "Uninstalled:"
echo "  - ~/.codex-orchestrator/"
echo "  - ~/.local/bin/codex-agent"
echo "  - ~/.claude/commands/codex-agent.md"
echo ""
echo "Note: Job data in ~/.codex-agent/ was preserved."
echo "Run 'rm -rf ~/.codex-agent' to remove it."
