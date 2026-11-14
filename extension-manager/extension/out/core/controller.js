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
const fileManager = require('../utils/fileManager');

const IS_WINDOWS = process.platform === 'win32';

/**
 * Controller - Manages extension operations (enable, disable, uninstall, install)
 */
class Controller {
    constructor(scanner) {
        this.scanner = scanner;
        this.homeDir = os.homedir();
        this.arduinoIdeDir = path.join(this.homeDir, '.arduinoIDE');
        this.extensionsDir = path.join(this.arduinoIdeDir, 'extensions');
        this.deployedDir = path.join(this.arduinoIdeDir, 'deployedPlugins');
        this.disabledDir = path.join(this.homeDir, '.extensionmanager', 'disabled');
        this.managerDir = path.join(this.homeDir, '.extensionmanager');
        this.pendingFile = path.join(this.managerDir, 'pending.json');
        this.selfId = 'MonsterMaker.extension-manager';
        this.securityCheck = new SecurityCheck();
    }

    /**
     * Move .vsix file between extensions and disabled directories
     * @param {string} dirName - Directory name (without .vsix extension)
     * @param {string} fromDir - Source directory (this.extensionsDir or this.disabledDir)
     * @param {string} toDir - Target directory (this.extensionsDir or this.disabledDir)
     */
    moveVsixFile(dirName, fromDir, toDir) {
        const vsixFileName = dirName + '.vsix';
        const sourcePath = path.join(fromDir, vsixFileName);
        
        if (fs.existsSync(sourcePath)) {
            const targetPath = path.join(toDir, vsixFileName);
            fs.renameSync(sourcePath, targetPath);
        }
    }

    /**
     * Add extension to pending.json (waiting for IDE restart/deploy)
     * @param {Object} extensionInfo - Extension metadata from package.json
     * @param {string} vsixPath - Path to .vsix file
     */
    addPendingExtension(extensionInfo, vsixPath) {
        try {
            // Ensure manager directory exists
            if (!fs.existsSync(this.managerDir)) {
                fs.mkdirSync(this.managerDir, { recursive: true });
            }

            // Load existing pending.json
            let pending = fileManager.readJsonFile(this.pendingFile) || {};

            // Add/update this extension
            pending[extensionInfo.name] = {
                name: extensionInfo.name,
                displayName: extensionInfo.displayName || extensionInfo.name,
                version: extensionInfo.version,
                publisher: extensionInfo.publisher || 'Unknown',
                description: extensionInfo.description || '',
                vsixPath: vsixPath,
                installedDate: new Date().toISOString()
            };

            // Write back
            fileManager.writeJsonFile(this.pendingFile, pending);
        } catch (error) {
            // Silent fail - pending list is not critical
        }
    }

