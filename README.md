![Extension Manager](https://www.nikolairadke.de/aiduino/extensionmanager_banner.png)
# Extension Manager

Manage installed extensions in Arduino IDE 2.x - enable, disable, install, update, and uninstall extensions directly from the IDE. It looks and works like the extensions view in VS Code.

## Features

- 🧩 **Own view in the sidebar** - with its own icon in the activity bar, just like in VS Code
- 📦 **View all installed extensions** with icon, description, and status, grouped and searchable
- ✅ **Enable/Disable extensions** - moves extensions between active and disabled state
- 🗑️ **Uninstall extensions** completely (removes .vsix files and all data)
- 📥 **Install extensions** from .vsix files with automatic upgrade detection
- 🔒 **Security scanning** - analyzes extensions before installation for suspicious code patterns
- ⬆️ **Updates** - checks GitHub releases for newer versions and updates with one click
- ℹ️ **Extension details** - detail page with README, changelog, version, size, and location
- 🌍 **Automatic language detection** based on IDE settings. Support are: **en, es, de, fr, it**. 
  
## Screenshot
![Extension Manager](https://www.nikolairadke.de/aiduino/extensionmanager_screenshot_4.png)

## Installation

You need the VSIX file **extension-manager-X.X.X.vsix** in the same folder with the installer. The installer will install the plugin in your home folder. 
  
#### Windows
Run ``` install_extensionmanager_windows.bat ``` as administrator

#### Linux
```
chmod +x install_extensionmanager_linux.sh
./install_extensionmanager_linux.sh
```

#### macOS
```
chmod +x install_extensionmanager_macos.sh
./install_extensionmanager_macos.sh
```

## Usage

1. Click the **Extension Manager** icon in the activity bar on the left
2. All installed extensions are listed in groups: **Updates available**, **Waiting for restart**, **Enabled**, and **Disabled**
3. Use the search field to filter by name, publisher, or description
4. Hover over an extension to enable, disable, or uninstall it
5. Click on an extension to open its detail page with README, changelog, and installation details
6. Use the toolbar buttons:
   - 🔄 **Check for updates**
   - 🔃 **Refresh** extension list
   - 📥 **Install** new extensions from .vsix files
   - ℹ️ **About** Extension Manager

### Installing Extensions
- When installing a .vsix file, Extension Manager scans it for security issues (eval usage, file access, network requests, etc.)
- The security scan shows severity levels (🚨 Critical | ⚠️ High | ⚡ Medium | ℹ️ Low) and details about permissions the extension requires
- If you install a .vsix file that already exists, you'll be asked if you want to replace it
- The extension is installed to `~/.arduinoIDE/extensions/`
- Restart the IDE to activate newly installed extensions

### Updating Extensions
- Extension Manager checks for updates a few seconds after the IDE starts. You can turn this off in the settings (`extensionManager.checkUpdatesOnStartup`)
- Click the 🔄 button in the toolbar to check manually
- Extensions with an update are shown in **Updates available**, and the icon in the activity bar shows their number
- **Update** downloads the new .vsix file and runs the same security scan as a normal installation
- Results are cached for 6 hours, because GitHub allows only 60 requests per hour without login

**For extension developers:** Your extension can be updated if
1. the `repository` field in its `package.json` points to a GitHub repository, and
2. the latest release (not a pre-release) has a tag with the version number (e.g. `v1.2.0`) and a `.vsix` file attached.

### Enabling/Disabling Extensions
- **Disable**: Moves the extension from `deployedPlugins/` to `.extensionmanager/disabled/`
- **Enable**: Moves it back to make it active again
- The .vsix file is also moved to prevent automatic re-deployment
- Requires IDE restart to take effect

## Known Limitations

- Changes require an IDE restart to take effect
- The update check only works for extensions with a GitHub repository and a .vsix file in their releases
- After updating from version 1.1.0 or older, sketches you opened before may still show the old list in the Explorer. Open a new sketch, or reset the layout with **Ctrl+Shift+P** → *Reset Workbench Layout*

## Advanced: uninstall.json Support

Extension Manager supports declarative uninstall configurations. Extensions can include an `uninstall.json` file to define what should be deleted during uninstallation:

- Configuration directories (e.g., `~/.myextension`)
- Settings files
- VS Code configuration keys
- Global state entries

When an extension includes `uninstall.json`, Extension Manager shows "Uninstaller: ✓ Available" in the extension details and performs a complete cleanup on uninstall.

**For extension developers:** See [UNINSTALLER.md](https://github.com/NikolaiRadke/Extension-Manager/blob/main/UNINSTALLER.md) for the full specification.

## Uninstall

Use the **About** panel (ℹ️ button in toolbar) and click the "Uninstall" button in the Danger Zone. This will:
- Remove Extension Manager itself
- Delete all settings and data in `~/.extensionmanager/`
- Clean up all related files
- Restart the IDE to complete uninstallation

## Tested Extensions

See this [list](https://github.com/NikolaiRadke/Extension-Manager/blob/main/TESTED_EXTENSIONS.md).  
  
## Related Projects

- **[AI.duino](https://github.com/NikolaiRadke/AI.duino)** - AI-powered assistance for Arduino IDE.
- **[Arduino+](https://github.com/NikolaiRadke/Arduinoplus)** - Essential IDE helpers for Arduino development.

## Contributing

Bug reports and feature requests are welcome! Please use the GitHub Issues page.

## 💙 Support Extension Manager

Extension Manager is free and open source. If it saved your day, consider buying me a coffee! ☕

[![GitHub Sponsors](https://img.shields.io/github/sponsors/NikolaiRadke?style=for-the-badge&logo=github&color=ea4aaa)](https://github.com/sponsors/NikolaiRadke)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy%20me%20a%20coffee-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/nikolairadke)

Every contribution helps keep this project alive! 🚀
