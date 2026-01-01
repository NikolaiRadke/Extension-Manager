/*
 * Extension Manager - Security Check
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const fs = require('fs');
const path = require('path');
const os = require('os');
const { t } = require('../utils/localeLoader');

/**
 * SecurityCheck - Scans VSIX files for suspicious patterns
 */
class SecurityCheck {
    constructor() {
        this.checkDir = path.join(os.homedir(), '.extensionmanager', 'check');
        this.ensureCheckDirectory();
        
        this.suspiciousPatterns = [
            {
                pattern: /os\.homedir\(\).*['"](\.ssh|\.aws|\.gnupg|Documents|Desktop|Downloads)/,
                message: 'security.suspiciousPath',
                severity: 'high'
            },
            {
                pattern: /child_process\.(exec|spawn|execFile|fork)\s*\(/,
                message: 'security.codeExecution',
                severity: 'high'
            },
            {
                pattern: /eval\s*\(/,
                message: 'security.evalFound',
                severity: 'critical'
            },
            {
                pattern: /Function\s*\(\s*['"`]/,
                message: 'security.dynamicFunction',
                severity: 'critical'
            },
            {
                // Search for URLs in strings, but NOT in regex literals or HTML href
                pattern: /(?<![\/\\=])['"`]https?:\/\/(?!.*\.(github|githubusercontent|vscode|microsoft|arduino|npmjs|cloudflare)\.)/,
                message: 'security.unknownNetwork',
                severity: 'medium'
            },
            {
                pattern: /\.unlinkSync|\.rmdirSync|\.rmSync.*recursive/,
                message: 'security.fileDelete',
                severity: 'medium'
            },
            {
                pattern: /require\s*\(\s*['"`]https?:/,
                message: 'security.remoteRequire',
                severity: 'critical'
            }
        ];
        
        // Whitelist 
        this.allowedPaths = [
            /\.vscode/,
            /\.arduinoIDE/,
            /\.extensionmanager/,
            /\.[a-z]+(?:plus|ide|manager|helper)/i
        ];
    }

    /**
     * Ensure check directory exists
     */
    ensureCheckDirectory() {
        if (!fs.existsSync(this.checkDir)) {
            fs.mkdirSync(this.checkDir, { recursive: true, mode: 0o700 });
        }
    }

    /**
     * Scan VSIX file for security issues
     * @param {string} vsixPath - Path to .vsix file
     * @returns {Promise<{safe: boolean, issues: Array, details: string}>}
     */
    async scanVsix(vsixPath) {
        const tempDir = path.join(this.checkDir, 'temp-' + Date.now());
        
        try {
            const checkVsix = path.join(this.checkDir, path.basename(vsixPath));
            fs.copyFileSync(vsixPath, checkVsix);            
            await this.extractVsix(checkVsix, tempDir);

            const issues = await this.scanExtractedCode(tempDir);
            
            const packageIssues = await this.checkPackageJson(tempDir);
            issues.push(...packageIssues);
            
            // Extract extension name from package.json
            let extensionName = null;
            const packageJsonPath = path.join(tempDir, 'extension', 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                try {
                    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                    extensionName = pkg.displayName || pkg.name;
                } catch (e) {}
            }
            
            // 5. Check file size
            const sizeIssue = this.checkFileSize(vsixPath);
            if (sizeIssue) {
                issues.push(sizeIssue);
            }
            
            
            return {
                safe: issues.length === 0,
                issues: issues,
                details: issues.map(i => i.message).join('\n'),
                extensionName: extensionName
            };
            
        } catch (error) {
            console.error('[SecurityCheck] ERROR during scan:', error.message);
            throw error;
        } finally {
            // Cleanup
            this.cleanup(tempDir);
        }
    }

    /**
     * Extract VSIX file (which is a ZIP archive)
     * @param {string} vsixPath - Path to VSIX file
     * @param {string} targetDir - Target directory
     */
    async extractVsix(vsixPath, targetDir) {
        
        const { execSync } = require('child_process');
        
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        try {
            // Try unzip (Linux/Mac)
            execSync(`unzip -q "${vsixPath}" -d "${targetDir}"`, { stdio: 'ignore' });
        } catch (error) {
            try {
                // Fallback: tar (Windows 10+, Linux, Mac)
                execSync(`tar -xf "${vsixPath}" -C "${targetDir}"`, { stdio: 'ignore' });
            } catch (tarError) {
                console.error('[SecurityCheck] Both unzip and tar failed');
                throw new Error('Could not extract VSIX. unzip/tar not available.');
            }
        }
    }

    /**
     * Scan all JavaScript files in extracted extension
     * @param {string} extractedPath - Path to extracted extension
     * @returns {Promise<Array>} Array of issues found
     */
    async scanExtractedCode(extractedPath) {
        const issues = [];
        const jsFiles = this.findJsFiles(extractedPath);
        
        
        for (const file of jsFiles) {
            try {
                const content = fs.readFileSync(file, 'utf8');
                const relativePath = path.relative(extractedPath, file);
                
                // Check each suspicious pattern
                for (const check of this.suspiciousPatterns) {
                    const matches = content.match(check.pattern);
                    
                    if (matches) {
                        // For path access: Check if whitelisted
                        if (check.message === 'security.suspiciousPath') {
                            if (this.isAllowedPath(content, matches[0])) {
                                continue;
                            }
                        }
                        
                        
                        issues.push({
                            severity: check.severity,
                            message: check.message,
                            file: relativePath,
                            match: matches[0].substring(0, 100),
                            fullContent: content
                        });
                    }
                }
                
                // Additionally: Check for obfuscated code
                if (this.isObfuscated(content)) {
                    issues.push({
                        severity: 'high',
                        message: 'security.obfuscatedCode',
                        file: relativePath
                    });
                }
                
            } catch (error) {
                // Ignore files that can't be read
            }
        }
        
        return issues;
    }

    /**
     * Check if path access is in allowed whitelist
     * @param {string} content - File content
     * @param {string} match - Matched string
     * @returns {boolean} True if allowed
     */
    isAllowedPath(content, match) {
        for (const allowedPattern of this.allowedPaths) {
            if (allowedPattern.test(match)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if code appears to be obfuscated
     * @param {string} content - JavaScript code
     * @returns {boolean} True if likely obfuscated
     */
    isObfuscated(content) {
        const indicators = [
            /_0x[0-9a-f]{4,}/i,  // Hex variables
            /\\x[0-9a-f]{2}/i,    // Hex escapes
            /eval\(.*atob/,       // base64 eval
            /\[['"][a-z]{1,2}['"]\]/g // Single letter array access
        ];
        
        let suspicionCount = 0;
        for (const indicator of indicators) {
            if (indicator.test(content)) {
                suspicionCount++;
            }
        }
        
        return suspicionCount >= 2;
    }

    /**
     * Check package.json for suspicious dependencies
     * @param {string} extractedPath - Path to extracted extension
     * @returns {Promise<Array>} Array of issues found
     */
    async checkPackageJson(extractedPath) {
        const issues = [];
        const packageJsonPath = path.join(extractedPath, 'extension', 'package.json');
        
        if (!fs.existsSync(packageJsonPath)) {
            return issues;
        }
        
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            // Check dependencies
            const allDeps = {
                ...packageJson.dependencies,
                ...packageJson.devDependencies
            };
            
            const suspiciousDeps = [
                'keytar',
                'node-keytar',
                'ssh2',
                'ssh-exec'
            ];
            
            for (const dep of suspiciousDeps) {
                if (allDeps[dep]) {
                    issues.push({
                        severity: 'medium',
                        message: 'security.suspiciousDependency',
                        details: dep
                    });
                }
            }
            
        } catch (error) {
            // Ignore invalid package.json
        }
        
        return issues;
    }

    /**
     * Check file size (very large extensions could be suspicious)
     * @param {string} vsixPath - Path to VSIX file
     * @returns {Object|null} Issue object or null
     */
    checkFileSize(vsixPath) {
        const stats = fs.statSync(vsixPath);
        const sizeMB = stats.size / (1024 * 1024);
        
        if (sizeMB > 50) {
            return {
                severity: 'low',
                message: 'security.largeFile',
                details: `${sizeMB.toFixed(1)} MB`
            };
        }
        
        return null;
    }

    /**
     * Find all JavaScript files recursively
     * @param {string} dir - Directory to search
     * @returns {Array} Array of file paths
     */
    findJsFiles(dir) {
        const jsFiles = [];
        
        const scan = (currentDir) => {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                
                if (entry.isDirectory()) {
                    // Skip node_modules
                    if (entry.name !== 'node_modules') {
                        scan(fullPath);
                    }
                } else if (entry.name.endsWith('.js')) {
                    jsFiles.push(fullPath);
                }
            }
        };
        
        scan(dir);
        return jsFiles;
    }

    /**
     * Cleanup temporary files
     * @param {string} tempDir - Temporary directory to delete
     */
    cleanup(tempDir) {
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            
            const checkFiles = fs.readdirSync(this.checkDir);
            for (const file of checkFiles) {
                const filePath = path.join(this.checkDir, file);
                if (file.endsWith('.vsix')) {
                    fs.unlinkSync(filePath);
                }
            }
        } catch (error) {
            // Silent fail
        }
    }

    /**
     * Format scan result for display
     * @param {Object} scanResult - Result from scanVsix()
     * @returns {string} Formatted message
     */
    formatResult(scanResult) {
        if (scanResult.safe) {
            return '✅ No security issues found';
        }
        
        const lines = ['⚠️ Security issues detected:\n'];
        
        // Group by severity
        const critical = scanResult.issues.filter(i => i.severity === 'critical');
        const high = scanResult.issues.filter(i => i.severity === 'high');
        const medium = scanResult.issues.filter(i => i.severity === 'medium');
        const low = scanResult.issues.filter(i => i.severity === 'low');
        
        if (critical.length > 0) {
            lines.push(`🚨 CRITICAL (${critical.length}):`);
            critical.forEach(i => lines.push(`  - ${i.message}${i.file ? ` in ${i.file}` : ''}`));
        }
        
        if (high.length > 0) {
            lines.push(`⚠️  HIGH (${high.length}):`);
            high.forEach(i => lines.push(`  - ${i.message}${i.file ? ` in ${i.file}` : ''}`));
        }
        
        if (medium.length > 0) {
            lines.push(`⚡ MEDIUM (${medium.length}):`);
            medium.forEach(i => lines.push(`  - ${i.message}${i.file ? ` in ${i.file}` : ''}`));
        }
        
        if (low.length > 0) {
            lines.push(`ℹ️  LOW (${low.length}):`);
            low.forEach(i => lines.push(`  - ${i.message}${i.file ? ` in ${i.file}` : ''}`));
        }
        
        return lines.join('\n');
    }

    /**
     * Format scan result for user-friendly display
     * Groups issues by category and extracts paths
     * @param {Object} scanResult - Result from scanVsix()
     * @param {string} extensionName - Name of the extension being scanned
     * @returns {string} User-friendly formatted message
     */
    /**
     * Format scan result for user-friendly display
     * Groups issues by severity level
     * @param {Object} scanResult - Result from scanVsix()
     * @param {string} extensionName - Name of the extension being scanned
     * @returns {string} User-friendly formatted message
     */
    formatUserFriendly(scanResult, extensionName = 'Extension') {
        if (scanResult.safe) {
            return `✅ ${t('security.noIssues')}`;
        }

        const lines = [];

        // Add legend
        lines.push(t('security.severity.legend'));
        lines.push('');
        
        // Group by severity
        const critical = scanResult.issues.filter(i => i.severity === 'critical');
        const high = scanResult.issues.filter(i => i.severity === 'high');
        const medium = scanResult.issues.filter(i => i.severity === 'medium');
        const low = scanResult.issues.filter(i => i.severity === 'low');
        
        // Helper function to group and display issues
        const displayIssues = (issues) => {
            // Group by message type
            const grouped = {};
            issues.forEach(issue => {
                if (!grouped[issue.message]) {
                    grouped[issue.message] = [];
                }
                grouped[issue.message].push(issue);
            });
            
            // Display each group
            Object.keys(grouped).forEach(messageKey => {
                const issueGroup = grouped[messageKey];
                
                // Collect all details from all issues of this type
                const allPaths = new Set();
                let hasDetails = false;
                
                issueGroup.forEach(issue => {
                    const description = this.getIssueDescription(issue);
                    if (Array.isArray(description)) {
                        // Has sub-items (paths)
                        hasDetails = true;
                        description.slice(1).forEach(path => allPaths.add(path));
                    }
                });
                
                // Get the main description (without paths)
                const mainDesc = this.getIssueDescriptionLabel(issueGroup[0]);
                
                // Display main item
                lines.push(`   • ${mainDesc}`);
                
                // Display all collected paths as sub-items
                if (allPaths.size > 0) {
                    Array.from(allPaths).sort().forEach(path => {
                        lines.push(`     - ${path}`);
                    });
                }
            });
        };
        
        // CRITICAL
        if (critical.length > 0) {
            lines.push(`🚨 ${t('security.severity.critical')}`);
            displayIssues(critical);
            lines.push('');
        }
        
        // HIGH
        if (high.length > 0) {
            lines.push(`⚠️  ${t('security.severity.high')}`);
            displayIssues(high);
            lines.push('');
        }
        
        // MEDIUM
        if (medium.length > 0) {
            lines.push(`⚡ ${t('security.severity.medium')}`);
            displayIssues(medium);
            lines.push('');
        }
        
        // LOW
        if (low.length > 0) {
            lines.push(`ℹ️  ${t('security.severity.low')}`);
            displayIssues(low);
            lines.push('');
        }
        
        return lines.join('\n');
    }

    /**
     * Get just the label/description without paths (for grouping)
     * @param {Object} issue - Security issue object
     * @returns {string} Description label
     */
    getIssueDescriptionLabel(issue) {
        const descKey = issue.message.replace('security.', 'security.desc.');
        let desc = t(descKey);
        if (desc === descKey) {
            desc = t(issue.message) || issue.message;
        }
        
        // Add inline details (not paths)
        if (issue.message === 'security.suspiciousPath' && issue.match) {
            const pathMatch = issue.match.match(/['"](\.ssh|\.aws|\.gnupg|Documents|Desktop|Downloads)['"]/);
            if (pathMatch) {
                desc += ': ~/' + pathMatch[1];
            }
        } else if (issue.details) {
            desc += ` (${issue.details})`;
        }
        
        return desc;
    }

    /**
     * Get user-friendly description for a security issue
     * @param {Object} issue - Security issue object
     * @returns {string|Array} Description (string or array with sub-items)
     */
    getIssueDescription(issue) {
        // Map message key to description key
        const descKey = issue.message.replace('security.', 'security.desc.');
        
        // Try to get translated description
        let desc = t(descKey);
        
        // Fallback to original message if no translation
        if (desc === descKey) {
            desc = t(issue.message) || issue.message;
        }
        
        // Add specific details based on issue type
        if (issue.message === 'security.fileDelete' && issue.fullContent) {
            // Extract directory paths
            const directories = new Set();
            const pathMatches = issue.fullContent.matchAll(/(?<![\\/])['"`](\.[\w]+)(?:[\-\\/]|['"`])/g);
            for (const match of pathMatches) {
                const dirName = match[1].substring(1);
                if (dirName.length >= 5) {
                    directories.add('~/' + dirName);
                }
            }
            if (directories.size > 0) {
                // Return array: [main description, ...sub-items]
                return [desc, ...Array.from(directories).sort()];
            }
        } else if (issue.message === 'security.suspiciousPath' && issue.match) {
            // Extract specific sensitive path
            const pathMatch = issue.match.match(/['"](\.ssh|\.aws|\.gnupg|Documents|Desktop|Downloads)['"]/);
            if (pathMatch) {
                desc += ': ~/' + pathMatch[1];
            }
        } else if (issue.details) {
            // Generic details (like file size)
            desc += ` (${issue.details})`;
        }
        
        return desc;
    }
    /**
     * Extract extension information from VSIX file
     * @param {string} vsixPath - Path to VSIX file
     * @returns {Promise<Object>} Extension metadata
     */
    async extractExtensionInfo(vsixPath) {
        const checkDir = path.join(this.checkDir, 'info-extract-' + Date.now());
        
        try {
            // Create temp directory
            if (!fs.existsSync(checkDir)) {
                fs.mkdirSync(checkDir, { recursive: true });
            }
            
            // Copy VSIX
            const vsixFileName = path.basename(vsixPath);
            const tempVsixPath = path.join(this.checkDir, vsixFileName);
            fs.copyFileSync(vsixPath, tempVsixPath);
            
            // Extract
            await this.extractVsix(tempVsixPath, checkDir);
            
            // Read package.json
            const packageJsonPath = path.join(checkDir, 'extension', 'package.json');
            if (!fs.existsSync(packageJsonPath)) {
                throw new Error('package.json not found');
            }
            
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            // Get file size
            const stats = fs.statSync(vsixPath);
            const bytes = stats.size;
            let size = '';
            if (bytes < 1024) size = bytes + ' B';
            else if (bytes < 1024 * 1024) size = (bytes / 1024).toFixed(1) + ' KB';
            else size = (bytes / (1024 * 1024)).toFixed(1) + ' MB';
            
            // Cleanup
            this.cleanup(checkDir);
            if (fs.existsSync(tempVsixPath)) {
                fs.unlinkSync(tempVsixPath);
            }
            
            return {
                name: pkg.displayName || pkg.name,
                version: pkg.version,
                publisher: pkg.publisher,
                description: pkg.description || '',
                size: size
            };
            
        } catch (error) {
            // Cleanup on error
            this.cleanup(checkDir);
            throw error;
        }
    }

    /**
     * Format complete installation dialog with extension info and security check
     * @param {Object} extensionInfo - Extension metadata from VSIX
     * @param {Object} scanResult - Security scan result
     * @param {string} action - 'install', 'upgrade', 'downgrade', 'reinstall'
     * @returns {string} Complete formatted message for installation dialog
     */
}

module.exports = SecurityCheck;
