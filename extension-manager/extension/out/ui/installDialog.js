/*
 * Extension Manager - Installation Dialog
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * InstallDialog - Shows installation confirmation dialog with extension info and security check
 */
class InstallDialog {
    constructor(controller, treeProvider, t) {
        this.controller = controller;
        this.treeProvider = treeProvider;
        this.t = t;
    }

    /**
     * Show installation dialog
     * @param {Object} result - Result from controller.installExtension()
     * @returns {Promise<boolean>} True if user confirmed installation
     */
    async show(result) {
        const { extensionInfo, scanResult, action, versionInfo } = result;
        
        // Build message text
        const lines = [];
        
        // Header with icon and action
        const icons = {
            install: '📦',
            upgrade: '⬆️',
            downgrade: '⬇️',
            reinstall: '🔄'
        };
        
        const icon = icons[action] || '📦';
        const actionText = this.t(`install.action.${action}`) || this.t('install.action.install');
        
        lines.push(`${icon} ${extensionInfo.name} ${actionText}?\n`);
        
        // Version comparison for upgrades/downgrades/reinstalls
        if (versionInfo && versionInfo.currentVersion) {
            if (action === 'upgrade') {
                lines.push(`Version ${versionInfo.currentVersion} → ${versionInfo.newVersion}\n`);
            } else if (action === 'downgrade') {
                lines.push(`Version ${versionInfo.currentVersion} → ${versionInfo.newVersion} (${this.t('install.dialog.olderVersion')})\n`);
            } else if (action === 'reinstall') {
                lines.push(`Version ${versionInfo.currentVersion} (${this.t('install.dialog.reinstall')})\n`);
            }
        }
        
        // Extension Information
        lines.push(`ℹ️  ${this.t('install.dialog.header')}`);
        lines.push(`   ${this.t('info.name')}: ${extensionInfo.name}`);
        lines.push(`   ${this.t('info.version')}: ${extensionInfo.version}`);
        if (extensionInfo.publisher) {
            lines.push(`   ${this.t('info.publisher')}: ${extensionInfo.publisher}`);
        }
        if (extensionInfo.description) {
            lines.push(`   ${this.t('info.description')}: ${extensionInfo.description}`);
        }
        if (extensionInfo.size) {
            lines.push(`   ${this.t('info.size')}: ${extensionInfo.size}`);
        }
        lines.push('');
        lines.push('');

        // Uninstall Configuration
        if (scanResult.hasUninstallConfig) {
            lines.push(`✅ ${this.t('info.uninstallConfig')}: ${this.t('info.hasUninstallConfig')}`);
            lines.push('');
        }
        
        // Security Check Results
        if (!scanResult.safe) {
            // Add header for security section
            lines.push(`🔒 ${this.t('install.dialog.permissions')}`);
            
            // Use existing formatUserFriendly from SecurityCheck
            const SecurityCheck = require('../core/securityCheck');
            const checker = new SecurityCheck();
            const securityInfo = checker.formatUserFriendly(scanResult, extensionInfo.name);
            
            // Add security info to message
            const securityLines = securityInfo.split('\n');
            lines.push(...securityLines);
        } else {
            lines.push(`✅ ${this.t('install.dialog.noPermissions')}\n`);
        }
        
        const message = lines.join('\n');
        
        // Button text based on action
        const buttonText = action === 'install' ? this.t('install.button.install') :
                           action === 'upgrade' ? this.t('install.upgradeButton') :
                           action === 'downgrade' ? this.t('install.downgradeButton') :
                           this.t('install.reinstallButton');
        
        // Show dialog
        const choice = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            buttonText
        );
        
        return choice === buttonText;
    }

    /**
     * Perform the actual installation after user confirmation
     * @param {Object} result - Result from controller.installExtension()
     */
    async performInstallation(result) {
        const { vsixPath, fileName, versionInfo, action, extensionInfo } = result;
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: this.t('install.processing'),
            cancellable: false
        }, async () => {
            let installResult;
            const targetPath = path.join(this.controller.extensionsDir, fileName);
            
            if (action === 'install') {
                // Simple install - copy file with original name
                fs.copyFileSync(vsixPath, targetPath);
                installResult = { success: true };
            } else {
                // Upgrade/downgrade/reinstall - use upgradeExtension
                const oldFile = versionInfo?.currentFile || fileName;
                installResult = await this.controller.upgradeExtension(oldFile, vsixPath);
            }
            
            if (installResult.success) {
                // Add to pending.json (will be shown in tree until deployed)
                this.controller.addPendingExtension(extensionInfo, targetPath);
                
                vscode.window.showInformationMessage(this.t('install.success'));
                this.treeProvider.refresh();
            } else {
                vscode.window.showErrorMessage(this.t(installResult.message));
            }
        });
    }
}

module.exports = InstallDialog;
