/*
 * Extension Manager - Commands
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');

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

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: t('status.loading'),
        cancellable: false
    }, async () => {
        const result = await controller.uninstallExtension(extensionId);
        
        if (result.success) {
            vscode.window.showInformationMessage(t('status.uninstalled'));
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

    const vsixPath = fileUri[0].fsPath;

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: t('install.processing'),
        cancellable: false
    }, async () => {
        const result = await controller.installExtension(vsixPath);
        
        if (result.success) {
            vscode.window.showInformationMessage(t('install.success'));
            treeProvider.refresh();
        } else {
            vscode.window.showErrorMessage(t(result.message));
        }
    });
}

/**
 * Show about panel
 * @param {Object} aboutPanel - AboutPanel instance
 */
async function showAbout(aboutPanel) {
    await aboutPanel.show();
}

module.exports = {
    refreshExtensions,
    enableExtension,
    disableExtension,
    uninstallExtension,
    installExtension,
    showAbout
};
