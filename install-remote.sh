#!/bin/bash
# One-liner install for codex-orchestrator
# Usage: curl -fsSL https://raw.githubusercontent.com/fciaf420/codex-orchestrator/main/install-remote.sh | bash
set -e

REPO="fciaf420/codex-orchestrator"
BRANCH="main"
INSTALL_DIR="$HOME/.codex-orchestrator"
SKILL_DIR="$HOME/.claude/skills/codex-agent"

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

# Install Claude skill (folder structure)
echo "Installing Claude Code skill..."
mkdir -p "$HOME/.claude/skills"
rm -rf "$SKILL_DIR"
cp -r "$INSTALL_DIR/.claude/skills/codex-agent" "$SKILL_DIR"

echo ""
echo "Installation complete!"
echo ""
echo "Installed:"
echo "  CLI:   ~/.local/bin/codex-agent"
echo "  Skill: ~/.claude/skills/codex-agent/SKILL.md (global)"
echo ""

# Add to PATH if needed
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo "Adding ~/.local/bin to PATH..."

    # Detect shell config file
    SHELL_CONFIG=""
    if [ -n "$ZSH_VERSION" ] || [ -f "$HOME/.zshrc" ]; then
        SHELL_CONFIG="$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
        SHELL_CONFIG="$HOME/.bashrc"
    elif [ -f "$HOME/.bash_profile" ]; then
        SHELL_CONFIG="$HOME/.bash_profile"
    fi

    if [ -n "$SHELL_CONFIG" ]; then
        # Check if already in config (avoid duplicates)
        if ! grep -q 'export PATH="\$HOME/.local/bin:\$PATH"' "$SHELL_CONFIG" 2>/dev/null; then
            echo '' >> "$SHELL_CONFIG"
            echo '# Added by codex-orchestrator' >> "$SHELL_CONFIG"
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_CONFIG"
            echo "  Added to $SHELL_CONFIG"
        else
            echo "  Already configured in $SHELL_CONFIG"
        fi
        echo ""
        echo "Restart your terminal or run: source $SHELL_CONFIG"
    else
        echo "Could not detect shell config file."
        echo "Manually add to your shell config:"
        echo '  export PATH="$HOME/.local/bin:$PATH"'
    fi
else
    echo "~/.local/bin already in PATH"
fi

echo ""
echo "Run 'codex-agent health' to verify installation."
echo ""
echo "Usage:"
echo "  CLI:   codex-agent start \"your task\" --map"
echo "  Skill: /codex-agent in Claude Code"
