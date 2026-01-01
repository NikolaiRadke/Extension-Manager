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
        
        try {
            // Scan .vsix files in extensions directory
            if (fs.existsSync(this.extensionsDir)) {
                const vsixFiles = fs.readdirSync(this.extensionsDir)
                    .filter(file => file.endsWith('.vsix'));
                
                for (const vsixFile of vsixFiles) {
                    const ext = await this.parseVsixExtension(vsixFile, this.extensionsDir);
                    if (ext) {
                        extensions.push(ext);
                    }
                }
            }
            
            // Also scan for .vsix files in disabled directory
            if (fs.existsSync(this.disabledDir)) {
                const disabledVsixFiles = fs.readdirSync(this.disabledDir)
                    .filter(file => file.endsWith('.vsix'));
                
                for (const vsixFile of disabledVsixFiles) {
                    const ext = await this.parseVsixExtension(vsixFile, this.disabledDir);
                    if (ext) {
                        // Mark as disabled since it's in disabled directory
                        ext.status = 'disabled';
                        extensions.push(ext);
                    }
                }
            }

            // Scan deployed plugins (enabled extensions)
            if (fs.existsSync(this.deployedDir)) {
                const deployedDirs = fs.readdirSync(this.deployedDir);
                
                for (const dirName of deployedDirs) {
                    const deployedPath = path.join(this.deployedDir, dirName);
                    const stat = fs.statSync(deployedPath);
                    
                    if (stat.isDirectory()) {
                        const ext = await this.parseDeployedExtension(dirName, deployedPath);
                        if (ext) {
                            // Check if already in list from vsix scan
                            const existingIndex = extensions.findIndex(e => e.id === ext.id);
                            if (existingIndex >= 0) {
                                // Update status to enabled
                                extensions[existingIndex].status = 'enabled';
                                extensions[existingIndex].deployedPath = deployedPath;
                            } else {
                                // Add as enabled (vsix might be missing)
                                ext.status = 'enabled';
                                extensions.push(ext);
                            }
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
                            // Check if already in list
                            const existingIndex = extensions.findIndex(e => e.id === ext.id);
                            if (existingIndex >= 0) {
                                // Update status to disabled
                                extensions[existingIndex].status = 'disabled';
                                extensions[existingIndex].disabledPath = disabledPath;
                            } else {
                                // Add as disabled
                                ext.status = 'disabled';
                                extensions.push(ext);
                            }
                        }
                    }
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
     * Parse extension data from .vsix file
     * @param {string} vsixFile - Filename of .vsix
     * @param {string} directory - Directory where the .vsix is located
     * @returns {Object|null} Extension object or null
     */
    async parseVsixExtension(vsixFile, directory) {
        const vsixPath = path.join(directory, vsixFile);
        
        try {
            // Extract extension info from vsix filename
            // Format: publisher.name-version.vsix
            const match = vsixFile.match(/^(.+?)\.(.+?)-(\d+\.\d+\.\d+)\.vsix$/);
            
            if (!match) {
                return null;
            }

            const [, publisher, name, version] = match;
            const id = `${publisher}.${name}`;
            
            // Get installation date from file modified time
            const stats = fs.statSync(vsixPath);
            const installedDate = this.formatDate(stats.mtime);

            return {
                id,
                name: this.formatName(name),
                publisher,
                version,
                status: 'disabled', // Default, will be updated if found in deployedPlugins
                vsixPath,
                vsixFile,
                description: '',
                size: this.getFileSize(vsixPath),
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
            
            return {
                id: `${packageJson.publisher}.${packageJson.name}`,
                name: packageJson.displayName || this.formatName(packageJson.name),
                publisher: packageJson.publisher,
                version: packageJson.version,
                description: packageJson.description || '',
                status: 'enabled',
                deployedPath: dirPath,
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
            
            return {
                id: `${packageJson.publisher}.${packageJson.name}`,
                name: packageJson.displayName || this.formatName(packageJson.name),
                publisher: packageJson.publisher,
                version: packageJson.version,
                description: packageJson.description || '',
                status: 'disabled',
                disabledPath: dirPath,
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
