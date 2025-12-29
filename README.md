# Extension Manager

Manage installed extensions in Arduino IDE 2.x - enable, disable, install, and uninstall extensions directly from the IDE.

## Features

- 📦 **View all installed extensions** with status (enabled/disabled)
- ✅ **Enable/Disable extensions** without manual file operations
- 🗑️ **Uninstall extensions** completely (including .vsix files)
- 📥 **Install extensions** from .vsix files
- ℹ️ **Extension details** - view version, publisher, size, and location
- 🌍 **Automatic language detection** (English/German)
- 🎯 **Clean interface** - integrated into Activity Bar

## Installation

### Via VSIX File
1. Download the latest `.vsix` file from [Releases](https://github.com/NikolaiRadke/Extension-Manager/releases)
2. Install via Extension Manager's "Install Extension (.vsix)" button
3. Or use the provided installer script for your platform

### Via Installer Scripts
- **Linux/macOS**: `./install_extensionmanager_[linux|macos].sh`
- **Windows**: `install_extensionmanager_windows.bat`

## Usage

1. Click the Extension Manager icon in the Activity Bar (left sidebar)
2. View all installed extensions with their status
3. Click on any extension to:
   - Enable/Disable
   - View detailed information
   - Uninstall
4. Use the toolbar buttons to:
   - 🔄 Refresh extension list
   - 📥 Install new extensions
   - ℹ️ About Extension Manager

## Requirements

- Arduino IDE 2.x
- Extensions are managed in `~/.arduinoIDE/extensions/`

## Known Issues

- A menu entry "Extension Manager" appears in the IDE menu bar - **do not click it** (it toggles the extension off/on). This is a limitation of the Arduino IDE's extension system.
- Changes require an IDE restart to take effect

## Uninstall

Use the "About" panel (ℹ️ button) and click the "Uninstall" button. This will:
- Remove the Extension Manager
- Delete all settings in `~/.extensionmanager/`
- Clean up all related files

## License

Apache License 2.0

## Author

Monster Maker

## Links

- GitHub: https://github.com/NikolaiRadke/Extension-Manager
- Issues: https://github.com/NikolaiRadke/Extension-Manager/issues
