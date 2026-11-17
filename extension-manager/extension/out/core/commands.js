/*
 * Extension Manager - Commands
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// Paths listed in the second uninstall confirmation, the rest is shortened
const MAX_LISTED_PATHS = 10;

/**
 * Refresh extension list
 * @param {Object} treeProvider - Tree provider instance
 * @param {Object} infoPanel - Info panel instance
 * @param {Function} t - Translation function
 */
async function refreshExtensions(treeProvider, infoPanel, t) {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: t('status.scanning'),
        cancellable: false
    }, async () => {
        treeProvider.refresh();
        if (infoPanel.panel) {
            await infoPanel.refresh();
        }
    });
}

/**
 * Enable extension command
 * @param {string} extensionId - Extension ID
 * @param {Object} scanner - Scanner instance
 * @param {Object} controller - Controller instance
 * @param {Object} treeProvider - Tree provider instance
 * @param {Function} t - Translation function
 */
async function enableExtension(extensionId, scanner, controller, treeProvider, t) {
    const extension = await scanner.getExtensionById(extensionId);
    
    if (!extension) {
        vscode.window.showErrorMessage(t('error.notFound'));
        return;
    }

    const confirm = await vscode.window.showInformationMessage(
        t('confirm.enable').replace('{0}', extension.name),
        { modal: true },
        t('button.enable')
    );

    if (confirm !== t('button.enable')) {
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: t('status.loading'),
        cancellable: false
    }, async () => {
        const result = await controller.enableExtension(extensionId);
        
        if (result.success) {
            vscode.window.showInformationMessage(t('restart.message'));
            treeProvider.refresh();
        } else {
            vscode.window.showErrorMessage(t(result.message));
        }
    });
}

/**
 * Disable extension command
 * @param {string} extensionId - Extension ID
 * @param {Object} scanner - Scanner instance
 * @param {Object} controller - Controller instance
 * @param {Object} treeProvider - Tree provider instance
 * @param {Function} t - Translation function
 */
async function disableExtension(extensionId, scanner, controller, treeProvider, t) {
    const extension = await scanner.getExtensionById(extensionId);
    
    if (!extension) {
        vscode.window.showErrorMessage(t('error.notFound'));
        return;
    }

    const confirm = await vscode.window.showInformationMessage(
        t('confirm.disable').replace('{0}', extension.name),
        { modal: true },
        t('button.disable')
    );

    if (confirm !== t('button.disable')) {
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: t('status.loading'),
        cancellable: false
    }, async () => {
        const result = await controller.disableExtension(extensionId);
        
        if (result.success) {
            vscode.window.showInformationMessage(t('restart.message'));
            treeProvider.refresh();
        } else {
            vscode.window.showErrorMessage(t(result.message));
        }
    });
}

/**
 * Uninstall extension command
 * @param {string} extensionId - Extension ID
 * @param {Object} scanner - Scanner instance
 * @param {Object} controller - Controller instance
 * @param {Object} treeProvider - Tree provider instance
 * @param {Function} t - Translation function
 */
async function uninstallExtension(extensionId, scanner, controller, treeProvider, t) {
    const extension = await scanner.getExtensionById(extensionId);
    
    if (!extension) {
        vscode.window.showErrorMessage(t('error.notFound'));
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        t('confirm.uninstall').replace('{0}', extension.name),
        { modal: true },
        t('button.uninstall')
    );

    if (confirm !== t('button.uninstall')) {
        return;
    }

    // uninstall.json may ask for a second confirmation: show what will be deleted
    const uninstallConfig = extension.deployedPath ? controller.loadUninstallConfig(extension.deployedPath) : null;
    if (uninstallConfig?.confirm?.double) {
        const { targets } = controller.collectTargets(uninstallConfig);
        const list = targets.slice(0, MAX_LISTED_PATHS).join('\n') + (targets.length > MAX_LISTED_PATHS ? '\n…' : '');
        const second = await vscode.window.showWarningMessage(
            t('confirm.uninstallDouble').replace('{0}', extension.name).replace('{1}', list || '-'),
            { modal: true },
            t('button.uninstall')
        );
        if (second !== t('button.uninstall')) {
            return;
        }
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: t('status.loading'),
        cancellable: false
    }, async () => {
        const result = await controller.uninstallExtension(extensionId);
        
        if (result.success) {
            vscode.window.showInformationMessage(t('restart.message'));
            treeProvider.refresh();
        } else {
            vscode.window.showErrorMessage(t(result.message));
        }
    });
}

