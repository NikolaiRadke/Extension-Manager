/*
 * Extension Manager - Repository URL helpers
 * Copyright 2026 Monster Maker
 *
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

/**
 * Turn package.json repository URLs into a browsable https URL
 * (git+https://..., git@github.com:..., github:owner/repo, owner/repo)
 * @param {string} url
 * @returns {string|null}
 */
function normalizeRepository(url) {
    if (!url || typeof url !== 'string') return null;
    let value = url.trim().replace(/^git\+/, '').replace(/\.git$/, '').replace(/\/$/, '');
    value = value.replace(/^git@([^:]+):/, 'https://$1/').replace(/^(git|ssh):\/\/(git@)?/, 'https://');
    if (/^github:/.test(value)) value = value.replace(/^github:/, 'https://github.com/');
    if (/^[\w.-]+\/[\w.-]+$/.test(value)) value = `https://github.com/${value}`;
    return /^https?:\/\//.test(value) ? value : null;
}

/**
 * Owner and name of a GitHub repository
 * @param {string} url - Any repository URL form
 * @returns {{owner: string, repo: string}|null}
 */
function parseGitHub(url) {
    const match = /^https?:\/\/(www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i.exec(normalizeRepository(url) || '');
    return match ? { owner: match[2], repo: match[3] } : null;
}

module.exports = { normalizeRepository, parseGitHub };
