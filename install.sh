#!/bin/bash
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_SOURCE="$REPO_DIR/.claude/skills/codex-agent"
SKILL_DEST="$HOME/.claude/skills/codex-agent"
BIN_SOURCE="$REPO_DIR/bin/codex-agent"
BIN_DEST="/usr/local/bin/codex-agent"

echo "Installing codex-orchestrator..."
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
bun install

# Install CLI globally
echo ""
echo "Installing CLI to $BIN_DEST..."
if [ -w /usr/local/bin ]; then
    ln -sf "$BIN_SOURCE" "$BIN_DEST"
else
    sudo ln -sf "$BIN_SOURCE" "$BIN_DEST"
fi

# Install Claude skill globally (folder structure)
echo "Installing Claude skill to $SKILL_DEST..."
mkdir -p "$HOME/.claude/skills"
rm -rf "$SKILL_DEST"
cp -r "$SKILL_SOURCE" "$SKILL_DEST"

echo ""
echo "Installation complete!"
echo ""
echo "Installed:"
echo "  CLI:   $BIN_DEST"
echo "  Skill: $SKILL_DEST/SKILL.md"
echo ""
echo "Usage:"
echo "  CLI:   codex-agent start \"your task\" --map"
echo "  Skill: /codex-agent in Claude Code (any repo)"
echo ""
echo "Run 'codex-agent health' to verify installation."
