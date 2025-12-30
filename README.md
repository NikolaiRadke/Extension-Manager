# Extension Manager

Manage installed extensions in Arduino IDE 2.x - enable, disable, install, and uninstall extensions directly from the IDE.

## Features

- 📦 **View all installed extensions** with status (enabled/disabled)
- ✅ **Enable/Disable extensions** - moves extensions between active and disabled state
- 🗑️ **Uninstall extensions** completely (removes .vsix files and all data)
- 📥 **Install extensions** from .vsix files with automatic upgrade detection
- ℹ️ **Extension details** - view version, publisher, size, and location in a dedicated panel
- 🌍 **Automatic language detection** (English/German) based on IDE settings
- 🎯 **Clean interface** - integrated into Explorer sidebar, no cluttered Activity Bar
  
## Screenshot
![Extension Manager](http://www.nikolairadke.de/aiduino/extensionmanager_screenshot.png)

## Installation

### Via VSIX File
1. Download the latest `.vsix` file from [Releases](https://github.com/NikolaiRadke/Extension-Manager/releases)
2. In Arduino IDE, open the Extensions view (Files icon in sidebar)
3. Click the download icon and select the .vsix file
4. Restart the IDE

### Via Installer Scripts
- **Linux/macOS**: `./install_extensionmanager_[linux|macos].sh`
- **Windows**: `install_extensionmanager_windows.bat`

## Usage

1. Open the **Explorer** view (Files icon in left sidebar, or Ctrl+Shift+E)
2. Find **Extension Manager** section below your sketch files
3. View all installed extensions with their status (✓ enabled / ⊘ disabled)
4. Click on any extension to:
   - Enable/Disable (moves .vsix files accordingly)
   - View detailed information
   - Uninstall completely
5. Use the toolbar buttons:
   - 🔄 **Refresh** extension list
   - 📥 **Install** new extensions from .vsix files
   - ℹ️ **About** Extension Manager

### Installing Extensions
- If you install a .vsix file that already exists, you'll be asked if you want to replace it
- The extension is installed to `~/.arduinoIDE/extensions/`
- Restart the IDE to activate newly installed extensions

### Enabling/Disabling Extensions
- **Disable**: Moves the extension from `deployedPlugins/` to `.extensionmanager/disabled/`
- **Enable**: Moves it back to make it active again
- The .vsix file is also moved to prevent automatic re-deployment
- Requires IDE restart to take effect

## Requirements

- Arduino IDE 2.x (tested with 2.3.x and later)
- Extensions are managed in `~/.arduinoIDE/`

## Known Limitations

- Changes require an IDE restart to take effect
- On first run, Extension Manager automatically opens the Explorer view to make itself visible

## File Locations

- **Installed extensions**: `~/.arduinoIDE/extensions/` (.vsix files)
- **Active extensions**: `~/.arduinoIDE/deployedPlugins/` (deployed)
- **Disabled extensions**: `~/.extensionmanager/disabled/` (inactive)
- **Settings marker**: `~/.extensionmanager/.first-run-done`

## Uninstall

Use the **About** panel (ℹ️ button in toolbar) and click the "Uninstall" button in the Danger Zone. This will:
- Remove Extension Manager itself
- Delete all settings and data in `~/.extensionmanager/`
- Clean up all related files
- Restart the IDE to complete uninstallation

## Contributing

Bug reports and feature requests are welcome! Please use the GitHub Issues page.
