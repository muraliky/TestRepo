#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "==============================================================================="
echo "   SELENIUM TO PLAYWRIGHT + CUCUMBER MIGRATION TOOLKIT"
echo "   Setup Wizard"
echo "==============================================================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Node.js is not installed."
    echo "        Please install Node.js 18+ from https://nodejs.org"
    echo ""
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}[OK]${NC} Node.js $NODE_VERSION detected"
echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 1: Ask for source Java repo path
# ═══════════════════════════════════════════════════════════════

echo "───────────────────────────────────────────────────────────────"
echo " STEP 1: Source Repository"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo " Enter the full path to your Java Selenium repository."
echo " This is the folder containing your pages, steps, features, etc."
echo ""
echo " Examples:"
echo "   /home/user/projects/my-selenium-tests"
echo "   ~/automation/wim-automation"
echo ""

read -p "  Source repo path: " SOURCE_PATH

# Expand ~ to home directory
SOURCE_PATH="${SOURCE_PATH/#\~/$HOME}"

# Remove trailing slash
SOURCE_PATH="${SOURCE_PATH%/}"

# Check if path exists
if [ ! -d "$SOURCE_PATH" ]; then
    echo ""
    echo -e "${RED}[ERROR]${NC} Path does not exist: $SOURCE_PATH"
    echo ""
    exit 1
fi

# Check if it looks like a Java project
if [ -f "$SOURCE_PATH/pom.xml" ]; then
    echo -e "${GREEN}[OK]${NC} Maven project detected (pom.xml found)"
elif [ -f "$SOURCE_PATH/build.gradle" ]; then
    echo -e "${GREEN}[OK]${NC} Gradle project detected (build.gradle found)"
elif [ -d "$SOURCE_PATH/src" ]; then
    echo -e "${GREEN}[OK]${NC} Source folder detected"
else
    echo -e "${YELLOW}[WARN]${NC} No pom.xml, build.gradle, or src folder found."
    echo "       Make sure this is the correct repository."
    echo ""
    read -p "  Continue anyway? (y/n): " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 2: Copy source repo to _source-java
# ═══════════════════════════════════════════════════════════════

echo "───────────────────────────────────────────────────────────────"
echo " STEP 2: Copying Source Repository"
echo "───────────────────────────────────────────────────────────────"
echo ""

# Check if _source-java already has content
FILE_COUNT=$(find "_source-java" -type f 2>/dev/null | wc -l)

