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

// Layout check for sketches used with version 1.x
const LAYOUT_CHECKED_KEY = 'extensionManager.layoutChecked';
const LAYOUT_CHECK_DELAY = 1500;     // ms after start
const LAYOUT_CHECK_TIMEOUT = 3000;   // ms to wait for the list to appear

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
    checkSketchLayout(context);

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
 * Version 1.x lived in the Explorer. The IDE (Theia) restores the stored layout
 * of a sketch, so in sketches used with 1.x the list stays in the Explorer and
 * the activity bar container is missing or empty. Once per sketch we open our
 * container and look whether the list shows up there. If not, we offer to reset
 * the layout of this sketch.
 * @param {vscode.ExtensionContext} context
 */
function checkSketchLayout(context) {
    if (context.workspaceState.get(LAYOUT_CHECKED_KEY)) return;
    removeOldMarker();

    setTimeout(async () => {
        try {
            await vscode.commands.executeCommand('workbench.view.extension.extensionManager');
        } catch (error) {
            console.log('Extension Manager: could not open view container:', error.message);
            return;
        }

        if (await sidebarView.waitUntilVisible(LAYOUT_CHECK_TIMEOUT)) {
            await context.workspaceState.update(LAYOUT_CHECKED_KEY, true);
            return;
        }

        const reset = t('layout.reset');
        const never = t('layout.dontAsk');
        const choice = await vscode.window.showWarningMessage(t('layout.oldLayout'), reset, never);
        if (choice === never) {
            await context.workspaceState.update(LAYOUT_CHECKED_KEY, true);
        } else if (choice === reset) {
            await context.workspaceState.update(LAYOUT_CHECKED_KEY, true);
            // Theia command behind "Reset Workbench Layout"; reloads the window
            await vscode.commands.executeCommand('reset.layout');
        }
    }, LAYOUT_CHECK_DELAY);
}

/**
 * Remove the marker file version 1.x left in the IDE's workspace-storage
 */
function removeOldMarker() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) return;
    const hash = crypto.createHash('md5').update(workspaceFolder).digest('hex');
    const markerFile = path.join(os.homedir(), '.arduinoIDE', 'workspace-storage', hash, '.extensionmanager-triggered');
    try {
        if (fs.existsSync(markerFile)) fs.unlinkSync(markerFile);
    } catch (error) {
        // Not critical
    }
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
