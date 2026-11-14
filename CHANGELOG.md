# Changelog
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


