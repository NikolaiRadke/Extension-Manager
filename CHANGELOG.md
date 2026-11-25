# Changelog
## 2.0.1 25.11.2026

## Bugfixes
Sketches used with version 1.x showed no icon in the activity bar, because the IDE restored their old layout. The Extension Manager now opens its sidebar once per sketch, which brings the icon back
Leftover marker files of version 1.x are removed

## 2.0.0 17.11.2026

## Features
New look like the extensions view in VS Code: own icon in the activity bar instead of the Explorer
Extension list with icons, descriptions, search field, and groups (updates, waiting for restart, enabled, disabled)
Detail page with README, changelog, installation details, and repository link
Update check via GitHub releases: on startup (setting `extensionManager.checkUpdatesOnStartup`) or with the toolbar button, one-click update with security scan
Menu and button texts translated (en, de, es, fr, it)

## Bugfixes
Uninstalling from the info panel skipped the second confirmation of uninstall.json
Info button in the list always reported "Extension not found"

## 1.1.0 14.11.2026

## Features
uninstall.json: {tmp} placeholder for the temp folder, * in the last part of a path, second confirmation with the list of files and folders (`"confirm": {"double": true}`)

## Bugfixes
{arduinoIDE} was wrong on Windows (also for globalState)
Settings with different prefixes were not all cleared
uninstall.json can no longer delete outside the home and temp folder or folders the IDE needs

## 1.0.1 14.01.2026

## Features
Added check for UNINSTALL.js

## Bugfixes
Fixed a wrong .vsix file when reinstalling an extension


