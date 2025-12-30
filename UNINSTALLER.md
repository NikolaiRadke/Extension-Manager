# uninstall.json Specification

Extension Manager supports declarative uninstall configurations through an `uninstall.json` file. This allows extensions to define exactly what should be cleaned up when they are uninstalled.

## Overview

When Extension Manager uninstalls an extension, it checks for an `uninstall.json` file in the extension's deployed directory. If found, Extension Manager will:

1. Delete all specified directories
2. Delete all specified files
3. Remove global state entries
4. Clear VS Code configuration settings
5. Perform standard cleanup (remove .vsix, deployed directory, etc.)

Extensions with `uninstall.json` are marked with "Uninstaller: ✓ Available" in the Extension Manager interface.

## File Location

Place `uninstall.json` in the **root directory** of your extension (same level as `package.json`):

```
your-extension/
├── package.json
├── uninstall.json          ← Here!
├── README.md
├── out/
└── ...
```

## Format

```json
{
  "name": "Extension Name",
  "version": "1.0.0",
  "directories": [
    "~/.myextension",
    "{home}/.myextension-cache"
  ],
  "files": [
    "{arduinoIDE}/extensions/myextension.vsix",
    "{arduinoIDE}/deployedPlugins/myextension"
  ],
  "globalState": [
    "publisher.extensionname"
  ],
  "settings": [
    "myextension.setting1",
    "myextension.setting2",
    "myextension.apiKey"
  ],
  "confirm": {
    "enabled": true,
    "double": false
  }
}
```

## Fields

### `name` (optional)
- **Type:** String
- **Description:** Extension name for documentation purposes
- **Example:** `"AI.duino"`

### `version` (optional)
- **Type:** String
- **Description:** Version of the uninstall configuration
- **Example:** `"1.0.0"`

### `directories` (optional)
- **Type:** Array of strings
- **Description:** Directories to delete recursively
- **Placeholders:** Supports `~`, `{home}`, `{arduinoIDE}`
- **Example:**
  ```json
  "directories": [
    "~/.myextension",
    "{home}/.myextension-data"
  ]
  ```

### `files` (optional)
- **Type:** Array of strings
- **Description:** Files or directories to delete
- **Placeholders:** Supports `~`, `{home}`, `{arduinoIDE}`
- **Note:** Can be both files and directories
- **Example:**
  ```json
  "files": [
    "{arduinoIDE}/extensions/myext.vsix",
    "{arduinoIDE}/deployedPlugins/myext"
  ]
  ```

### `globalState` (optional)
- **Type:** Array of strings
- **Description:** Keys to remove from Arduino IDE's `global-state.json`
- **Location:** Typically in `{arduinoIDE}/plugin-storage/global-state.json`
- **Example:**
  ```json
  "globalState": [
    "publisher.extensionname"
  ]
  ```

### `settings` (optional)
- **Type:** Array of strings
- **Description:** VS Code configuration keys to remove
- **Scope:** Removes from both Global and Workspace settings
- **Format:** `prefix.settingName`
- **Example:**
  ```json
  "settings": [
    "myext.apiKey",
    "myext.language",
    "myext.maxTokens"
  ]
  ```

### `confirm` (optional)
- **Type:** Object
- **Description:** Confirmation dialog settings
- **Fields:**
  - `enabled` (boolean): Show confirmation dialog (default: `true`)
  - `double` (boolean): Require double confirmation (default: `false`)
- **Example:**
  ```json
  "confirm": {
    "enabled": true,
    "double": true
  }
  ```

## Placeholders

The following placeholders are automatically resolved:

| Placeholder | Resolves To | Example |
|------------|-------------|---------|
| `~` | Home directory | `/home/user` |
| `{home}` | Home directory | `/home/user` |
| `{arduinoIDE}` | Arduino IDE config directory | Platform-specific (see below) |

### Arduino IDE Directory (Platform-Specific)

| Platform | Path |
|----------|------|
| **Linux** | `~/.arduinoIDE` |
| **macOS** | `~/Library/Application Support/Arduino IDE` |
| **Windows** | `%APPDATA%\Arduino IDE` |

## Complete Example

Here's a complete `uninstall.json` for a complete hypothetical extension:

```json
{
  "name": "AI.duino",
  "version": "2.5.0",
  "directories": [
    "~/.aiduino"
  ],
  "files": [
    "{arduinoIDE}/extensions/aiduino.vsix",
    "{arduinoIDE}/deployedPlugins/aiduino"
  ],
  "globalState": [
    "monstermaker.aiduino"
  ],
  "settings": [
    "aiduino.language",
    "aiduino.defaultModel",
    "aiduino.temperature",
    "aiduino.maxTokens",
    "aiduino.apiKey"
  ],
  "confirm": {
    "enabled": true,
    "double": true
  }
}
```

This configuration will:
1. Delete `~/.aiduino/` directory
2. Delete the extension's .vsix file and deployed directory
3. Remove `monstermaker.aiduino` from global-state.json
4. Clear all `aiduino.*` settings from VS Code configuration
5. Show double confirmation dialog before deletion

## Best Practices

### 1. Be Specific
List all directories and files your extension creates:
```json
"directories": [
  "~/.myext",
  "~/.myext-cache",
  "~/.myext-temp"
]
```

### 2. Include All Settings
List every configuration key your extension uses:
```json
"settings": [
  "myext.apiKey",
  "myext.language",
  "myext.theme",
  "myext.advanced.option1",
  "myext.advanced.option2"
]
```

### 3. Use Double Confirmation for Destructive Actions
If your extension stores important user data:
```json
"confirm": {
  "enabled": true,
  "double": true
}
```

### 4. Test Your Configuration
1. Install your extension
2. Use it to create configuration files
3. Uninstall via Extension Manager
4. Verify all files are deleted

### 5. Document What Gets Deleted
In your extension's README, list what `uninstall.json` will delete:

```markdown
## Uninstallation

Uninstalling via Extension Manager will remove:
- Configuration directory: `~/.myext/`
- All VS Code settings: `myext.*`
- Cached data in Arduino IDE
```

## Implementation in Your Extension

If your extension has its own uninstaller module, you can also use `uninstall.json`:

```javascript
// Load and parse uninstall.json
const config = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'uninstall.json'), 
    'utf8'
  )
);

// Process directories
for (const dir of config.directories) {
  const resolved = dir.replace('~', os.homedir());
  if (fs.existsSync(resolved)) {
    fs.rmSync(resolved, { recursive: true });
  }
}

// Clear settings
for (const setting of config.settings) {
  const [prefix, ...rest] = setting.split('.');
  const key = rest.join('.');
  await vscode.workspace.getConfiguration(prefix)
    .update(key, undefined, vscode.ConfigurationTarget.Global);
}
```

## Error Handling

Extension Manager handles errors gracefully:

- **File not found:** Silently skips (already deleted or never created)
- **Permission denied:** Reports error but continues with other items
- **Invalid JSON:** Falls back to standard uninstall (no extended cleanup)

## Migration from Hardcoded Uninstaller

If your extension has a hardcoded uninstaller:

1. **Create `uninstall.json`** with all paths and settings
2. **Update your uninstaller code** to read from JSON
3. **Test both methods** (your uninstaller + Extension Manager)
4. **Document in README** that Extension Manager provides complete cleanup

## Support

- **Extension Manager:** https://github.com/NikolaiRadke/Extension-Manager
- **Issues:** https://github.com/NikolaiRadke/Extension-Manager/issues
- **Examples:** See [AI.duino's uninstall.json](https://github.com/NikolaiRadke/AI.duino/blob/main/uninstall.json)
