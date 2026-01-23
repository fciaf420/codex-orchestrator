#!/bin/bash
# Unix installer for codex-orchestrator CLI
# This script is called automatically by Claude Code plugin install
# Or run manually: ./install.sh

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_SOURCE="$REPO_DIR/bin/codex-agent"
BIN_DEST="$HOME/.local/bin/codex-agent"

echo "Installing codex-orchestrator CLI..."
echo ""

# Check dependencies
echo "Checking dependencies..."

if ! command -v bun &> /dev/null; then
    echo "Error: Bun is required but not installed."
    echo "Install with: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi
echo "  bun: OK"

if ! command -v tmux &> /dev/null; then
    echo "  tmux: NOT FOUND (required for Unix)"
    echo "  Install with: brew install tmux (macOS) or apt install tmux (Linux)"
    exit 1
fi
echo "  tmux: OK"

if ! command -v codex &> /dev/null; then
    echo "  codex: NOT FOUND"
    echo "  Install with: npm install -g @openai/codex"
    exit 1
fi
echo "  codex: OK"

echo ""

# Install npm dependencies
echo "Installing dependencies..."
cd "$REPO_DIR"
bun install --silent

# Create bin directory if needed
mkdir -p "$HOME/.local/bin"

# Install CLI
echo ""
echo "Installing CLI to $BIN_DEST..."
ln -sf "$BIN_SOURCE" "$BIN_DEST"

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo ""
    echo "NOTE: Add ~/.local/bin to your PATH by adding this to your shell rc file:"
    echo '  export PATH="$HOME/.local/bin:$PATH"'
fi

echo ""
echo "CLI installation complete!"
echo ""
echo "Usage:"
echo "  CLI:   codex-agent start \"your task\" --map"
echo "  Skill: /codex-agent in Claude Code (any project)"
echo ""
echo "Run 'codex-agent health' to verify installation."
