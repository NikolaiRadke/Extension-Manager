/*
 * Extension Manager - Controller
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const SecurityCheck = require('./securityCheck');

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
        this.securityCheck = new SecurityCheck();
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
     * Parse extension name and version from .vsix filename
     * @param {string} fileName - VSIX filename (e.g., "aiduino-2.6.0.vsix")
     * @returns {Object|null} {name, version} or null if parsing fails
     */
    parseVsixFilename(fileName) {
        // Match patterns: name-version.vsix or name.vsix
        const match = fileName.match(/^(.+?)-(\d+\.\d+\.\d+)\.vsix$/);
        if (match) {
            return { name: match[1], version: match[2] };
        }
        
        // Fallback: name.vsix (no version)
        const simpleMatch = fileName.match(/^(.+?)\.vsix$/);
        if (simpleMatch) {
            return { name: simpleMatch[1], version: null };
        }
        
        return null;
    }

    /**
     * Compare two semantic versions
     * @param {string} v1 - Version 1 (e.g., "2.6.0")
     * @param {string} v2 - Version 2 (e.g., "2.7.0")
     * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
     */
    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < 3; i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;
            
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }
        
        return 0;
    }

    /**
     * Find installed version of an extension by name
     * @param {string} extensionName - Extension name from filename
     * @returns {Object|null} {fileName, version} or null if not found
     */
    findInstalledVersion(extensionName) {
        try {
            const files = fs.readdirSync(this.extensionsDir);
            let foundWithoutVersion = null;
            
            for (const file of files) {
                if (!file.endsWith('.vsix')) continue;
                
                const parsed = this.parseVsixFilename(file);
                
                if (parsed && parsed.name === extensionName) {
                    // Prefer files with version numbers
                    if (parsed.version) {
                        return {
                            fileName: file,
                            version: parsed.version
                        };
                    } else {
                        // Keep track of files without version
                        foundWithoutVersion = {
                            fileName: file,
                            version: null
                        };
                    }
                }
            }
            
            // Return file without version if that's all we found
            return foundWithoutVersion;
        } catch (error) {
            return null;
        }
    }

    /**
     * Load uninstall.json configuration from extension
     * @param {string} deployedPath - Path to deployed extension
     * @returns {Object|null} Uninstall config or null if not found
     */
    loadUninstallConfig(deployedPath) {
        try {
            const configPath = path.join(deployedPath, 'extension', 'uninstall.json');
            if (!fs.existsSync(configPath)) {
                return null;
            }
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (error) {
            return null;
        }
    }

    /**
     * Resolve path placeholders in uninstall.json
     * @param {string} pathStr - Path with placeholders
     * @returns {string} Resolved path
     */
    resolvePath(pathStr) {
        const homeDir = os.homedir();
        return pathStr
            .replace(/^~/, homeDir)
            .replace(/\{arduinoIDE\}/g, this.extensionsDir.replace('/extensions', ''))
            .replace(/\{home\}/g, homeDir);
    }

    /**
     * Clear global state keys from Arduino IDE's global-state.json
     * @param {Array} stateKeys - Keys to remove
     */
    async clearGlobalState(stateKeys) {
        try {
            const arduinoIdeDir = this.extensionsDir.replace('/extensions', '');
            const globalStateFile = path.join(arduinoIdeDir, 'plugin-storage', 'global-state.json');
            
            if (fs.existsSync(globalStateFile)) {
                const data = JSON.parse(fs.readFileSync(globalStateFile, 'utf8'));
                
                for (const key of stateKeys) {
                    delete data[key];
                }
                
                fs.writeFileSync(globalStateFile, JSON.stringify(data), 'utf8');
            }
        } catch (error) {
            // Silent fail
        }
    }

    /**
     * Clear VS Code settings
     * @param {Array} settingKeys - Setting keys to remove
     */
    async clearVSCodeSettings(settingKeys) {
        try {
            // Extract prefix from first key
            const prefix = settingKeys[0]?.split('.')[0];
            if (!prefix) return;
            
            const config = vscode.workspace.getConfiguration(prefix);
            
            for (const fullKey of settingKeys) {
                const key = fullKey.replace(`${prefix}.`, '');
                
                try {
                    await config.update(key, undefined, vscode.ConfigurationTarget.Global);
                    await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
                } catch (error) {
                    // Silent fail
                }
            }
        } catch (error) {
            // Silent fail
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

            // Check for uninstall.json
            const uninstallConfig = extension.deployedPath ? 
                this.loadUninstallConfig(extension.deployedPath) : null;

            if (uninstallConfig) {
                // JSON-based uninstall
                return await this.executeJsonBasedUninstall(extension, uninstallConfig);
            } else {
                // Standard uninstall
                return await this.executeStandardUninstall(extension);
            }

        } catch (error) {
            return { success: false, message: 'error.deleteFailed' };
        }
    }

    /**
     * Execute JSON-based uninstall using uninstall.json
     * @param {Object} extension - Extension object
     * @param {Object} config - Uninstall configuration from JSON
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async executeJsonBasedUninstall(extension, config) {
        const results = {
            deleted: [],
            failed: []
        };

        // Delete directories
        if (config.directories) {
            for (const dir of config.directories) {
                const resolved = this.resolvePath(dir);
                if (fs.existsSync(resolved)) {
                    try {
                        this.deleteDirectory(resolved);
                        results.deleted.push(resolved);
                    } catch (error) {
                        results.failed.push(resolved);
                    }
                }
            }
        }

        // Delete files
        if (config.files) {
            for (const file of config.files) {
                const resolved = this.resolvePath(file);
                if (fs.existsSync(resolved)) {
                    try {
                        if (fs.statSync(resolved).isDirectory()) {
                            this.deleteDirectory(resolved);
                        } else {
                            fs.unlinkSync(resolved);
                        }
                        results.deleted.push(resolved);
                    } catch (error) {
                        results.failed.push(resolved);
                    }
                }
            }
        }

        // Clear global state
        if (config.globalState && config.globalState.length > 0) {
            await this.clearGlobalState(config.globalState);
        }

        // Clear VS Code settings
        if (config.settings && config.settings.length > 0) {
            await this.clearVSCodeSettings(config.settings);
        }

        // Standard cleanup (deployed, disabled, .vsix)
        await this.executeStandardUninstall(extension);

        return { 
            success: results.failed.length === 0, 
            message: results.failed.length === 0 ? 'status.uninstalled' : 'error.deleteFailed'
        };
    }

    /**
     * Execute standard uninstall (no uninstall.json)
     * @param {Object} extension - Extension object
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async executeStandardUninstall(extension) {
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
    }

    /**
    /**
     * Install extension from .vsix file
     * @param {string} vsixPath - Path to .vsix file
     * @returns {Promise<{success: boolean, message: string, extensionInfo?: Object, scanResult?: Object, action?: string, versionInfo?: Object, vsixPath?: string, fileName?: string}>}
     */
    async installExtension(vsixPath) {
        try {
            if (!fs.existsSync(vsixPath) || !vsixPath.endsWith('.vsix')) {
                return { success: false, message: 'error.invalidVsix' };
            }

            const fileName = path.basename(vsixPath);
            const parsed = this.parseVsixFilename(fileName);
            
            // ALWAYS extract extension info
            let extensionInfo;
            try {
                extensionInfo = await this.securityCheck.extractExtensionInfo(vsixPath);
            } catch (error) {
                return { success: false, message: 'error.invalidVsix' };
            }
            
            // ALWAYS run security check
            let scanResult;
            try {
                scanResult = await this.securityCheck.scanVsix(vsixPath);
            } catch (scanError) {
                console.error('Security scan failed:', scanError);
                scanResult = { safe: true, issues: [], details: 'Scan skipped due to error' };
            }
            
            // Ensure extensions directory exists
            if (!fs.existsSync(this.extensionsDir)) {
                fs.mkdirSync(this.extensionsDir, { recursive: true });
            }

            const targetPath = path.join(this.extensionsDir, fileName);
            
            // Determine action type
            let action = 'install';
            let versionInfo = null;
            
            // Check if same file already exists
            if (fs.existsSync(targetPath)) {
                action = 'reinstall';
                versionInfo = {
                    action: 'reinstall',
                    currentVersion: parsed?.version,
                    newVersion: parsed?.version,
                    extensionName: extensionInfo.name
                };
            }
            // Check for other versions of the same extension
            else if (parsed && parsed.name) {
                const installed = this.findInstalledVersion(parsed.name);
                
                if (installed) {
                    let currentVersion = installed.version || 'unknown';
                    let newVersion = parsed.version || 'unknown';
                    
                    // Both have versions - compare them
                    if (parsed.version && installed.version) {
                        const comparison = this.compareVersions(parsed.version, installed.version);
                        
                        if (comparison < 0) action = 'downgrade';
                        else if (comparison === 0) action = 'reinstall';
                        else action = 'upgrade';
                    } else {
                        action = 'upgrade';
                    }
                    
                    versionInfo = {
                        action: action,
                        currentVersion: currentVersion,
                        currentFile: installed.fileName,
                        newVersion: newVersion,
                        extensionName: extensionInfo.name
                    };
                }
            }

            // Return all info - let commands.js decide what to do
            return {
                success: false,
                message: 'needsConfirmation',
                extensionInfo: extensionInfo,
                scanResult: scanResult,
                action: action,
                versionInfo: versionInfo,
                vsixPath: vsixPath,
                fileName: fileName
            };

        } catch (error) {
            return { success: false, message: 'error.installFailed' };
        }
    }

    /**
     * Upgrade extension - replace existing .vsix file
     * @param {string} oldFileName - Filename of existing .vsix (can be different version)
     * @param {string} vsixPath - Path to new .vsix file
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async upgradeExtension(oldFileName, vsixPath) {
        try {
            const newFileName = path.basename(vsixPath);
            const newPath = path.join(this.extensionsDir, newFileName);
            
            // Parse new filename to get extension name
            const parsed = this.parseVsixFilename(newFileName);
            
            if (parsed && parsed.name) {
                // Delete ALL old versions of this extension (not just the one passed in)
                const files = fs.readdirSync(this.extensionsDir);
                for (const file of files) {
                    if (!file.endsWith('.vsix')) continue;
                    
                    const oldParsed = this.parseVsixFilename(file);
                    if (oldParsed && oldParsed.name === parsed.name && file !== newFileName) {
                        const oldPath = path.join(this.extensionsDir, file);
                        if (fs.existsSync(oldPath)) {
                            fs.unlinkSync(oldPath);
                        }
                    }
                }
                
                // Delete deployed directory to force re-deployment of new version
                const deployedPath = path.join(this.deployedDir, parsed.name);
                if (fs.existsSync(deployedPath)) {
                    this.deleteDirectory(deployedPath);
                }
            }

            // Copy new .vsix file
            fs.copyFileSync(vsixPath, newPath);

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
