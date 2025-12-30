![Extension Manager](http://www.nikolairadke.de/aiduino/extensionmanager_banner.png)
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

You need the VSIX file *arduinoplus.vsix* in the same folder with the installer. The installer will install the plugin in your home folder. 
  
#### Windows
Run ``` install_arduinoplus_windows.bat ``` as administrator

#### Linux
```
chmod +x install_arduinoplus_linux.sh
./install_arduinoplus_install_linux.sh
```

#### macOS
```
chmod +x install_arduinoplus_macos.sh
./install_arduinoplus_Install_macos.sh
```

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

## Known Limitations

- Changes require an IDE restart to take effect
- On first run, Extension Manager automatically opens the Explorer view to make itself visible

## Uninstall

Use the **About** panel (ℹ️ button in toolbar) and click the "Uninstall" button in the Danger Zone. This will:
- Remove Extension Manager itself
- Delete all settings and data in `~/.extensionmanager/`
- Clean up all related files
- Restart the IDE to complete uninstallation

## Related Projects
  
- **[Arduino+](https://github.com/NikolaiRadke/Arduinoplus)** - Essential IDE helpers for Arduino development.

## Contributing

Bug reports and feature requests are welcome! Please use the GitHub Issues page.

## 💙 Support Extension Manager

Extension Manager is free and open source. If it saved your day, consider buying me a coffee! ☕

[![GitHub Sponsors](https://img.shields.io/github/sponsors/NikolaiRadke?style=for-the-badge&logo=github&color=ea4aaa)](https://github.com/sponsors/NikolaiRadke)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy%20me%20a%20coffee-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/nikolairadke)

Every contribution helps keep this project alive! 🚀

