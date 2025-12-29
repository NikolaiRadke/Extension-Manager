#!/bin/bash
# Extension Manager Installer

# Configuration
EXTENSIONS_DIR="$HOME/.arduinoIDE/extensions"
DEPLOYED_DIR="$HOME/.arduinoIDE/deployedPlugins"
VSIX_FILE="$(dirname "$0")/extension-manager.vsix"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${BLUE}Extension Manager Installer${NC}"
echo "================================"
echo

# Check if VSIX exists
if [ ! -f "$VSIX_FILE" ]; then
    echo -e "${RED}Error: extension-manager.vsix not found${NC}"
    exit 1
fi

# Create extensions directory
if [ ! -d "$EXTENSIONS_DIR" ]; then
    echo "Creating extensions directory..."
    mkdir -p "$EXTENSIONS_DIR"
fi

# Clean up old installations
if [ -f "$EXTENSIONS_DIR/extension-manager.vsix" ]; then
    echo -e "${YELLOW}Removing old VSIX...${NC}"
    rm -f "$EXTENSIONS_DIR/extension-manager.vsix"
fi

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
    echo "Location: $EXTENSIONS_DIR/extension-manager.vsix"
    echo
    echo "Restart Arduino IDE to use the extension."
else
    echo -e "${RED}✗ Installation failed${NC}"
fi

echo
read -p "Press Enter to continue..."