/**
 * Install extension from .vsix file
 * @param {Object} controller - Controller instance
 * @param {Object} treeProvider - Tree provider instance
 * @param {Function} t - Translation function
 */
async function installExtension(controller, treeProvider, t) {
    const fileUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
            'VSIX Files': ['vsix']
        },
        openLabel: t('install.selectFile')
    });

    if (!fileUri || fileUri.length === 0) {
        return;
    }

    await installVsixFile(fileUri[0].fsPath, controller, treeProvider, t);
}

/**
 * Run the install dialog (security scan, version check) for a .vsix file
 * @param {string} vsixPath - Path to the .vsix file
 * @param {Object} controller - Controller instance
 * @param {Object} treeProvider - Tree provider instance
 * @param {Function} t - Translation function
 * @returns {Promise<boolean>} True if the extension was installed
 */
async function installVsixFile(vsixPath, controller, treeProvider, t) {
    const InstallDialog = require('../ui/installDialog');
    const installDialog = new InstallDialog(controller, treeProvider, t);
    let installed = false;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: t('security.scanning'),
        cancellable: false
    }, async () => {
        const result = await controller.installExtension(vsixPath);
        
        if (result.message === 'needsConfirmation') {
            // Show unified installation dialog
            const confirmed = await installDialog.show(result);
            
            if (confirmed) {
                // User confirmed - proceed with installation
                await installDialog.performInstallation(result);
                installed = true;
            }
        } else {
            // Error case
            vscode.window.showErrorMessage(t(result.message));
        }
    });

    return installed;
}

/**
 * Check all extensions for updates
 * @param {Object} updateChecker - UpdateChecker instance
 * @param {Function} t - Translation function
 * @param {boolean} manual - Started by the user: always report the result
 */
async function checkForUpdates(updateChecker, t, manual) {
    const run = () => updateChecker.check(manual);
    const { count, rateLimited } = manual
        ? await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t('update.checking') }, run)
        : await run();

    if (rateLimited) {
        vscode.window.showWarningMessage(t('update.rateLimit'));
    }
    if (count > 0) {
        const message = count === 1 ? t('update.availableOne') : t('update.availableMany', count);
        const choice = await vscode.window.showInformationMessage(message, t('update.show'));
        if (choice === t('update.show')) {
            vscode.commands.executeCommand('workbench.view.extension.extensionManager');
        }
    } else if (manual && !rateLimited) {
        vscode.window.showInformationMessage(t('update.none'));
    }
}

/**
 * Download and install the update of one extension
 * @param {string} extensionId - Extension ID
 * @param {Object} updateChecker - UpdateChecker instance
 * @param {Object} controller - Controller instance
 * @param {Object} treeProvider - Tree provider instance
 * @param {Function} t - Translation function
 */
async function updateExtension(extensionId, updateChecker, controller, treeProvider, t) {
    const update = updateChecker.get(extensionId);
    if (!update) return;

    let vsixPath;
    try {
        vsixPath = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: t('update.downloading', update.assetName)
        }, () => updateChecker.download(extensionId));
    } catch (error) {
        vscode.window.showErrorMessage(t('update.downloadFailed', error.message));
        return;
    }

    try {
        if (await installVsixFile(vsixPath, controller, treeProvider, t)) {
            updateChecker.clear(extensionId);
        }
    } finally {
        fs.rmSync(path.dirname(vsixPath), { recursive: true, force: true });
    }
}

/**
 * Show about panel
 * @param {Object} aboutPanel - AboutPanel instance
 */
async function showAbout(aboutPanel) {
    await aboutPanel.show();
}

module.exports = {
    installVsixFile,
    checkForUpdates,
    updateExtension,
    refreshExtensions,
    enableExtension,
    disableExtension,
    uninstallExtension,
    installExtension,
    showAbout
};
