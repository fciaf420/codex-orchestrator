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

# Check for bun (with fallback to common install locations)
BUN_CMD=""
if command -v bun &> /dev/null; then
    BUN_CMD="bun"
    echo "  bun: $(bun --version)"
elif [ -x "$HOME/.bun/bin/bun" ]; then
    BUN_CMD="$HOME/.bun/bin/bun"
    export PATH="$HOME/.bun/bin:$PATH"
    echo "  bun: $($BUN_CMD --version) (found at ~/.bun/bin, added to PATH)"
elif [ -n "$BUN_INSTALL" ] && [ -x "$BUN_INSTALL/bin/bun" ]; then
    BUN_CMD="$BUN_INSTALL/bin/bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    echo "  bun: $($BUN_CMD --version) (found at \$BUN_INSTALL/bin, added to PATH)"
else
    echo "  bun: NOT FOUND"
    echo "  Install with: curl -fsSL https://bun.sh/install | bash"
    echo "  Then restart your terminal and try again"
    exit 1
fi

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
$BUN_CMD install --silent

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

# Create hash marker for auto-update detection
MARKER_DIR="$HOME/.codex-agent"
MARKER_FILE="$MARKER_DIR/installed-hash"
mkdir -p "$MARKER_DIR"

# Compute hash of source files
if command -v sha256sum &> /dev/null; then
    HASH=$(find "$REPO_DIR/src" -name "*.ts" -type f 2>/dev/null | sort | xargs cat 2>/dev/null | sha256sum | cut -d' ' -f1)
elif command -v shasum &> /dev/null; then
    HASH=$(find "$REPO_DIR/src" -name "*.ts" -type f 2>/dev/null | sort | xargs cat 2>/dev/null | shasum -a 256 | cut -d' ' -f1)
else
    HASH=$(date +%s)
fi
echo "$HASH" > "$MARKER_FILE"
echo "  Created update marker: $MARKER_FILE"

echo ""
echo "CLI installation complete!"
echo ""
echo "Usage:"
echo "  CLI:   codex-agent start \"your task\" --map"
echo "  Skill: /codex-agent in Claude Code (any project)"
echo ""
echo "Run 'codex-agent health' to verify installation."
