/*
 * Extension Manager - Controller
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Controller - Manages extension operations (enable, disable, uninstall, install)
 */
class Controller {
    constructor(scanner) {
        this.scanner = scanner;
        this.homeDir = os.homedir();
        this.extensionsDir = path.join(this.homeDir, '.arduinoIDE', 'extensions');
        this.deployedDir = path.join(this.homeDir, '.arduinoIDE', 'deployedPlugins');
        this.disabledDir = path.join(this.homeDir, '.extensionmanager', 'disabled');
        this.selfId = 'MonsterMaker.extension-manager';
    }

    /**
     * Enable a disabled extension
     * @param {string} extensionId - Extension ID to enable
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async enableExtension(extensionId) {
        try {
            if (extensionId === this.selfId) {
                return { success: false, message: 'error.cannotEnableSelf' };
            }

            const extension = await this.scanner.getExtensionById(extensionId);
            if (!extension) {
                return { success: false, message: 'error.notFound' };
            }

            if (extension.status === 'enabled') {
                return { success: false, message: 'error.alreadyEnabled' };
            }

            const disabledPath = extension.disabledPath;
            if (!disabledPath || !fs.existsSync(disabledPath)) {
                return { success: false, message: 'error.notFound' };
            }

            const deployedPath = path.join(this.deployedDir, path.basename(disabledPath));

            // Move directory back to deployed
            this.moveDirectory(disabledPath, deployedPath);

            // Move .vsix file back to extensions
            const dirName = path.basename(deployedPath);
            const vsixFileName = dirName + '.vsix';
            const disabledVsixPath = path.join(this.disabledDir, vsixFileName);
            
            if (fs.existsSync(disabledVsixPath)) {
                const vsixPath = path.join(this.extensionsDir, vsixFileName);
                fs.renameSync(disabledVsixPath, vsixPath);
            }

            return { success: true, message: 'status.enabled' };

        } catch (error) {
            return { success: false, message: 'error.moveFailed' };
        }
    }

    /**
     * Disable an enabled extension
     * @param {string} extensionId - Extension ID to disable
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async disableExtension(extensionId) {
        try {
            if (extensionId === this.selfId) {
                return { success: false, message: 'error.cannotDisableSelf' };
            }

            const extension = await this.scanner.getExtensionById(extensionId);
            if (!extension) {
                return { success: false, message: 'error.notFound' };
            }

            if (extension.status === 'disabled') {
                return { success: false, message: 'error.alreadyDisabled' };
            }

            const deployedPath = extension.deployedPath;
            if (!deployedPath || !fs.existsSync(deployedPath)) {
                return { success: false, message: 'error.notFound' };
            }

            const disabledPath = path.join(this.disabledDir, path.basename(deployedPath));

            // Ensure disabled directory exists
            this.scanner.ensureDirectories();

            // Move directory to disabled
            this.moveDirectory(deployedPath, disabledPath);

            // Move .vsix file to disabled directory
            const dirName = path.basename(deployedPath);
            const vsixFileName = dirName + '.vsix';
            const vsixPath = path.join(this.extensionsDir, vsixFileName);
            
            if (fs.existsSync(vsixPath)) {
                const disabledVsixPath = path.join(this.disabledDir, vsixFileName);
                fs.renameSync(vsixPath, disabledVsixPath);
            }

            return { success: true, message: 'status.disabled' };

        } catch (error) {
            return { success: false, message: 'error.moveFailed' };
        }
    }

    /**
     * Uninstall an extension completely
     * @param {string} extensionId - Extension ID to uninstall
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async uninstallExtension(extensionId) {
        try {
            if (extensionId === this.selfId) {
                return { success: false, message: 'error.cannotUninstallSelf' };
            }

            const extension = await this.scanner.getExtensionById(extensionId);
            if (!extension) {
                return { success: false, message: 'error.notFound' };
            }

            // Delete deployed directory if exists
            if (extension.deployedPath && fs.existsSync(extension.deployedPath)) {
                this.deleteDirectory(extension.deployedPath);
            }

            // Delete disabled directory if exists
            if (extension.disabledPath && fs.existsSync(extension.disabledPath)) {
                this.deleteDirectory(extension.disabledPath);
            }

            // Delete .vsix file - get directory name from either deployed or disabled path
            const dirName = extension.deployedPath ? path.basename(extension.deployedPath) :
                           extension.disabledPath ? path.basename(extension.disabledPath) : null;
            
            if (dirName) {
                const vsixFileName = dirName + '.vsix';
                
                // Delete from extensions directory
                const vsixPath = path.join(this.extensionsDir, vsixFileName);
                if (fs.existsSync(vsixPath)) {
                    fs.unlinkSync(vsixPath);
                }
                
                // Delete from disabled directory
                const disabledVsixPath = path.join(this.disabledDir, vsixFileName);
                if (fs.existsSync(disabledVsixPath)) {
                    fs.unlinkSync(disabledVsixPath);
                }
            }

            return { success: true, message: 'status.uninstalled' };

        } catch (error) {
            return { success: false, message: 'error.deleteFailed' };
        }
    }

    /**
     * Install extension from .vsix file
     * @param {string} vsixPath - Path to .vsix file
     * @returns {Promise<{success: boolean, message: string, needsUpgrade?: boolean, fileName?: string}>}
     */
    async installExtension(vsixPath) {
        try {
            if (!fs.existsSync(vsixPath) || !vsixPath.endsWith('.vsix')) {
                return { success: false, message: 'error.invalidVsix' };
            }

            const fileName = path.basename(vsixPath);
            
            // Ensure extensions directory exists
            if (!fs.existsSync(this.extensionsDir)) {
                fs.mkdirSync(this.extensionsDir, { recursive: true });
            }

            const targetPath = path.join(this.extensionsDir, fileName);
            
            // Check if same file already exists
            if (fs.existsSync(targetPath)) {
                return {
                    success: false,
                    message: 'error.alreadyInstalled',
                    needsUpgrade: true,
                    fileName: fileName
                };
            }

            // Copy file
            fs.copyFileSync(vsixPath, targetPath);

            return { success: true, message: 'status.installed' };

        } catch (error) {
            return { success: false, message: 'error.installFailed' };
        }
    }

