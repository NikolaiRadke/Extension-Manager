/*
 * Extension Manager
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Core modules
const Scanner = require('./core/scanner');
const Controller = require('./core/controller');
const commands = require('./core/commands');

// UI modules
const TreeProvider = require('./ui/treeProvider');
const InfoPanel = require('./ui/infoPanel');
const AboutPanel = require('./ui/aboutPanel');

// Utils
const { loadTranslations, t } = require('./utils/localeLoader');

// Global instances
let scanner;
let controller;
let treeProvider;
let infoPanel;
let aboutPanel;

/**
 * Activate extension
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
    // Load translations
    await loadTranslations();

    // Initialize core modules
    scanner = new Scanner();
    controller = new Controller(scanner);

    // Initialize UI modules
    treeProvider = new TreeProvider(scanner, t);
    infoPanel = new InfoPanel(scanner, controller, treeProvider, t);
    aboutPanel = new AboutPanel(treeProvider, t);

    // Register tree view
    const treeView = vscode.window.createTreeView('extensionManager.extensionTree', {
        treeDataProvider: treeProvider,
        showCollapseAll: false
    });
    context.subscriptions.push(treeView);
    
    // Open explorer only once per sketch (workspace)
    // Use hash-based marker file in Arduino IDE's workspace-storage
    setTimeout(() => {
        if (!treeView.visible) {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            
            if (workspaceFolder) {
                // Create hash like Arduino IDE does
                const crypto = require('crypto');
                const hash = crypto.createHash('md5').update(workspaceFolder).digest('hex');
                const storageDir = path.join(os.homedir(), '.arduinoIDE', 'workspace-storage', hash);
                const markerFile = path.join(storageDir, '.extensionmanager-triggered');
                
                if (!fs.existsSync(markerFile)) {
                    // First time in this sketch - trigger explorer once
                    if (!fs.existsSync(storageDir)) {
                        fs.mkdirSync(storageDir, { recursive: true });
                    }
                    
                    vscode.commands.executeCommand('workbench.view.explorer');
                    
                    try {
                        fs.writeFileSync(markerFile, new Date().toISOString());
                    } catch (error) {
                        // Silent fail - not critical
                    }
                }
                // If marker exists, do nothing - explorer already triggered before
            } else {
                // No workspace folder - trigger anyway
                vscode.commands.executeCommand('workbench.view.explorer');
            }
        }
    }, 100);

    // Register commands
    registerCommands(context);
}

/**
 * Register all commands
 * @param {vscode.ExtensionContext} context
 */
function registerCommands(context) {
    // Refresh command
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionManager.refresh', async () => {
            await commands.refreshExtensions(treeProvider, infoPanel, t);
        })
    );

    // Enable command
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionManager.enable', async (item) => {
            if (item && item.command && item.command.arguments) {
                const extensionId = item.command.arguments[0];
                await commands.enableExtension(extensionId, scanner, controller, treeProvider, t);
            }
        })
    );

    // Disable command
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionManager.disable', async (item) => {
            if (item && item.command && item.command.arguments) {
                const extensionId = item.command.arguments[0];
                await commands.disableExtension(extensionId, scanner, controller, treeProvider, t);
            }
        })
    );

    // Uninstall command
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionManager.uninstall', async (item) => {
            if (item && item.command && item.command.arguments) {
                const extensionId = item.command.arguments[0];
                await commands.uninstallExtension(extensionId, scanner, controller, treeProvider, t);
            }
        })
    );

    // Show info command
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionManager.showInfo', async (extensionId) => {
            if (extensionId) {
                await infoPanel.show(extensionId);
            }
        })
    );

    // Install command
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionManager.install', async () => {
            await commands.installExtension(controller, treeProvider, t);
        })
    );

    // About command
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionManager.about', async () => {
            await commands.showAbout(aboutPanel);
        })
    );
}

/**
 * Deactivate extension
 */
function deactivate() {
    // Cleanup if needed
}

module.exports = {
    activate,
    deactivate
};
