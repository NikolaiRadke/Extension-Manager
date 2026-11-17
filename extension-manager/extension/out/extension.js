/*
 * Extension Manager
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');

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
