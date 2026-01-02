/*
 * Extension Manager - Locale Loader
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let translations = {};
let currentLocale = 'en';

/**
 * Load translations based on VS Code language setting
 * Auto-detects IDE language and loads appropriate locale file
 * Falls back to en.json if locale file not found
 */
async function loadTranslations() {
    // Get VS Code language (e.g., "de", "en", "fr")
    const vscodeLocale = vscode.env.language || 'en';
    
    // Extract language code (e.g., "de-DE" -> "de")
    currentLocale = vscodeLocale.split('-')[0];
    
    // Try to load locale file
    const localeFile = path.join(__dirname, '..', '..', 'locales', `${currentLocale}.json`);
    const fallbackFile = path.join(__dirname, '..', '..', 'locales', 'en.json');
    
    let loadedFile = null;
    
    // Try current locale first
    if (fs.existsSync(localeFile)) {
        loadedFile = localeFile;
    } else if (fs.existsSync(fallbackFile)) {
        // Fallback to English
        loadedFile = fallbackFile;
        currentLocale = 'en';
    }
    
    if (loadedFile) {
        try {
            const content = fs.readFileSync(loadedFile, 'utf8');
            translations = JSON.parse(content);
        } catch (error) {
            // If parsing fails, use empty object
            translations = {};
        }
    } else {
        translations = {};
    }
}

/**
 * Get translated string with parameter replacement
 * @param {string} key - Translation key
 * @param {...any} args - Arguments for placeholder replacement {0}, {1}, etc.
 * @returns {string} Translated string or key if not found
 */
function t(key, ...args) {
    let text = translations[key] || key;
    
    // Replace placeholders {0}, {1}, etc. with arguments
    args.forEach((arg, index) => {
        text = text.replace(`{${index}}`, arg);
    });
    
    return text;
}

/**
 * Get current locale code
 * @returns {string} Current locale (e.g., "de", "en")
 */
function getCurrentLocale() {
    return currentLocale;
}

module.exports = {
    loadTranslations,
    t,
    getCurrentLocale
};
