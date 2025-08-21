#!/bin/bash

# Chrome Extension Packaging Script
# This script packages the extension for Chrome Web Store submission

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
EXTENSION_DIR="$PROJECT_DIR/extension"
DIST_DIR="$PROJECT_DIR/dist"

echo -e "${BLUE}📦 Chrome Extension Packaging Script${NC}"
echo -e "${BLUE}====================================${NC}"

# Check if extension directory exists
if [ ! -d "$EXTENSION_DIR" ]; then
    echo -e "${RED}❌ Extension directory not found: $EXTENSION_DIR${NC}"
    exit 1
fi

# Create dist directory
mkdir -p "$DIST_DIR"

# Check for required files
required_files=("manifest.json" "popup.html" "popup.css" "popup.js" "background.js" "content.js")
missing_files=()

for file in "${required_files[@]}"; do
    if [ ! -f "$EXTENSION_DIR/$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required files:${NC}"
    for file in "${missing_files[@]}"; do
        echo -e "${RED}   - $file${NC}"
    done
    exit 1
fi

# Check for icon files
icon_sizes=(16 32 48 128)
missing_icons=()

for size in "${icon_sizes[@]}"; do
    icon_file="$EXTENSION_DIR/icons/icon${size}.png"
    if [ ! -f "$icon_file" ]; then
        missing_icons+=("icon${size}.png")
    fi
done

if [ ${#missing_icons[@]} -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Warning: Missing icon files:${NC}"
    for icon in "${missing_icons[@]}"; do
        echo -e "${YELLOW}   - $icon${NC}"
    done
    echo -e "${YELLOW}   Run 'python3 scripts/create-icons.py' to generate basic icons${NC}"
fi

# Get version from manifest.json
if command -v jq &> /dev/null; then
    VERSION=$(jq -r '.version' "$EXTENSION_DIR/manifest.json")
else
    VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$EXTENSION_DIR/manifest.json" | cut -d'"' -f4)
fi

if [ -z "$VERSION" ]; then
    echo -e "${YELLOW}⚠️  Could not extract version from manifest.json, using 'unknown'${NC}"
    VERSION="unknown"
fi

echo -e "${BLUE}📋 Extension Details:${NC}"
echo -e "   Name: $(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$EXTENSION_DIR/manifest.json" | cut -d'"' -f4)"
echo -e "   Version: $VERSION"
echo -e "   Manifest Version: $(grep -o '"manifest_version"[[:space:]]*:[[:space:]]*[0-9]*' "$EXTENSION_DIR/manifest.json" | grep -o '[0-9]*')"

# Create ZIP package
PACKAGE_NAME="bookmark-sync-extension-v${VERSION}"
ZIP_FILE="$DIST_DIR/${PACKAGE_NAME}.zip"

echo -e "${BLUE}📦 Creating package...${NC}"

# Remove existing package if it exists
if [ -f "$ZIP_FILE" ]; then
    rm "$ZIP_FILE"
    echo -e "${YELLOW}   Removed existing package${NC}"
fi

# Create ZIP file
cd "$EXTENSION_DIR"

# Files to exclude from the package
EXCLUDE_PATTERNS=(
    "*.DS_Store*"
    "*.git*"
    "*node_modules*"
    "*.log"
    "*Thumbs.db*"
    "*.tmp"
    "*.temp"
)

# Build exclude arguments for zip
EXCLUDE_ARGS=()
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    EXCLUDE_ARGS+=("-x" "$pattern")
done

# Create the ZIP file
zip -r "$ZIP_FILE" . "${EXCLUDE_ARGS[@]}" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Package created successfully!${NC}"
    echo -e "${GREEN}   File: $ZIP_FILE${NC}"
    echo -e "${GREEN}   Size: $(du -h "$ZIP_FILE" | cut -f1)${NC}"
else
    echo -e "${RED}❌ Failed to create package${NC}"
    exit 1
fi

# Validate the ZIP file
echo -e "${BLUE}🔍 Validating package...${NC}"

# Check if manifest.json is in the root of the ZIP
if unzip -l "$ZIP_FILE" | grep -q "manifest.json"; then
    echo -e "${GREEN}   ✅ manifest.json found${NC}"
else
    echo -e "${RED}   ❌ manifest.json not found in package root${NC}"
    exit 1
fi

# Check package size (Chrome Web Store has a 128MB limit)
SIZE_BYTES=$(stat -f%z "$ZIP_FILE" 2>/dev/null || stat -c%s "$ZIP_FILE" 2>/dev/null)
SIZE_MB=$((SIZE_BYTES / 1024 / 1024))

if [ $SIZE_MB -lt 128 ]; then
    echo -e "${GREEN}   ✅ Package size OK (${SIZE_MB}MB < 128MB limit)${NC}"
else
    echo -e "${RED}   ❌ Package too large (${SIZE_MB}MB >= 128MB limit)${NC}"
    echo -e "${RED}       Consider removing unnecessary files${NC}"
fi

# List package contents
echo -e "${BLUE}📁 Package contents:${NC}"
unzip -l "$ZIP_FILE" | grep -v "Archive:" | grep -v "Length" | grep -v "Name" | grep -v "---" | head -20

if [ $(unzip -l "$ZIP_FILE" | grep -v "Archive:" | grep -v "Length" | grep -v "Name" | grep -v "---" | wc -l) -gt 20 ]; then
    echo -e "${YELLOW}   ... and more files${NC}"
fi

echo -e "${GREEN}🎉 Extension packaging completed!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Review the package contents above"
echo -e "2. Test the extension locally in Chrome (Developer Mode)"
echo -e "3. Go to Chrome Web Store Developer Console:"
echo -e "   ${BLUE}https://chrome.google.com/webstore/devconsole${NC}"
echo -e "4. Click 'Add new item' and upload: ${GREEN}$ZIP_FILE${NC}"
echo -e "5. Fill out the store listing information"
echo -e "6. Submit for review"
echo ""
echo -e "${YELLOW}📝 Don't forget to:${NC}"
echo -e "   - Create a privacy policy (privacy-policy.md template provided)"
echo -e "   - Take screenshots of your extension"
echo -e "   - Write a compelling description"
echo -e "   - Set appropriate category (Productivity)"

# Optional: Open dist directory
if command -v open &> /dev/null; then
    echo -e "${BLUE}📂 Opening dist directory...${NC}"
    open "$DIST_DIR"
elif command -v xdg-open &> /dev/null; then
    echo -e "${BLUE}📂 Opening dist directory...${NC}"
    xdg-open "$DIST_DIR"
fi