if [ "$FILE_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}[WARN]${NC} _source-java folder already contains $FILE_COUNT files."
    echo ""
    read -p "  Overwrite existing files? (y/n): " OVERWRITE
    if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
        echo " Skipping copy. Using existing source files."
    else
        echo ""
        echo " Clearing existing files..."
        rm -rf "_source-java"
        mkdir -p "_source-java"
        
        echo " Copying from: $SOURCE_PATH"
        echo " Copying to:   $(pwd)/_source-java"
        echo ""
        echo " This may take a moment..."
        echo ""
        
        # Copy excluding common unnecessary folders
        rsync -av --progress \
            --exclude 'node_modules' \
            --exclude '.git' \
            --exclude 'target' \
            --exclude 'build' \
            --exclude '.idea' \
            --exclude '.vscode' \
            --exclude 'out' \
            --exclude '.gradle' \
            "$SOURCE_PATH/" "_source-java/"
        
        echo ""
        echo -e "${GREEN}[OK]${NC} Source repository copied successfully!"
    fi
else
    mkdir -p "_source-java"
    
    echo " Copying from: $SOURCE_PATH"
    echo " Copying to:   $(pwd)/_source-java"
    echo ""
    echo " This may take a moment..."
    echo ""
    
    # Copy excluding common unnecessary folders
    if command -v rsync &> /dev/null; then
        rsync -av --progress \
            --exclude 'node_modules' \
            --exclude '.git' \
            --exclude 'target' \
            --exclude 'build' \
            --exclude '.idea' \
            --exclude '.vscode' \
            --exclude 'out' \
            --exclude '.gradle' \
            "$SOURCE_PATH/" "_source-java/"
    else
        # Fallback to cp if rsync not available
        cp -R "$SOURCE_PATH"/* "_source-java/"
    fi
    
    echo ""
    echo -e "${GREEN}[OK]${NC} Source repository copied successfully!"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 3: Setup GitHub Copilot Agents
# ═══════════════════════════════════════════════════════════════

echo "───────────────────────────────────────────────────────────────"
echo " STEP 3: Setting Up GitHub Copilot Agents"
echo "───────────────────────────────────────────────────────────────"
echo ""

# Create .github folders if they don't exist
mkdir -p ".github/agents"
mkdir -p ".github/copilot/agents"

# Copy agents from agents folder to .github locations
echo " Copying agents to .github/agents..."
cp -f agents/*.md .github/agents/ 2>/dev/null

echo " Copying agents to .github/copilot/agents..."
cp -f agents/*.md .github/copilot/agents/ 2>/dev/null

echo ""
echo -e "${GREEN}[OK]${NC} Agents installed:"
echo "     - @pw-orchestrator (main conversion workflow)"
echo "     - @pw-migrate (manual file conversion)"
echo "     - @pw-verify (verification helper)"
echo "     - @pw-debug (debugging helper)"
echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 4: Install Dependencies
# ═══════════════════════════════════════════════════════════════

echo "───────────────────────────────────────────────────────────────"
echo " STEP 4: Installing Dependencies"
echo "───────────────────────────────────────────────────────────────"
echo ""

if [ -d "node_modules" ]; then
    echo -e "${GREEN}[OK]${NC} Dependencies already installed."
    read -p "  Reinstall dependencies? (y/n): " REINSTALL
    if [[ "$REINSTALL" =~ ^[Yy]$ ]]; then
        echo ""
        echo " Installing npm packages..."
        npm install
    fi
else
    echo " Installing npm packages..."
    npm install
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 5: Install Playwright Browsers
# ═══════════════════════════════════════════════════════════════

echo "───────────────────────────────────────────────────────────────"
echo " STEP 5: Installing Playwright Browsers"
echo "───────────────────────────────────────────────────────────────"
echo ""

read -p "  Install Playwright browsers (Chromium)? (y/n): " INSTALL_BROWSERS
if [[ "$INSTALL_BROWSERS" =~ ^[Yy]$ ]]; then
    echo ""
    echo " Installing Chromium browser..."
    npx playwright install chromium
    echo ""
    echo -e "${GREEN}[OK]${NC} Playwright browsers installed."
else
    echo " Skipping browser installation."
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 6: Generate Skeletons
# ═══════════════════════════════════════════════════════════════

echo "───────────────────────────────────────────────────────────────"
echo " STEP 6: Generate TypeScript Skeletons"
echo "───────────────────────────────────────────────────────────────"
echo ""

read -p "  Generate skeleton files now? (y/n): " GENERATE
if [[ "$GENERATE" =~ ^[Yy]$ ]]; then
    echo ""
    npm run migrate
    echo ""
else
    echo " Skipping skeleton generation."
    echo " Run 'npm run migrate' when ready."
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# DONE!
# ═══════════════════════════════════════════════════════════════

echo "==============================================================================="
echo "   SETUP COMPLETE!"
echo "==============================================================================="
echo ""
echo " Next Steps:"
echo " ───────────────────────────────────────────────────────────────"
echo ""
echo " 1. Open this folder in VS Code"
echo ""
echo " 2. Start conversion with GitHub Copilot:"
echo "    @pw-orchestrator start"
echo ""
echo " 3. After all files are converted:"
echo "    npm run auth:setup     (if login is required)"
echo "    npm test               (run all tests)"
echo ""
echo " Useful Commands:"
echo " ───────────────────────────────────────────────────────────────"
echo "   npm run migrate        - Regenerate skeletons"
echo "   npm run migrate:status - Check progress"
echo "   npm run verify         - Run verification on all files"
echo "   npm test               - Run Cucumber tests"
echo "   npm run test:headed    - Run with visible browser"
echo ""
echo "==============================================================================="
echo ""
