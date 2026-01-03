/*
 * Extension Manager - Extension Scanner
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const fs = require('fs');
const path = require('path');
const os = require('os');
const fileManager = require('../utils/fileManager');

/**
 * Scanner - Scans and manages extension data
 * Detects installed extensions in .arduinoIDE/extensions/
 * Checks deployment status in .arduinoIDE/deployedPlugins/
 * Tracks disabled extensions in .extensionmanager/disabled/
 */
class Scanner {
    constructor() {
        this.homeDir = os.homedir();
        this.extensionsDir = path.join(this.homeDir, '.arduinoIDE', 'extensions');
        this.deployedDir = path.join(this.homeDir, '.arduinoIDE', 'deployedPlugins');
        this.disabledDir = path.join(this.homeDir, '.extensionmanager', 'disabled');
        this.managerDir = path.join(this.homeDir, '.extensionmanager');
        this.pendingFile = path.join(this.managerDir, 'pending.json');
        
        // Ensure manager directory exists
        this.ensureDirectories();
    }

    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        if (!fs.existsSync(this.managerDir)) {
            fs.mkdirSync(this.managerDir, { recursive: true, mode: 0o700 });
        }
        if (!fs.existsSync(this.disabledDir)) {
            fs.mkdirSync(this.disabledDir, { recursive: true, mode: 0o700 });
        }
    }

    /**
     * Scan all extensions and return complete list with status
     * @returns {Array} Array of extension objects
     */
    async scanExtensions() {
        const extensions = [];
        const deployedNames = new Set();
        
        try {
            // Scan deployed plugins (enabled extensions)
            if (fs.existsSync(this.deployedDir)) {
                const deployedDirs = fs.readdirSync(this.deployedDir);
                
                for (const dirName of deployedDirs) {
                    const deployedPath = path.join(this.deployedDir, dirName);
                    const stat = fs.statSync(deployedPath);
                    
                    if (stat.isDirectory()) {
                        const ext = await this.parseDeployedExtension(dirName, deployedPath);
                        if (ext) {
                            ext.status = 'enabled';
                            extensions.push(ext);
                            deployedNames.add(ext.rawName); // Track deployed names
                        }
                    }
                }
            }

            // Scan disabled extensions
            if (fs.existsSync(this.disabledDir)) {
                const disabledDirs = fs.readdirSync(this.disabledDir);
                
                for (const dirName of disabledDirs) {
                    const disabledPath = path.join(this.disabledDir, dirName);
                    const stat = fs.statSync(disabledPath);
                    
                    if (stat.isDirectory()) {
                        const ext = await this.parseDisabledExtension(dirName, disabledPath);
                        if (ext) {
                            ext.status = 'disabled';
                            extensions.push(ext);
                            deployedNames.add(ext.rawName); // Track disabled names
                        }
                    }
                }
            }

            // Scan pending.json for freshly installed extensions
            const pending = fileManager.readJsonFile(this.pendingFile);
            if (pending) {
                const updatedPending = {};
                
                for (const [name, info] of Object.entries(pending)) {
                    // If already deployed, skip it and clean from pending
                    if (deployedNames.has(name)) {
                        continue; // Don't add to updatedPending = will be removed
                    }
                    
                    // Still pending - add to list
                    extensions.push({
                        id: `${info.publisher}.${info.name}`,
                        name: info.displayName || this.formatName(info.name),
                        rawName: info.name,
                        publisher: info.publisher,
                        version: info.version,
                        description: info.description,
                        status: 'pending',
                        vsixPath: info.vsixPath,
                        size: fs.existsSync(info.vsixPath) ? fileManager.getFileSize(info.vsixPath) : 'Unknown',
                        installedDate: this.formatDate(new Date(info.installedDate))
                    });
                    
                    // Keep in updated pending
                    updatedPending[name] = info;
                }
                
                // Write back cleaned pending.json
                if (Object.keys(updatedPending).length !== Object.keys(pending).length) {
                    fileManager.writeJsonFile(this.pendingFile, updatedPending);
                }
            }

        } catch (error) {
            // Silent error handling
        }

        return extensions.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Format date as ISO 8601 string (YYYY-MM-DD HH:MM)
     * @param {Date} date - Date object
     * @returns {string} Formatted date string
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    /**
     * Parse extension data from directory (common for deployed and disabled)
     * @param {string} dirName - Directory name
     * @param {string} dirPath - Full directory path
     * @param {string} type - 'deployed' or 'disabled'
     * @returns {Object|null} Extension object or null
     */
    async parseExtension(dirName, dirPath, type) {
        try {
            const packageJsonPath = path.join(dirPath, 'extension', 'package.json');
            
            const packageJson = fileManager.readJsonFile(packageJsonPath);
            if (!packageJson) {
                return null;
            }

            // Check for uninstall.json
            const uninstallJsonPath = path.join(dirPath, 'extension', 'uninstall.json');
            const hasUninstallConfig = fs.existsSync(uninstallJsonPath);
            
            // Get installation date from directory creation time
            const stats = fs.statSync(dirPath);
            const installedDate = this.formatDate(stats.mtime);
            
            // Find corresponding .vsix file
            let vsixPath = undefined;
            const expectedVsixName = dirName + '.vsix';
            
            if (type === 'deployed') {
                const expectedPath = path.join(this.extensionsDir, expectedVsixName);
                if (fs.existsSync(expectedPath)) {
                    vsixPath = expectedPath;
                }
            } else if (type === 'disabled') {
                const expectedPath = path.join(this.disabledDir, expectedVsixName);
                if (fs.existsSync(expectedPath)) {
                    vsixPath = expectedPath;
                }
            }
            
            return {
                id: `${packageJson.publisher}.${packageJson.name}`,
                name: packageJson.displayName || this.formatName(packageJson.name),
                rawName: packageJson.name,
                publisher: packageJson.publisher,
                version: packageJson.version,
                description: packageJson.description || '',
                status: type === 'deployed' ? 'enabled' : 'disabled',
                deployedPath: type === 'deployed' ? dirPath : undefined,
                disabledPath: type === 'disabled' ? dirPath : undefined,
                vsixPath: vsixPath,
                size: fileManager.getDirectorySize(dirPath),
                hasUninstallConfig: hasUninstallConfig,
                installedDate: installedDate
            };

        } catch (error) {
            return null;
        }
    }

    /**
     * Parse extension data from deployed plugin directory
     * @param {string} dirName - Directory name
     * @param {string} dirPath - Full directory path
     * @returns {Object|null} Extension object or null
     */
    async parseDeployedExtension(dirName, dirPath) {
        return await this.parseExtension(dirName, dirPath, 'deployed');
    }

    /**
     * Parse extension data from disabled directory
     * @param {string} dirName - Directory name
     * @param {string} dirPath - Full directory path
     * @returns {Object|null} Extension object or null
     */
    async parseDisabledExtension(dirName, dirPath) {
        return await this.parseExtension(dirName, dirPath, 'disabled');
    }

    /**
     * Format extension name (replace hyphens with spaces, capitalize)
     * @param {string} name - Raw extension name
     * @returns {string} Formatted name
     */
    formatName(name) {
        return name
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Get extension by ID
     * @param {string} extensionId - Extension ID (publisher.name)
     * @returns {Object|null} Extension object or null
     */
    async getExtensionById(extensionId) {
        const extensions = await this.scanExtensions();
        return extensions.find(ext => ext.id === extensionId) || null;
    }
}

module.exports = Scanner;
