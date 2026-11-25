/*
 * Extension Manager
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Core modules
const Scanner = require('./core/scanner');
const Controller = require('./core/controller');
const UpdateChecker = require('./core/updateChecker');
const commands = require('./core/commands');

// UI modules
const SidebarView = require('./ui/sidebarView');
const InfoPanel = require('./ui/infoPanel');
const AboutPanel = require('./ui/aboutPanel');

// Utils
const { loadTranslations, t } = require('./utils/localeLoader');

// Delay of the automatic update check after start (ms)
const STARTUP_CHECK_DELAY = 5000;

// Delay before fixing the layout of sketches used with version 1.x (ms)
const OLD_LAYOUT_FIX_DELAY = 1000;

// Global instances
let scanner;
let controller;
let updateChecker;
let sidebarView;
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
    updateChecker = new UpdateChecker(context, scanner, controller);

    // Initialize UI modules
    sidebarView = new SidebarView(scanner, updateChecker, t, handleSidebarAction);
    infoPanel = new InfoPanel(scanner, controller, updateChecker, sidebarView, t);
    aboutPanel = new AboutPanel(sidebarView, t);
    sidebarView.onDidRefresh(() => infoPanel.update());
    updateChecker.onDidChange(() => sidebarView.refresh());

    // Register sidebar view
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('extensionManager.extensionTree', sidebarView, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    // Register commands
    registerCommands(context);

    // Sketches used with version 1.x may still show the list in the Explorer
    moveViewFromOldLayout();

    // Look for updates a few seconds after start, not to slow down the IDE
    if (vscode.workspace.getConfiguration('extensionManager').get('checkUpdatesOnStartup', true)) {
        setTimeout(() => commands.checkForUpdates(updateChecker, t, false), STARTUP_CHECK_DELAY);
    }
}

/**
 * Register all commands
 * @param {vscode.ExtensionContext} context
 */
function registerCommands(context) {
    // Refresh command
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionManager.refresh', async () => {
            await commands.refreshExtensions(sidebarView, infoPanel, t);
        })
    );

    // Enable command
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionManager.enable', async (extensionId) => {
            if (extensionId) {
                await commands.enableExtension(extensionId, scanner, controller, sidebarView, t);
            }
        })
    );

    // Disable command
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionManager.disable', async (extensionId) => {
            if (extensionId) {
                await commands.disableExtension(extensionId, scanner, controller, sidebarView, t);
            }
        })
    );

    // Uninstall command
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionManager.uninstall', async (extensionId) => {
            if (extensionId) {
                await commands.uninstallExtension(extensionId, scanner, controller, sidebarView, t);
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
            await commands.installExtension(controller, sidebarView, t);
        })
    );

    // Update commands
    context.subscriptions.push(
        vscode.commands.registerCommand('extensionManager.checkUpdates', async () => {
            await commands.checkForUpdates(updateChecker, t, true);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extensionManager.update', async (extensionId) => {
            if (extensionId) {
                await commands.updateExtension(extensionId, updateChecker, controller, sidebarView, t);
            }
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
 * Version 1.x lived in the Explorer and left a marker file in every sketch
 * it was opened in. The IDE (Theia) restores the stored layout of such a sketch,
 * so the new activity bar icon would be missing. Opening our own view container
 * once lets Theia add it again. The marker is removed afterwards, so this
 * runs only once per sketch.
 */
function moveViewFromOldLayout() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) return;

    // Same hash the IDE uses for its workspace-storage folder
    const hash = crypto.createHash('md5').update(workspaceFolder).digest('hex');
    const markerFile = path.join(os.homedir(), '.arduinoIDE', 'workspace-storage', hash, '.extensionmanager-triggered');
    if (!fs.existsSync(markerFile)) return;

    setTimeout(async () => {
        try {
            await vscode.commands.executeCommand('workbench.view.extension.extensionManager');
            fs.unlinkSync(markerFile);
        } catch (error) {
            console.log('Extension Manager: could not move view from old layout:', error.message);
        }
    }, OLD_LAYOUT_FIX_DELAY);
}

/**
 * Handle clicks in the sidebar list
 * @param {string} action - open, enable, disable or uninstall
 * @param {string} extensionId - Extension ID
 */
async function handleSidebarAction(action, extensionId) {
    const commandIds = {
        open: 'extensionManager.showInfo',
        enable: 'extensionManager.enable',
        disable: 'extensionManager.disable',
        uninstall: 'extensionManager.uninstall',
        update: 'extensionManager.update'
    };
    if (commandIds[action]) {
        await vscode.commands.executeCommand(commandIds[action], extensionId);
    }
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
