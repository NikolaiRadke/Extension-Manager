/*
 * Extension Manager - Extension Detail Page
 * Copyright 2026 Monster Maker
 *
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MarkdownRenderer = require('../utils/markdown');
const { normalizeRepository } = require('../utils/repository');

const SELF_ID = 'MonsterMaker.extension-manager';

/**
 * InfoPanel - VS Code style detail page of one extension in an editor tab
 */
class InfoPanel {
    constructor(scanner, controller, updateChecker, treeProvider, t) {
        this.scanner = scanner;
        this.controller = controller;
        this.updateChecker = updateChecker;
        this.treeProvider = treeProvider;
        this.t = t;
        this.panel = null;
        this.currentExtensionId = null;
    }

    /**
     * Show detail page for an extension
     * @param {string} extensionId - Extension ID
     */
    async show(extensionId) {
        const extension = await this.scanner.getExtensionById(extensionId);
        if (!extension) {
            vscode.window.showErrorMessage(this.t('error.notFound'));
            return;
        }
        this.currentExtensionId = extensionId;

        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Active);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'extensionInfo',
                extension.name,
                vscode.ViewColumn.Active,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.file(this.scanner.deployedDir),
                        vscode.Uri.file(this.scanner.disabledDir)
                    ]
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = null;
                this.currentExtensionId = null;
            });

            this.panel.webview.onDidReceiveMessage(message => this.handleMessage(message));
        }

        this.render(extension);
    }

    /**
     * Handle messages from the webview
     * @param {Object} message - {type, id} or {type: 'openLink', url}
     */
    async handleMessage(message) {
        const commandIds = {
            enable: 'extensionManager.enable',
            disable: 'extensionManager.disable',
            uninstall: 'extensionManager.uninstall',
            update: 'extensionManager.update'
        };
        if (commandIds[message.type]) {
            // Same confirmations as in the sidebar; the list refresh updates this page
            await vscode.commands.executeCommand(commandIds[message.type], message.id);
        } else if (message.type === 'openLink' && /^(https?:|mailto:)/i.test(message.url || '')) {
            vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
    }

    /**
     * Re-render after changes; closes the page if the extension is gone
     */
    async update() {
        if (!this.panel || !this.currentExtensionId) return;
        const extension = await this.scanner.getExtensionById(this.currentExtensionId);
        if (extension) {
            this.render(extension);
        } else {
            this.panel.dispose();
        }
    }

    /**
     * Refresh panel and list (used by the refresh command)
     */
    async refresh() {
        await this.update();
    }

    /**
     * Folder that contains the package.json of an extension
     * @param {Object} extension
     * @returns {string|null}
     */
    getExtensionFolder(extension) {
        const root = extension.deployedPath || extension.disabledPath;
        return root ? path.join(root, 'extension') : null;
    }

    /**
     * Read a markdown file (case-insensitive name) from the extension folder
     * @param {string|null} folder
     * @param {string} baseName - e.g. README.md
     * @returns {string|null}
     */
    readMarkdown(folder, baseName) {
        if (!folder || !fs.existsSync(folder)) return null;
        const file = fs.readdirSync(folder).find(name => name.toLowerCase() === baseName.toLowerCase());
        if (!file) return null;
        try {
            return fs.readFileSync(path.join(folder, file), 'utf8');
        } catch (error) {
            return null;
        }
    }

    /**
     * Set the webview HTML for an extension
     * @param {Object} extension
     */
    render(extension) {
        const webview = this.panel.webview;
        const folder = this.getExtensionFolder(extension);
        const markdown = new MarkdownRenderer(relative => {
            if (!folder) return null;
            const file = path.resolve(folder, relative.split(/[?#]/)[0]);
            // Images only from inside the extension folder
            if (!file.startsWith(folder + path.sep) || !fs.existsSync(file)) return null;
            return webview.asWebviewUri(vscode.Uri.file(file)).toString();
        });

        const readme = this.readMarkdown(folder, 'README.md');
        const changelog = this.readMarkdown(folder, 'CHANGELOG.md');
        const repository = normalizeRepository(extension.repository);
        const icon = extension.iconPath && fs.existsSync(extension.iconPath)
            ? webview.asWebviewUri(vscode.Uri.file(extension.iconPath)).toString() : null;

        this.panel.title = extension.name;
        webview.html = this.getHtml(webview, extension, {
            icon,
            repository,
            readme: readme ? markdown.render(readme) : null,
            changelog: changelog ? markdown.render(changelog) : null
        });
    }

    /**
     * Build the detail page
     * @param {vscode.Webview} webview
     * @param {Object} extension
     * @param {Object} content - icon, repository, readme, changelog
     * @returns {string}
     */
    getHtml(webview, extension, content) {
        const t = this.t;
        const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
        const nonce = crypto.randomBytes(16).toString('base64');
        const isSelf = extension.id === SELF_ID;
        const id = esc(extension.id);

        const update = this.updateChecker.get(extension.id);
        let buttons = update && extension.status !== 'pending'
            ? `<button data-action="update">${esc(t('update.buttonTo', update.version))}</button>` : '';
        if (extension.status === 'pending') {
            buttons += `<span class="note">${esc(t('tree.pending'))}</span>`;
        } else if (!isSelf) {
            const secondary = update ? ' class="secondary"' : '';
            buttons += extension.status === 'enabled'
                ? `<button data-action="disable"${secondary}>${esc(t('button.disable'))}</button>`
                : `<button data-action="enable"${secondary}>${esc(t('button.enable'))}</button>`;
            buttons += `<button data-action="uninstall"${secondary}>${esc(t('button.uninstall'))}</button>`;
            if (extension.status === 'disabled') buttons += `<span class="note">${esc(t('tree.disabled'))}</span>`;
        }

        const fact = (label, value, extraClass = '') => value
            ? `<div class="fact"><div class="label">${esc(label)}</div><div class="value ${extraClass}">${value}</div></div>` : '';

        const iconHtml = content.icon
            ? `<img class="icon" src="${esc(content.icon)}" alt="">`
            : `<div class="icon placeholder">${esc(extension.name.charAt(0).toUpperCase())}</div>`;

        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
    body { margin: 0; padding: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
    .header { display: flex; gap: 20px; padding: 20px 20px 14px 20px; }
    .icon { width: 128px; height: 128px; flex-shrink: 0; object-fit: contain; }
    .placeholder { display: flex; align-items: center; justify-content: center; font-size: 56px; font-weight: bold; border-radius: 6px; background: var(--vscode-button-secondaryBackground, #444); color: var(--vscode-button-secondaryForeground, #fff); }
    .title { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
    h1.name { margin: 0; font-size: 26px; font-weight: 600; }
    .badge { font-size: 12px; padding: 1px 6px; border-radius: 3px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .badge.update { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .subtitle { margin-top: 6px; display: flex; gap: 10px; color: var(--vscode-descriptionForeground); }
    .subtitle .sep { opacity: .5; }
    .description { margin-top: 8px; }
    .buttons { margin-top: 12px; display: flex; gap: 8px; align-items: center; }
    .buttons button { padding: 3px 10px; border: none; cursor: pointer; font-family: inherit; font-size: 12px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
    .buttons button:hover { background: var(--vscode-button-hoverBackground); }
    .buttons button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
    .note { font-size: 12px; color: var(--vscode-descriptionForeground); font-style: italic; }
    .tabs { display: flex; gap: 20px; padding: 0 20px; border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,.35)); }
    .tab { padding: 6px 0; cursor: pointer; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--vscode-descriptionForeground); border-bottom: 1px solid transparent; margin-bottom: -1px; }
    .tab.active { color: var(--vscode-foreground); border-bottom-color: var(--vscode-focusBorder); }
    .body { display: flex; gap: 30px; padding: 0 20px 30px 20px; }
    .content { flex: 1; min-width: 0; line-height: 1.5; }
    .content img { max-width: 100%; }
    .content a, .side a { color: var(--vscode-textLink-foreground); text-decoration: none; cursor: pointer; }
    .content a:hover, .side a:hover { text-decoration: underline; }
    .content code { font-family: var(--vscode-editor-font-family); font-size: 90%; padding: 1px 4px; border-radius: 3px; background: var(--vscode-textCodeBlock-background); }
    .content pre { padding: 10px 12px; overflow-x: auto; border-radius: 3px; background: var(--vscode-textCodeBlock-background); }
    .content pre code { padding: 0; background: none; }
    .content table { border-collapse: collapse; margin: 10px 0; }
    .content th, .content td { padding: 4px 10px; border: 1px solid var(--vscode-panel-border, rgba(128,128,128,.35)); }
    .content blockquote { margin: 10px 0; padding: 2px 14px; border-left: 4px solid var(--vscode-textBlockQuote-border); background: var(--vscode-textBlockQuote-background); }
    .content h1, .content h2 { padding-bottom: 4px; border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,.35)); }
    .content hr { border: none; border-top: 1px solid var(--vscode-panel-border, rgba(128,128,128,.35)); }
    .page { display: none; padding-top: 6px; }
    .page.active { display: block; }
    .empty { margin-top: 20px; color: var(--vscode-descriptionForeground); }
    .side { width: 260px; flex-shrink: 0; padding-top: 16px; }
    .side h3 { margin: 0 0 8px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
    .side section { margin-bottom: 20px; }
    .fact { display: flex; gap: 8px; margin-bottom: 4px; font-size: 12px; }
    .fact .label { width: 90px; flex-shrink: 0; color: var(--vscode-descriptionForeground); }
    .fact .value { min-width: 0; word-break: break-all; }
    .fact .ok { color: var(--vscode-charts-green, #4caf50); word-break: normal; }
    @media (max-width: 700px) { .body { flex-direction: column-reverse; } .side { width: auto; } }
</style>
</head>
<body>
<div class="header">
    ${iconHtml}
    <div>
        <div class="title"><h1 class="name">${esc(extension.name)}</h1><span class="badge">v${esc(extension.version)}</span>${update ? `<span class="badge update">v${esc(update.version)} ${esc(t('update.badgeNew'))}</span>` : ''}</div>
        <div class="subtitle"><span>${esc(extension.publisher)}</span><span class="sep">|</span><span>${id}</span></div>
        ${extension.description ? `<div class="description">${esc(extension.description)}</div>` : ''}
        <div class="buttons">${buttons}</div>
    </div>
</div>
<div class="tabs">
    <div class="tab active" data-tab="details">${esc(t('detail.tabDetails'))}</div>
    ${content.changelog ? `<div class="tab" data-tab="changelog">${esc(t('detail.tabChangelog'))}</div>` : ''}
</div>
<div class="body">
    <div class="content">
        <div class="page active" id="page-details">${content.readme || `<div class="empty">${esc(t('detail.noReadme'))}</div>`}</div>
        ${content.changelog ? `<div class="page" id="page-changelog">${content.changelog}</div>` : ''}
    </div>
    <div class="side">
        <section>
            <h3>${esc(t('detail.installation'))}</h3>
            ${fact(t('detail.identifier'), id)}
            ${fact(t('info.version'), esc(extension.version))}
            ${fact(t('info.installed'), esc(extension.installedDate))}
            ${fact(t('info.size'), esc(extension.size))}
            ${extension.hasUninstallConfig ? fact(t('info.uninstallConfig'), '✓ ' + esc(t('info.hasUninstallConfig')), 'ok') : ''}
            ${fact(t('info.location'), esc(extension.vsixPath))}
        </section>
        ${content.repository ? `<section>
            <h3>${esc(t('detail.resources'))}</h3>
            <div class="fact"><a href="${esc(content.repository)}">${esc(t('detail.repository'))}</a></div>
            ${update ? `<div class="fact"><a href="${esc(update.releaseUrl)}">${esc(t('detail.release', update.version))}</a></div>` : ''}
        </section>` : ''}
    </div>
</div>
<script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const extensionId = ${JSON.stringify(extension.id)};

    function showTab(name) {
        if (!document.getElementById('page-' + name)) name = 'details';
        document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === name));
        document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === 'page-' + name));
        vscode.setState({ tab: name, id: extensionId });
    }

    document.addEventListener('click', event => {
        const tab = event.target.closest('.tab');
        if (tab) { showTab(tab.dataset.tab); return; }

        const button = event.target.closest('button[data-action]');
        if (button) { vscode.postMessage({ type: button.dataset.action, id: extensionId }); return; }

        const link = event.target.closest('a[href]');
        if (link) {
            event.preventDefault();
            const href = link.getAttribute('href');
            if (href.startsWith('#')) {
                const target = document.getElementById(decodeURIComponent(href.slice(1)));
                if (target) target.scrollIntoView();
            } else {
                vscode.postMessage({ type: 'openLink', url: href });
            }
        }
    });

    const state = vscode.getState();
    if (state && state.id === extensionId) showTab(state.tab);
</script>
</body>
</html>`;
    }
}

module.exports = InfoPanel;
