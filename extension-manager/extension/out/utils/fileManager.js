/*
 * Extension Manager - File Manager
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const fs = require('fs');
const path = require('path');

/**
 * Delete directory recursively
 * @param {string} dirPath - Directory path to delete
 */
function deleteDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        return;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            deleteDirectory(fullPath);
        } else {
            fs.unlinkSync(fullPath);
        }
    }

    fs.rmdirSync(dirPath);
}

/**
 * Copy directory recursively
 * @param {string} source - Source directory path
 * @param {string} destination - Destination directory path
 */
function copyDirectory(source, destination) {
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }

    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);

        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Move directory from source to destination
 * @param {string} source - Source directory path
 * @param {string} destination - Destination directory path
 */
function moveDirectory(source, destination) {
    try {
        fs.renameSync(source, destination);
    } catch (error) {
        // Fallback: copy and delete
        copyDirectory(source, destination);
        deleteDirectory(source);
    }
}

/**
 * Get file size in human-readable format
 * @param {string} filePath - Path to file
 * @returns {string} Formatted size (e.g., "1.5 MB")
 */
function getFileSize(filePath) {
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
 * Get directory size recursively in human-readable format
 * @param {string} dirPath - Path to directory
 * @returns {string} Formatted size (e.g., "1.5 MB")
 */
function getDirectorySize(dirPath) {
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

module.exports = {
    deleteDirectory,
    copyDirectory,
    moveDirectory,
    getFileSize,
    getDirectorySize
};
