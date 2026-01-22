#!/bin/bash
# One-liner install for codex-orchestrator
# Usage: curl -fsSL https://raw.githubusercontent.com/fciaf420/codex-orchestrator/main/install-remote.sh | bash
set -e

REPO="fciaf420/codex-orchestrator"
BRANCH="main"
INSTALL_DIR="$HOME/.codex-orchestrator"
SKILL_DEST="$HOME/.claude/commands/codex-agent.md"

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

# Download and extract
echo "Downloading from GitHub..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

curl -fsSL "https://github.com/$REPO/archive/refs/heads/$BRANCH.tar.gz" | tar -xz -C "$INSTALL_DIR" --strip-components=1

# Install dependencies
echo "Installing dependencies..."
cd "$INSTALL_DIR"
bun install --silent

# Create CLI wrapper
echo "Setting up CLI..."
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/codex-agent" << 'EOF'
#!/bin/bash
bun run "$HOME/.codex-orchestrator/src/cli.ts" "$@"
EOF
chmod +x "$HOME/.local/bin/codex-agent"

# Install Claude skill
echo "Installing Claude Code skill..."
mkdir -p "$HOME/.claude/commands"
cp "$INSTALL_DIR/.claude/commands/codex-agent.md" "$SKILL_DEST"

echo ""
echo "Installation complete!"
echo ""
echo "Installed:"
echo "  CLI:   ~/.local/bin/codex-agent"
echo "  Skill: ~/.claude/commands/codex-agent.md"
echo ""

# Check PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo "ACTION REQUIRED: Add ~/.local/bin to your PATH"
    echo ""
    echo "Add this to your ~/.bashrc or ~/.zshrc:"
    echo '  export PATH="$HOME/.local/bin:$PATH"'
    echo ""
    echo "Then restart your terminal or run: source ~/.bashrc"
else
    echo "Run 'codex-agent health' to verify installation."
fi
echo ""
echo "Usage:"
echo "  CLI:   codex-agent start \"your task\" --map"
echo "  Skill: /codex-agent in Claude Code"
