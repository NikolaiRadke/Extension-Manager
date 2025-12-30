#!/bin/bash
# Extension Manager Installer

# Configuration
EXTENSIONS_DIR="$HOME/.arduinoIDE/extensions"
DEPLOYED_DIR="$HOME/.arduinoIDE/deployedPlugins"
SCRIPT_DIR="$(dirname "$0")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${BLUE}Extension Manager Installer${NC}"
echo "================================"
echo

# Find VSIX file (versioned or not)
VSIX_FILE=""
if [ -f "$SCRIPT_DIR/extensionmanager.vsix" ]; then
    VSIX_FILE="$SCRIPT_DIR/extensionmanager.vsix"
elif [ -f "$SCRIPT_DIR/extension-manager.vsix" ]; then
    VSIX_FILE="$SCRIPT_DIR/extension-manager.vsix"
else
    # Look for versioned VSIX (e.g., extension-manager-1.0.0.vsix)
    VSIX_FILE=$(ls "$SCRIPT_DIR"/extension-manager-*.vsix 2>/dev/null | sort -V | tail -n 1)
fi

# Check if VSIX exists
if [ -z "$VSIX_FILE" ] || [ ! -f "$VSIX_FILE" ]; then
    echo -e "${RED}Error: No extension-manager*.vsix file found${NC}"
    echo "Looking for: extension-manager.vsix or extension-manager-*.vsix"
    exit 1
fi

VSIX_FILENAME=$(basename "$VSIX_FILE")
echo "Found: $VSIX_FILENAME"
echo

# Create extensions directory
if [ ! -d "$EXTENSIONS_DIR" ]; then
    echo "Creating extensions directory..."
    mkdir -p "$EXTENSIONS_DIR"
fi

# Clean up old installations (all versions)
echo "Cleaning up old installations..."
rm -f "$EXTENSIONS_DIR"/extension-manager*.vsix 2>/dev/null
rm -f "$EXTENSIONS_DIR"/extensionmanager*.vsix 2>/dev/null
if [ -d "$DEPLOYED_DIR/extension-manager" ]; then
    echo -e "${YELLOW}Removing old deployed extension...${NC}"
    rm -rf "$DEPLOYED_DIR/extension-manager"
fi

# Copy new VSIX
echo "Installing Extension Manager..."
cp "$VSIX_FILE" "$EXTENSIONS_DIR/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Extension installed successfully!${NC}"
    echo
    echo "File: $VSIX_FILENAME"
    echo "Location: $EXTENSIONS_DIR/"
    echo
    echo "Restart Arduino IDE to use Extension Manager."
else
    echo -e "${RED}✗ Installation failed${NC}"
    exit 1
fi

echo
read -p "Press Enter to continue..."