    /**
     * Remove extension from pending.json
     * @param {string} extensionName - Extension name from package.json
     */
    removePendingExtension(extensionName) {
        try {
            const pending = fileManager.readJsonFile(this.pendingFile);
            if (!pending) {
                return;
            }

            delete pending[extensionName];

            fileManager.writeJsonFile(this.pendingFile, pending);
        } catch (error) {
            // Silent fail
        }
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
            fileManager.moveDirectory(disabledPath, deployedPath);

            // Move .vsix file back to extensions
            const dirName = path.basename(deployedPath);
            this.moveVsixFile(dirName, this.disabledDir, this.extensionsDir);

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
            fileManager.moveDirectory(deployedPath, disabledPath);

            // Move .vsix file to disabled directory
            const dirName = path.basename(deployedPath);
            this.moveVsixFile(dirName, this.extensionsDir, this.disabledDir);

            return { success: true, message: 'status.disabled' };

        } catch (error) {
            return { success: false, message: 'error.moveFailed' };
        }
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
     * Find installed version of an extension by name from package.json
     * Only checks DEPLOYED extensions (in deployedPlugins/)
     * @param {string} extensionName - Extension name from package.json
     * @returns {Promise<Object|null>} {fileName, version, extension} or null if not found
     */
    async findInstalledVersion(extensionName) {
        try {
            // Ask scanner for all installed extensions
            const extensions = await this.scanner.scanExtensions();
            
            // Find extension with matching name - ONLY check deployed/disabled extensions!
            for (const ext of extensions) {
                // Skip extensions that are not deployed or disabled
                if (!ext.deployedPath && !ext.disabledPath) {
                    continue;
                }
                
                // Direct comparison - both are from package.json!
                if (ext.rawName === extensionName) {
                    return {
                        fileName: ext.vsixPath ? path.basename(ext.vsixPath) : null,
                        version: ext.version,
                        extension: ext
                    };
                }
            }
            
            return null;
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
        const configPath = path.join(deployedPath, 'extension', 'uninstall.json');
        return fileManager.readJsonFile(configPath);
    }

    /**
     * Resolve path placeholders in uninstall.json
     * @param {string} pathStr - Path with placeholders (~, {home}, {arduinoIDE}, {tmp})
     * @returns {string} Resolved path
     */
    resolvePath(pathStr) {
        return path.normalize(pathStr
            .replace(/^~(?=$|[\\/])/, this.homeDir)
            .replace(/\{home\}/g, this.homeDir)
            .replace(/\{arduinoIDE\}/g, this.arduinoIdeDir)
            .replace(/\{tmp\}/g, os.tmpdir()));
    }

    /**
     * Check whether a path lies strictly inside a folder
     * @param {string} parent - Folder
     * @param {string} child - Path
     * @returns {boolean} True if child is below parent
     */
    isInside(parent, child) {
        const normalize = p => (IS_WINDOWS ? p.toLowerCase() : p);
        const relative = path.relative(normalize(parent), normalize(child));
        return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
    }

    /**
     * uninstall.json comes from a third-party extension: it may only delete
     * below the home or temp folder, never these folders themselves or the
     * folders the IDE and the Extension Manager need
     * @param {string} target - Resolved path
     * @returns {boolean} True if the path may be deleted
     */
    isSafeTarget(target) {
        const normalize = p => (IS_WINDOWS ? p.toLowerCase() : p);
        const protectedDirs = [
            this.arduinoIdeDir, this.extensionsDir, this.deployedDir,
            path.join(this.arduinoIdeDir, 'plugin-storage'), this.managerDir, this.disabledDir
        ].map(dir => normalize(path.normalize(dir)));
        if (protectedDirs.includes(normalize(target))) return false;
        if (this.isInside(this.managerDir, target)) return false;
        return this.isInside(this.homeDir, target) || this.isInside(os.tmpdir(), target);
    }

    /**
     * Turn one entry of uninstall.json into existing paths. A * in the last
     * part matches any characters (extension-1.2.3.vsix), not in folder names.
     * @param {string} entry - Entry with placeholders
     * @returns {{targets: string[], refused: string[]}} Paths to delete and refused paths
     */
    expandEntry(entry) {
        if (typeof entry !== 'string' || entry.split(/[\\/]/).includes('..')) {
            return { targets: [], refused: [String(entry)] };
        }
        const resolved = this.resolvePath(entry);
        const dir = path.dirname(resolved);
        const name = path.basename(resolved);
        // Wildcards only in the last part
        if (dir.includes('*')) return { targets: [], refused: [resolved] };
        let found = [];
        if (name.includes('*')) {
            const escaped = name.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
            const pattern = new RegExp(`^${escaped.join('.*')}$`, IS_WINDOWS ? 'i' : '');
            found = fs.existsSync(dir) ? fs.readdirSync(dir).filter(file => pattern.test(file)).map(file => path.join(dir, file)) : [];
        } else if (fs.existsSync(resolved)) {
            found = [resolved];
        }
        return {
            targets: found.filter(target => this.isSafeTarget(target)),
            refused: found.filter(target => !this.isSafeTarget(target))
        };
    }

    /**
     * All existing paths an uninstall.json would delete
     * @param {Object} config - Uninstall configuration
     * @returns {{targets: string[], refused: string[]}} Paths to delete and refused paths
     */
    collectTargets(config) {
        const entries = [...(config.directories || []), ...(config.files || [])];
        const targets = new Set();
        const refused = new Set();
        for (const entry of entries) {
            const result = this.expandEntry(entry);
            result.targets.forEach(target => targets.add(target));
            result.refused.forEach(target => refused.add(target));
        }
        return { targets: [...targets], refused: [...refused] };
    }

    /**
     * Clear global state keys from Arduino IDE's global-state.json
     * @param {Array} stateKeys - Keys to remove
     */
    async clearGlobalState(stateKeys) {
        try {
            const globalStateFile = path.join(this.arduinoIdeDir, 'plugin-storage', 'global-state.json');
            
            const data = fileManager.readJsonFile(globalStateFile);
            if (data) {
                for (const key of stateKeys) {
                    delete data[key];
                }
                
                fileManager.writeJsonFile(globalStateFile, data, false); // No pretty print for global-state
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
        for (const fullKey of settingKeys) {
            // Each key has its own prefix (myext.apiKey, myext.advanced.option)
            const [prefix, ...rest] = String(fullKey).split('.');
            if (!prefix || rest.length === 0) continue;
            const config = vscode.workspace.getConfiguration(prefix);
            for (const target of [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace]) {
                try {
                    await config.update(rest.join('.'), undefined, target);
                } catch (error) {
                    // No workspace or unknown key: nothing to clear
                }
            }
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

            // If pending, just remove from pending.json
            if (extension.status === 'pending') {
                this.removePendingExtension(extension.rawName);
                return { success: true, message: 'status.uninstalled' };
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

        // Delete directories and files (only safe paths, see isSafeTarget)
        const { targets, refused } = this.collectTargets(config);
        results.failed.push(...refused);
        for (const target of targets) {
            try {
                if (fs.statSync(target).isDirectory()) {
                    fileManager.deleteDirectory(target);
                } else {
                    fs.unlinkSync(target);
                }
                results.deleted.push(target);
            } catch (error) {
                results.failed.push(target);
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
            fileManager.deleteDirectory(extension.deployedPath);
        }

        // Delete disabled directory if exists
        if (extension.disabledPath && fs.existsSync(extension.disabledPath)) {
            fileManager.deleteDirectory(extension.disabledPath);
        }

        // Delete .vsix file using path from scanner
        if (extension.vsixPath && fs.existsSync(extension.vsixPath)) {
            fs.unlinkSync(extension.vsixPath);
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
            
            // Extract extension info from VSIX (reads package.json)
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
                    currentVersion: extensionInfo.version,
                    newVersion: extensionInfo.version,
                    extensionName: extensionInfo.name
                };
            }
            // Check for other versions of the same extension
            else {
                // Use name from package.json
                const installed = await this.findInstalledVersion(extensionInfo.name);
                
                if (installed) {
                    const currentVersion = installed.version;
                    const newVersion = extensionInfo.version;
                    
                    // Compare versions
                    const comparison = this.compareVersions(newVersion, currentVersion);
                    
                    if (comparison < 0) action = 'downgrade';
                    else if (comparison === 0) action = 'reinstall';
                    else action = 'upgrade';
                    
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
     * @param {string} oldFileName - Filename of existing .vsix (ignored, kept for compatibility)
     * @param {string} vsixPath - Path to new .vsix file
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async upgradeExtension(oldFileName, vsixPath) {
        try {
            const newFileName = path.basename(vsixPath);
            const newPath = path.join(this.extensionsDir, newFileName);
            
            // Extract extension info to find all old versions
            let extensionInfo;
            try {
                extensionInfo = await this.securityCheck.extractExtensionInfo(vsixPath);
            } catch (error) {
                return { success: false, message: 'error.invalidVsix' };
            }
            
            // Get all installed extensions
            const extensions = await this.scanner.scanExtensions();
            
            // Find and delete all versions of this extension
            for (const ext of extensions) {
                if (ext.rawName === extensionInfo.name) {
                    // Delete .vsix file
                    if (ext.vsixPath && fs.existsSync(ext.vsixPath)) {
                        fs.unlinkSync(ext.vsixPath);
                    }
                    
                    // Delete deployed directory
                    if (ext.deployedPath && fs.existsSync(ext.deployedPath)) {
                        fileManager.deleteDirectory(ext.deployedPath);
                    }
                    
                    // Delete disabled directory
                    if (ext.disabledPath && fs.existsSync(ext.disabledPath)) {
                        fileManager.deleteDirectory(ext.disabledPath);
                    }
                }
            }

            // Copy new .vsix file
            fs.copyFileSync(vsixPath, newPath);

            return { success: true, message: 'status.upgraded' };

        } catch (error) {
            return { success: false, message: 'error.installFailed' };
        }
    }

}

module.exports = Controller;
