/*
 * Extension Manager - Update Checker
 * Copyright 2026 Monster Maker
 *
 * Licensed under the Apache License, Version 2.0
 *
 * Looks for newer releases of installed extensions on GitHub. An update
 * needs a GitHub repository in the extension's package.json and a .vsix
 * file attached to the latest release.
 */

"use strict";

const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseGitHub } = require('../utils/repository');

const CACHE_KEY = 'extensionManager.updateCache';
const CACHE_TTL = 6 * 60 * 60 * 1000;   // Unauthenticated GitHub API: 60 requests per hour
const TIMEOUT = 15000;
const MAX_REDIRECTS = 5;
const USER_AGENT = 'Arduino-Extension-Manager';

class RateLimitError extends Error {}

/**
 * Simple https GET that follows redirects
 * @param {string} url
 * @param {Object} headers
 * @param {string|null} targetFile - Write body to this file instead of returning it
 * @param {number} redirects - Remaining redirects
 * @returns {Promise<{status: number, body: string|null}>}
 */
function get(url, headers, targetFile = null, redirects = MAX_REDIRECTS) {
    return new Promise((resolve, reject) => {
        if (!url.startsWith('https://')) {
            reject(new Error('Only https is allowed'));
            return;
        }
        const request = https.get(url, { headers: { 'User-Agent': USER_AGENT, ...headers }, timeout: TIMEOUT }, response => {
            const { statusCode, headers: responseHeaders } = response;

            if ([301, 302, 303, 307, 308].includes(statusCode) && responseHeaders.location) {
                response.resume();
                if (redirects <= 0) {
                    reject(new Error('Too many redirects'));
                    return;
                }
                const next = new URL(responseHeaders.location, url).toString();
                resolve(get(next, headers, targetFile, redirects - 1));
                return;
            }

            if (statusCode === 403 && responseHeaders['x-ratelimit-remaining'] === '0') {
                response.resume();
                reject(new RateLimitError('GitHub rate limit'));
                return;
            }

            if (targetFile && statusCode === 200) {
                const stream = fs.createWriteStream(targetFile);
                response.pipe(stream);
                stream.on('finish', () => stream.close(() => resolve({ status: statusCode, body: null })));
                stream.on('error', reject);
                return;
            }

            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => resolve({ status: statusCode, body }));
        });
        request.on('timeout', () => request.destroy(new Error('Timeout')));
        request.on('error', reject);
    });
}

/**
 * Plain x.y.z from a tag like "v1.2.3" or "release-1.2.3"
 * @param {string} tag
 * @returns {string|null}
 */
function versionFromTag(tag) {
    const match = /(\d+)(\.\d+){0,2}/.exec(tag || '');
    return match ? match[0] : null;
}

class UpdateChecker {
    /**
     * @param {vscode.ExtensionContext} context - For the cache in globalState
     * @param {Object} scanner - Scanner instance
     * @param {Object} controller - Controller instance (version compare)
     */
    constructor(context, scanner, controller) {
        this.context = context;
        this.scanner = scanner;
        this.controller = controller;
        this.updates = new Map();
        this.listeners = [];
        this.checking = null;
    }

    /**
     * Register a callback for changed update lists
     * @param {Function} listener
     */
    onDidChange(listener) {
        this.listeners.push(listener);
    }

    /**
     * Update info for an extension
     * @param {string} extensionId
     * @returns {Object|undefined} {version, assetName, downloadUrl, releaseUrl}
     */
    get(extensionId) {
        return this.updates.get(extensionId);
    }

    /**
     * Forget an update (e.g. after it was installed)
     * @param {string} extensionId
     */
    clear(extensionId) {
        if (this.updates.delete(extensionId)) {
            this.listeners.forEach(listener => listener());
        }
    }

    /**
     * Check all installed extensions; parallel calls share one run
     * @param {boolean} force - Ignore the cache
     * @returns {Promise<{count: number, rateLimited: boolean}>}
     */
    check(force = false) {
        if (!this.checking) {
            this.checking = this.runCheck(force).finally(() => { this.checking = null; });
        }
        return this.checking;
    }

    async runCheck(force) {
        const extensions = (await this.scanner.scanExtensions()).filter(ext => ext.status !== 'pending');
        const cache = this.context.globalState.get(CACHE_KEY, {});
        const updates = new Map();
        let rateLimited = false;

        for (const ext of extensions) {
            const github = parseGitHub(ext.repository);
            if (!github) continue;
            const key = `${github.owner}/${github.repo}`.toLowerCase();

            let entry = cache[key];
            if (force || !entry || Date.now() - entry.checkedAt > CACHE_TTL) {
                if (rateLimited) continue;
                try {
                    entry = { checkedAt: Date.now(), release: await this.fetchLatestRelease(github) };
                    cache[key] = entry;
                } catch (error) {
                    if (error instanceof RateLimitError) rateLimited = true;
                    console.log(`Extension Manager: update check for ${key} failed: ${error.message}`);
                    continue;
                }
            }

            const release = entry.release;
            const version = release && versionFromTag(release.tag);
            if (!version || this.controller.compareVersions(version, versionFromTag(ext.version) || ext.version) <= 0) continue;

            const vsixAssets = release.assets.filter(asset => asset.name.toLowerCase().endsWith('.vsix'));
            const asset = vsixAssets.find(item => item.name.toLowerCase().includes(ext.rawName.toLowerCase())) || vsixAssets[0];
            if (!asset) continue;

            updates.set(ext.id, {
                version,
                assetName: asset.name,
                downloadUrl: asset.url,
                releaseUrl: release.url
            });
        }

        await this.context.globalState.update(CACHE_KEY, cache);
        this.updates = updates;
        this.listeners.forEach(listener => listener());
        return { count: updates.size, rateLimited };
    }

    /**
     * Latest (non-prerelease) release of a repository, reduced to what we need
     * @param {{owner: string, repo: string}} github
     * @returns {Promise<Object|null>} null if the repository has no releases
     */
    async fetchLatestRelease(github) {
        const url = `https://api.github.com/repos/${encodeURIComponent(github.owner)}/${encodeURIComponent(github.repo)}/releases/latest`;
        const { status, body } = await get(url, { Accept: 'application/vnd.github+json' });
        if (status === 404) return null;
        if (status !== 200) throw new Error(`HTTP ${status}`);

        const data = JSON.parse(body);
        return {
            tag: data.tag_name,
            url: data.html_url,
            assets: (data.assets || []).map(asset => ({ name: asset.name, url: asset.browser_download_url }))
        };
    }

    /**
     * Download the .vsix of an update into a temporary folder
     * @param {string} extensionId
     * @returns {Promise<string>} Path to the downloaded file
     */
    async download(extensionId) {
        const update = this.updates.get(extensionId);
        if (!update) throw new Error('No update');

        const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'extension-manager-'));
        const target = path.join(folder, path.basename(update.assetName));
        const { status } = await get(update.downloadUrl, { Accept: 'application/octet-stream' }, target);
        if (status !== 200 || !fs.existsSync(target)) {
            fs.rmSync(folder, { recursive: true, force: true });
            throw new Error(`HTTP ${status}`);
        }
        return target;
    }
}

module.exports = UpdateChecker;
module.exports.RateLimitError = RateLimitError;
