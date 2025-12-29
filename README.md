# Extension Manager

Verwalte installierte Extensions in der Arduino IDE 2.x

## Features

- 📦 **Extension-Liste**: Zeigt alle installierten Extensions mit Status (Aktiviert/Deaktiviert)
- ✅ **Enable/Disable**: Extensions aktivieren und deaktivieren ohne Neuinstallation
- 🗑️ **Uninstall**: Extensions komplett deinstallieren
- ℹ️ **Info-Panel**: Detaillierte Informationen zu jeder Extension
- 📥 **Install**: .vsix Dateien direkt hochladen und installieren

## Installation

1. Download der `.vsix` Datei
2. In Arduino IDE 2.x: Extension Manager installieren
3. Nach Installation erscheint das Extension Manager Icon in der Activity Bar

## Verwendung

### Extension-Liste

Klicke auf das Extension Manager Icon in der Activity Bar um alle installierten Extensions zu sehen.

### Extension aktivieren/deaktivieren

- **Deaktivieren**: Klicke auf das ❌ Icon neben einer aktivierten Extension
- **Aktivieren**: Klicke auf das ✓ Icon neben einer deaktivierten Extension
- Nach Änderungen ist ein **IDE-Neustart erforderlich**

### Extension-Info anzeigen

Klicke auf eine Extension in der Liste um detaillierte Informationen anzuzeigen:
- Name und Version
- Publisher
- Beschreibung
- Status
- Speicherort
- Größe

### Extension deinstallieren

1. Klicke auf das 🗑️ Icon neben der Extension
2. Bestätige die Deinstallation
3. Die Extension wird komplett entfernt (.vsix und deployedPlugins)

### Extension installieren

1. Klicke auf das ⬇️ Icon in der Toolbar
2. Wähle eine `.vsix` Datei aus
3. Die Extension wird installiert
4. Starte die IDE neu

## Technische Details

### Verzeichnis-Struktur

- **Extensions**: `~/.arduinoIDE/extensions/` (.vsix Dateien)
- **Deployed**: `~/.arduinoIDE/deployedPlugins/` (Aktive Extensions)
- **Disabled**: `~/.extensionmanager/disabled/` (Deaktivierte Extensions)

### Enable/Disable Mechanismus

- **Disable**: Verschiebt Extension von `deployedPlugins/` nach `.extensionmanager/disabled/`
- **Enable**: Verschiebt Extension zurück nach `deployedPlugins/`
- Keine Daten gehen verloren
- IDE-Neustart erforderlich

### Selbstschutz

Der Extension Manager kann sich nicht selbst deaktivieren oder deinstallieren.

## Plattform-Unterstützung

- ✅ Windows
- ✅ Linux
- ✅ macOS

## Lizenz

Apache 2.0

## Autor

Monster Maker

---

**Hinweis**: Diese Extension ist speziell für die Arduino IDE 2.x entwickelt und nutzt die VS Code Extension API.
