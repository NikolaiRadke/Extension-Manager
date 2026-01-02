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
            if (fs.existsSync(this.pendingFile)) {
                try {
                    const pending = JSON.parse(fs.readFileSync(this.pendingFile, 'utf8'));
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
                            size: fs.existsSync(info.vsixPath) ? this.getFileSize(info.vsixPath) : 'Unknown',
                            installedDate: this.formatDate(new Date(info.installedDate))
                        });
                        
                        // Keep in updated pending
                        updatedPending[name] = info;
                    }
                    
                    // Write back cleaned pending.json
                    if (Object.keys(updatedPending).length !== Object.keys(pending).length) {
                        fs.writeFileSync(this.pendingFile, JSON.stringify(updatedPending, null, 2), 'utf8');
                    }
                } catch (error) {
                    // Invalid JSON or read error - ignore
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
     * Parse extension data from deployed plugin directory
     * @param {string} dirName - Directory name
     * @param {string} dirPath - Full directory path
     * @returns {Object|null} Extension object or null
     */
    async parseDeployedExtension(dirName, dirPath) {
        try {
            const packageJsonPath = path.join(dirPath, 'extension', 'package.json');
            
            if (!fs.existsSync(packageJsonPath)) {
                return null;
            }

            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            // Check for uninstall.json
            const uninstallJsonPath = path.join(dirPath, 'extension', 'uninstall.json');
            const hasUninstallConfig = fs.existsSync(uninstallJsonPath);
            
            // Get installation date from directory creation time
            const stats = fs.statSync(dirPath);
            const installedDate = this.formatDate(stats.mtime);
            
            // Find corresponding .vsix file
            // Arduino IDE creates directories from vsix filenames, so try dirName + .vsix
            let vsixPath = undefined;
            const expectedVsixName = dirName + '.vsix';
            const expectedPath = path.join(this.extensionsDir, expectedVsixName);
            
            if (fs.existsSync(expectedPath)) {
                vsixPath = expectedPath;
            }
            
            return {
                id: `${packageJson.publisher}.${packageJson.name}`,
                name: packageJson.displayName || this.formatName(packageJson.name),
                rawName: packageJson.name, // Store raw name for matching
                publisher: packageJson.publisher,
                version: packageJson.version,
                description: packageJson.description || '',
                status: 'enabled',
                deployedPath: dirPath,
                vsixPath: vsixPath, // Already undefined if not found
                size: this.getDirectorySize(dirPath),
                hasUninstallConfig: hasUninstallConfig,
                installedDate: installedDate
            };

        } catch (error) {
            return null;
        }
    }

    /**
     * Parse extension data from disabled directory
     * @param {string} dirName - Directory name
     * @param {string} dirPath - Full directory path
     * @returns {Object|null} Extension object or null
     */
    async parseDisabledExtension(dirName, dirPath) {
        try {
            const packageJsonPath = path.join(dirPath, 'extension', 'package.json');
            
            if (!fs.existsSync(packageJsonPath)) {
                return null;
            }

            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            // Check for uninstall.json
            const uninstallJsonPath = path.join(dirPath, 'extension', 'uninstall.json');
            const hasUninstallConfig = fs.existsSync(uninstallJsonPath);
            
            // Get installation date from directory creation time
            const stats = fs.statSync(dirPath);
            const installedDate = this.formatDate(stats.mtime);
            
            // Find corresponding .vsix file in disabled directory
            let vsixPath = undefined;
            const expectedVsixName = dirName + '.vsix';
            const expectedPath = path.join(this.disabledDir, expectedVsixName);
            
            if (fs.existsSync(expectedPath)) {
                vsixPath = expectedPath;
            }
            
            return {
                id: `${packageJson.publisher}.${packageJson.name}`,
                name: packageJson.displayName || this.formatName(packageJson.name),
                rawName: packageJson.name, // Store raw name for matching
                publisher: packageJson.publisher,
                version: packageJson.version,
                description: packageJson.description || '',
                status: 'disabled',
                disabledPath: dirPath,
                vsixPath: vsixPath, // Already undefined if not found
                size: this.getDirectorySize(dirPath),
                hasUninstallConfig: hasUninstallConfig,
                installedDate: installedDate
            };

        } catch (error) {
            return null;
        }
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
     * Get file size in human-readable format
     * @param {string} filePath - Path to file
     * @returns {string} Formatted size
     */
    getFileSize(filePath) {
        try {
            const stats = fs.statSync(filePath);
            const bytes = stats.size;
            
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
            
        } catch (error) {
            return 'Unknown';
        }
    }

    /**
     * Get directory size recursively
     * @param {string} dirPath - Path to directory
     * @returns {string} Formatted size
     */
    getDirectorySize(dirPath) {
        try {
            let totalSize = 0;
            
            const calculateSize = (dir) => {
                const files = fs.readdirSync(dir);
                
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.isDirectory()) {
                        calculateSize(filePath);
                    } else {
                        totalSize += stats.size;
                    }
                }
            };
            
            calculateSize(dirPath);
            
            const bytes = totalSize;
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
            
        } catch (error) {
            return 'Unknown';
        }
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
