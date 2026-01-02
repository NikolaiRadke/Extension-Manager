/*
 * Extension Manager - Extension Tree Provider
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');

/**
 * TreeProvider - Provides tree view for extensions list
 */
class TreeProvider {
    constructor(scanner, t) {
        this.scanner = scanner;
        this.t = t;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    /**
     * Refresh the tree view
     */
    refresh() {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree item for element
     * @param {Object} element - Extension object
     * @returns {vscode.TreeItem}
     */
    getTreeItem(element) {
        return element;
    }

    /**
     * Get children elements
     * @param {Object} element - Parent element (undefined for root)
     * @returns {Promise<Array>}
     */
    async getChildren(element) {
        if (element) {
            return [];
        }

        try {
            const extensions = await this.scanner.scanExtensions();
            
            if (extensions.length === 0) {
                return [this.createEmptyItem()];
            }

            return extensions.map(ext => this.createExtensionItem(ext));

        } catch (error) {
            console.log('ExtensionTreeProvider: Error getting children:', error.message);
            return [this.createErrorItem()];
        }
    }

    /**
     * Create tree item for extension
     * @param {Object} extension - Extension object
     * @returns {vscode.TreeItem}
     */
    createExtensionItem(extension) {
        const item = new vscode.TreeItem(
            extension.name,
            vscode.TreeItemCollapsibleState.None
        );

        // Set icon based on status
        const isSelf = extension.id === 'MonsterMaker.extension-manager';

        if (isSelf) {
            item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            item.contextValue = 'extension-self';
        } else if (extension.status === 'enabled') {
            item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            item.contextValue = 'extension-enabled';
        } else if (extension.status === 'pending') {
            item.iconPath = new vscode.ThemeIcon('watch', new vscode.ThemeColor('list.warningForeground'));
            item.contextValue = 'extension-pending';
        } else {
            item.iconPath = new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('testing.iconFailed'));
            item.contextValue = 'extension-disabled';
        }

        // Description shows version and status
        const statusText = extension.status === 'enabled' 
            ? this.t('tree.enabled')
            : extension.status === 'pending'
            ? this.t('tree.pending')
            : this.t('tree.disabled');
        item.description = `v${extension.version} • ${statusText}`;

        // Tooltip with full info
        item.tooltip = this.createTooltip(extension);

        // Store extension data
        item.command = {
            command: 'extensionManager.showInfo',
            title: this.t('command.showInfo'),
            arguments: [extension.id]
        };

        return item;
    }

    /**
     * Create tooltip with extension details
     * @param {Object} extension - Extension object
     * @returns {vscode.MarkdownString}
     */
    createTooltip(extension) {
        const tooltip = new vscode.MarkdownString();
        tooltip.isTrusted = true;

        tooltip.appendMarkdown(`**${extension.name}**\n\n`);
        tooltip.appendMarkdown(`${this.t('info.publisher')}: ${extension.publisher}\n\n`);
        tooltip.appendMarkdown(`${this.t('info.version')}: ${extension.version}\n\n`);
        tooltip.appendMarkdown(`${this.t('info.status')}: ${extension.status === 'enabled' ? this.t('tree.enabled') : this.t('tree.disabled')}\n\n`);
        
        if (extension.installedDate) {
            tooltip.appendMarkdown(`${this.t('info.installed')}: ${extension.installedDate}\n\n`);
        }
        
        if (extension.description) {
            tooltip.appendMarkdown(`${this.t('info.description')}: ${extension.description}\n\n`);
        }
        
        tooltip.appendMarkdown(`${this.t('info.size')}: ${extension.size}`);

        return tooltip;
    }

    /**
     * Create empty state item
     * @returns {vscode.TreeItem}
     */
    createEmptyItem() {
        const item = new vscode.TreeItem(
            this.t('tree.empty'),
            vscode.TreeItemCollapsibleState.None
        );
        item.iconPath = new vscode.ThemeIcon('info');
        item.contextValue = 'empty';
        return item;
    }

    /**
     * Create error state item
     * @returns {vscode.TreeItem}
     */
    createErrorItem() {
        const item = new vscode.TreeItem(
            this.t('error.readFailed'),
            vscode.TreeItemCollapsibleState.None
        );
        item.iconPath = new vscode.ThemeIcon('error');
        item.contextValue = 'error';
        return item;
    }
}

module.exports = TreeProvider;