    /**
     * Upgrade extension - replace existing .vsix file
     * @param {string} fileName - Filename of existing .vsix
     * @param {string} vsixPath - Path to new .vsix file
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async upgradeExtension(fileName, vsixPath) {
        try {
            const targetPath = path.join(this.extensionsDir, fileName);
            
            // Delete old .vsix file
            if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
            }

            // Delete deployed directory to force re-deployment of new version
            // Get base name without .vsix extension
            const baseName = fileName.replace(/\.vsix$/, '');
            const deployedPath = path.join(this.deployedDir, baseName);
            
            if (fs.existsSync(deployedPath)) {
                this.deleteDirectory(deployedPath);
            }

            // Copy new .vsix file
            fs.copyFileSync(vsixPath, targetPath);

            return { success: true, message: 'status.upgraded' };

        } catch (error) {
            return { success: false, message: 'error.installFailed' };
        }
    }

    /**
     * Move directory from source to destination
     * @param {string} source - Source directory path
     * @param {string} destination - Destination directory path
     */
    moveDirectory(source, destination) {
        try {
            fs.renameSync(source, destination);
        } catch (error) {
            // Fallback: copy and delete
            this.copyDirectory(source, destination);
            this.deleteDirectory(source);
        }
    }

    /**
     * Copy directory recursively
     * @param {string} source - Source directory path
     * @param {string} destination - Destination directory path
     */
    copyDirectory(source, destination) {
        if (!fs.existsSync(destination)) {
            fs.mkdirSync(destination, { recursive: true });
        }

        const entries = fs.readdirSync(source, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(source, entry.name);
            const destPath = path.join(destination, entry.name);

            if (entry.isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    /**
     * Delete directory recursively
     * @param {string} dirPath - Directory path to delete
     */
    deleteDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            return;
        }

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                this.deleteDirectory(fullPath);
            } else {
                fs.unlinkSync(fullPath);
            }
        }

        fs.rmdirSync(dirPath);
    }
}

module.exports = Controller;
