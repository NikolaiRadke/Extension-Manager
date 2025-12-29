/*
 * Extension Manager - About Panel
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * AboutPanel - Shows Extension Manager information and uninstall option
 */
class AboutPanel {
    constructor(t) {
        this.t = t;
        this.panel = null;
    }

    /**
     * Show about panel
     */
    async show() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'extensionManagerAbout',
                this.t('about.title'),
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: false
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = null;
            });

            this.panel.webview.onDidReceiveMessage(
                async message => {
                    if (message.command === 'uninstall') {
                        await this.handleUninstall();
                    }
                }
            );
        }

        this.panel.webview.html = this.getWebviewContent();
    }

    /**
     * Handle uninstall button click
     */
    async handleUninstall() {
        const confirm = await vscode.window.showWarningMessage(
            this.t('about.uninstallWarning'),
            { modal: true },
            this.t('about.uninstallButton')
        );

        if (confirm === this.t('about.uninstallButton')) {
            await this.uninstallSelf();
        }
    }

    /**
     * Uninstall Extension Manager itself
     */
    async uninstallSelf() {
        try {
            const homeDir = os.homedir();
            const extensionsDir = path.join(homeDir, '.arduinoIDE', 'extensions');
            const deployedDir = path.join(homeDir, '.arduinoIDE', 'deployedPlugins');
            const managerDir = path.join(homeDir, '.extensionmanager');

            // Delete .extensionmanager directory
            if (fs.existsSync(managerDir)) {
                this.deleteDirectory(managerDir);
            }

            // Delete deployed directory
            const deployedPath = path.join(deployedDir, 'extension-manager');
            if (fs.existsSync(deployedPath)) {
                this.deleteDirectory(deployedPath);
            }

            // Delete .vsix file(s)
            if (fs.existsSync(extensionsDir)) {
                const vsixFiles = fs.readdirSync(extensionsDir)
                    .filter(f => f.includes('extension-manager') && f.endsWith('.vsix'));
                
                for (const vsixFile of vsixFiles) {
                    const vsixPath = path.join(extensionsDir, vsixFile);
                    fs.unlinkSync(vsixPath);
                }
            }

            vscode.window.showInformationMessage(this.t('about.uninstallSuccess'));
            
            if (this.panel) {
                this.panel.dispose();
            }

        } catch (error) {
            vscode.window.showErrorMessage('Uninstall failed: ' + error.message);
        }
    }

    /**
     * Delete directory recursively
     */
    deleteDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            return;
        }

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                this.deleteDirectory(fullPath);
            } else {
                fs.unlinkSync(fullPath);
            }
        }

        fs.rmdirSync(dirPath);
    }

    /**
     * Get version from package.json
     */
    getVersion() {
        try {
            const packagePath = path.join(__dirname, '..', '..', 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            return packageJson.version || '1.0.0';
        } catch {
            return '1.0.0';
        }
    }

    /**
     * Generate HTML content for webview
     */
    getWebviewContent() {
        const version = this.getVersion();

        return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.t('about.title')}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 40px;
            max-width: 600px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid var(--vscode-panel-border);
        }
        h1 {
            margin: 0 0 10px 0;
            font-size: 32px;
        }
        .version {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }
        .info-section {
            margin: 30px 0;
        }
        .info-label {
            font-weight: bold;
            color: var(--vscode-foreground);
            margin-bottom: 5px;
        }
        .info-value {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 20px;
        }
        .danger-zone {
            margin-top: 60px;
            padding: 20px;
            border: 2px solid #f44336;
            border-radius: 6px;
            background-color: rgba(244, 67, 54, 0.1);
        }
        .danger-zone h3 {
            margin-top: 0;
            color: #f44336;
        }
        .danger-zone p {
            margin: 10px 0 20px 0;
            color: var(--vscode-foreground);
        }
        button {
            padding: 10px 20px;
            font-size: 14px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
        }
        .btn-danger {
            background-color: #f44336;
            color: white;
        }
        .btn-danger:hover {
            background-color: #d32f2f;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📦 Extension Manager</h1>
        <div class="version">${this.t('about.version')} ${version}</div>
    </div>

    <div class="info-section">
        <div class="info-label">${this.t('about.description')}</div>
        <div class="info-value">${this.t('extension.description')}</div>

        <div class="info-label">${this.t('about.license')}</div>
        <div class="info-value">Apache License 2.0</div>

        <div class="info-label">${this.t('about.author')}</div>
        <div class="info-value">Monster Maker</div>

        <div class="info-label">GitHub</div>
        <div class="info-value">
            <a href="https://github.com/NikolaiRadke/Extension-Manager" 
               style="color: var(--vscode-textLink-foreground); text-decoration: none;">
                github.com/NikolaiRadke/extension-manager
            </a>
        </div>
    </div>

    <div class="danger-zone">
        <h3>⚠️ ${this.t('about.uninstall')}</h3>
        <p>${this.t('about.uninstallWarning')}</p>
        <button class="btn-danger" onclick="uninstall()">
            ${this.t('about.uninstallButton')}
        </button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function uninstall() {
            vscode.postMessage({ command: 'uninstall' });
        }
    </script>
</body>
</html>`;
    }
}

module.exports = AboutPanel;
