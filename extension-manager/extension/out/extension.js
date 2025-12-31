/*
 * Extension Manager
 * Copyright 2025 Monster Maker
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
    infoPanel = new InfoPanel(scanner, controller, t);
    aboutPanel = new AboutPanel(t);

    // Register tree view
    const treeView = vscode.window.createTreeView('extensionManager.extensionTree', {
        treeDataProvider: treeProvider,
        showCollapseAll: false
    });
    context.subscriptions.push(treeView);
    
    // Make TreeView visible if not already visible
    // Use setTimeout to avoid blocking the activation call stack
    setTimeout(() => {
        if (!treeView.visible) {
            try {
                // Try to reveal the tree view without focusing
                treeView.reveal(null, { select: false, focus: false });
            } catch (error) {
                // Fallback: open explorer view
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
