/*
 * Extension Manager - Extension Info Panel
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');

/**
 * InfoPanel - Shows detailed extension information in WebView
 */
class InfoPanel {
    constructor(scanner, controller, treeProvider, t) {
        this.scanner = scanner;
        this.controller = controller;
        this.treeProvider = treeProvider;
        this.t = t;
        this.panel = null;
        this.currentExtensionId = null;
    }

    /**
     * Show info panel for extension
     * @param {string} extensionId - Extension ID to show
     */
    async show(extensionId) {
        this.currentExtensionId = extensionId;
        const extension = await this.scanner.getExtensionById(extensionId);

        if (!extension) {
            vscode.window.showErrorMessage(this.t('error.notFound'));
            return;
        }

        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Two);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'extensionInfo',
                this.t('info.title'),
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = null;
                this.currentExtensionId = null;
            });

            // Handle messages from webview
            this.panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'enable':
                            await this.handleEnable(message.extensionId);
                            break;
                        case 'disable':
                            await this.handleDisable(message.extensionId);
                            break;
                        case 'uninstall':
                            await this.handleUninstall(message.extensionId);
                            break;
                    }
                }
            );
        }

        this.panel.webview.html = this.getWebviewContent(extension);
        this.panel.title = extension.name;
    }

    /**
     * Handle enable button click
     * @param {string} extensionId - Extension ID
     */
    async handleEnable(extensionId) {
        const result = await this.controller.enableExtension(extensionId);
        
        if (result.success) {
            vscode.window.showInformationMessage(
                this.t('restart.message')
            );
            await this.refresh();
        } else {
            vscode.window.showErrorMessage(this.t(result.message));
        }
    }

    /**
     * Handle disable button click
     * @param {string} extensionId - Extension ID
     */
    async handleDisable(extensionId) {
        const result = await this.controller.disableExtension(extensionId);
        
        if (result.success) {
            vscode.window.showInformationMessage(
                this.t('restart.message')
            );
            await this.refresh();
        } else {
            vscode.window.showErrorMessage(this.t(result.message));
        }
    }

    /**
     * Handle uninstall button click
     * @param {string} extensionId - Extension ID
     */
    async handleUninstall(extensionId) {
        const extension = await this.scanner.getExtensionById(extensionId);
        
        const confirm = await vscode.window.showWarningMessage(
            this.t('confirm.uninstall').replace('{0}', extension.name),
            { modal: true },
            this.t('button.uninstall')
        );

        if (confirm === this.t('button.uninstall')) {
            const result = await this.controller.uninstallExtension(extensionId);
            
            if (result.success) {
                vscode.window.showInformationMessage(this.t('status.uninstalled'));
                this.panel?.dispose();
            } else {
                vscode.window.showErrorMessage(this.t(result.message));
            }
        }
    }

    /**
     * Refresh panel content
     */
    async refresh() {
        if (this.panel && this.currentExtensionId) {
            const extension = await this.scanner.getExtensionById(this.currentExtensionId);
            if (extension) {
                this.panel.webview.html = this.getWebviewContent(extension);
            }
        }
        this.treeProvider.refresh();
    }

    /**
     * Generate HTML content for webview
     * @param {Object} extension - Extension object
     * @returns {string} HTML content
     */
    getWebviewContent(extension) {
        const isEnabled = extension.status === 'enabled';
        const isPending = extension.status === 'pending';
        const isSelf = extension.id === 'MonsterMaker.extension-manager';

        return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.t('info.title')}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        h1 {
            margin: 0;
            font-size: 24px;
            color: var(--vscode-foreground);
        }
        .publisher {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
            margin-top: 5px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 10px 20px;
            margin: 20px 0;
        }
        .label {
            font-weight: bold;
            color: var(--vscode-foreground);
        }
        .value {
            color: var(--vscode-descriptionForeground);
        }
        .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
        }
        .status.enabled {
            background-color: #4caf50;
            color: white;
        }
        .status.disabled {
            background-color: #f44336;
            color: white;
        }
        .description {
            margin: 20px 0;
            padding: 15px;
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textBlockQuote-border);
        }
        .actions {
            display: flex;
            gap: 10px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        button {
            padding: 8px 16px;
            font-size: 13px;
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-primary:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
        }
        .btn-danger {
            background-color: var(--vscode-errorForeground);
            color: white;
        }
        .btn-danger:hover:not(:disabled) {
            opacity: 0.8;
        }
        .location {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${extension.name}</h1>
        ${extension.publisher ? `<div class="publisher">${extension.publisher}</div>` : ''}
    </div>

    <div class="info-grid">
        <span class="label">${this.t('info.version')}:</span>
        <span class="value">${extension.version}</span>

        <span class="label">${this.t('info.status')}:</span>
        <span class="value">
            <span class="status ${extension.status}">
                ${isEnabled ? this.t('tree.enabled') : this.t('tree.disabled')}
            </span>
        </span>

        <span class="label">${this.t('info.size')}:</span>
        <span class="value">${extension.size}</span>

        ${extension.installedDate ? `
        <span class="label">${this.t('info.installed')}:</span>
        <span class="value">${extension.installedDate}</span>
        ` : ''}

        ${extension.hasUninstallConfig ? `
        <span class="label">${this.t('info.uninstallConfig')}:</span>
        <span class="value" style="color: var(--vscode-charts-green);">✓ ${this.t('info.hasUninstallConfig')}</span>
        ` : ''}

        ${extension.vsixPath ? `
        <span class="label">${this.t('info.location')}:</span>
        <span class="value location">${extension.vsixPath}</span>
        ` : ''}
    </div>

    ${extension.description ? `
    <div class="description">
        ${extension.description}
    </div>
    ` : ''}

    <div class="actions">
        ${isPending ? `
            <button class="btn-primary" disabled>
                ${this.t('tree.pending')}
            </button>
        ` : isEnabled ? `
            <button class="btn-primary" onclick="disableExtension()" ${isSelf ? 'disabled' : ''}>
                ${this.t('button.disable')}
            </button>
        ` : `
            <button class="btn-primary" onclick="enableExtension()">
                ${this.t('button.enable')}
            </button>
        `}
        <button class="btn-danger" onclick="uninstallExtension()" ${isSelf || isPending ? 'disabled' : ''}>
            ${this.t('button.uninstall')}
        </button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function enableExtension() {
            vscode.postMessage({
                command: 'enable',
                extensionId: '${extension.id}'
            });
        }

        function disableExtension() {
            vscode.postMessage({
                command: 'disable',
                extensionId: '${extension.id}'
            });
        }

        function uninstallExtension() {
            vscode.postMessage({
                command: 'uninstall',
                extensionId: '${extension.id}'
            });
        }
    </script>
</body>
</html>`;
    }
}

module.exports = InfoPanel;
