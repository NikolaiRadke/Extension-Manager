/*
 * Extension Manager - Sidebar View
 * Copyright 2026 Monster Maker
 *
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');
const crypto = require('crypto');

const SELF_ID = 'MonsterMaker.extension-manager';

/**
 * SidebarView - VS Code style extension list as webview in the activity bar
 */
class SidebarView {
    constructor(scanner, t, onAction) {
        this.scanner = scanner;
        this.t = t;
        this.onAction = onAction;
        this.view = null;
        this.selectedId = null;
    }

    /**
     * Called by the IDE when the view becomes visible
     * @param {vscode.WebviewView} webviewView
     */
    resolveWebviewView(webviewView) {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(this.scanner.deployedDir),
                vscode.Uri.file(this.scanner.disabledDir)
            ]
        };
        webviewView.webview.html = this.getHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async message => {
            if (message.type === 'ready') {
                await this.refresh();
            } else if (message.type === 'open') {
                this.selectedId = message.id;
            }
            if (message.type !== 'ready' && this.onAction) {
                await this.onAction(message.type, message.id);
            }
        });

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) this.refresh();
        });
    }

    /**
     * Rescan extensions and send the list to the webview
     */
    async refresh() {
        if (!this.view) return;
        const webview = this.view.webview;
        const extensions = await this.scanner.scanExtensions();

        const items = extensions.map(ext => ({
            id: ext.id,
            name: ext.name,
            publisher: ext.publisher,
            version: ext.version,
            description: ext.description,
            status: ext.status,
            isSelf: ext.id === SELF_ID,
            icon: ext.iconPath ? webview.asWebviewUri(vscode.Uri.file(ext.iconPath)).toString() : null
        }));

        webview.postMessage({ type: 'update', items, selectedId: this.selectedId });
    }

    /**
     * Build the webview HTML; the list itself is rendered by the script
     * @param {vscode.Webview} webview
     * @returns {string}
     */
    getHtml(webview) {
        const nonce = crypto.randomBytes(16).toString('base64');
        const strings = {
            search: this.t('sidebar.search'),
            noResults: this.t('sidebar.noResults'),
            empty: this.t('tree.empty'),
            enabled: this.t('tree.enabled'),
            disabled: this.t('tree.disabled'),
            pending: this.t('tree.pending'),
            enable: this.t('button.enable'),
            disable: this.t('button.disable'),
            uninstall: this.t('button.uninstall')
        };

        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
    body { padding: 0; margin: 0; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
    .search { padding: 6px 12px 8px 12px; position: sticky; top: 0; background: var(--vscode-sideBar-background); z-index: 1; }
    .search input { width: 100%; box-sizing: border-box; padding: 4px 6px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); outline: none; }
    .search input:focus { border-color: var(--vscode-focusBorder); }
    .section { display: flex; align-items: center; height: 22px; padding: 0 8px; font-size: 11px; font-weight: bold; text-transform: uppercase; cursor: pointer; user-select: none; }
    .section .chevron { width: 16px; display: inline-block; transition: transform .1s; }
    .section.collapsed .chevron { transform: rotate(-90deg); }
    .section .count { margin-left: 6px; padding: 0 6px; border-radius: 10px; font-weight: normal; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .item { display: flex; gap: 12px; padding: 6px 12px 6px 16px; cursor: pointer; }
    .item:hover { background: var(--vscode-list-hoverBackground); }
    .item.selected { background: var(--vscode-list-inactiveSelectionBackground); }
    .item.disabled .icon, .item.disabled .main { opacity: .55; }
    .icon { width: 42px; height: 42px; flex-shrink: 0; border-radius: 4px; object-fit: contain; }
    .placeholder { display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; background: var(--vscode-button-secondaryBackground, #444); color: var(--vscode-button-secondaryForeground, #fff); }
    .main { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; }
    .row { display: flex; align-items: baseline; gap: 6px; white-space: nowrap; overflow: hidden; }
    .name { font-weight: bold; overflow: hidden; text-overflow: ellipsis; }
    .version, .publisher { font-size: 12px; color: var(--vscode-descriptionForeground); }
    .desc { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .footer { display: flex; align-items: center; justify-content: space-between; height: 20px; }
    .actions { display: none; gap: 4px; }
    .item:hover .actions, .item.selected .actions { display: flex; }
    .actions button { font-size: 11px; padding: 1px 6px; border: none; cursor: pointer; color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
    .actions button:hover { background: var(--vscode-button-hoverBackground); }
    .actions button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
    .message { padding: 8px 16px; color: var(--vscode-descriptionForeground); }
</style>
</head>
<body>
<div class="search"><input id="search" type="text" placeholder="${strings.search}"></div>
<div id="list"></div>
<script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const S = ${JSON.stringify(strings)};
    const collapsed = {};
    let items = [];
    let selectedId = null;

    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function itemHtml(ext) {
        const icon = ext.icon
            ? '<img class="icon" src="' + esc(ext.icon) + '" alt="">'
            : '<div class="icon placeholder">' + esc(ext.name.charAt(0).toUpperCase()) + '</div>';
        let actions = '';
        if (!ext.isSelf && ext.status === 'enabled') actions += '<button class="secondary" data-action="disable">' + esc(S.disable) + '</button>';
        if (!ext.isSelf && ext.status === 'disabled') actions += '<button data-action="enable">' + esc(S.enable) + '</button>';
        if (!ext.isSelf) actions += '<button class="secondary" data-action="uninstall">' + esc(S.uninstall) + '</button>';
        return '<div class="item ' + ext.status + (ext.id === selectedId ? ' selected' : '') + '" data-id="' + esc(ext.id) + '">'
            + icon
            + '<div class="main">'
            + '<div class="row"><span class="name">' + esc(ext.name) + '</span><span class="version">v' + esc(ext.version) + '</span></div>'
            + '<div class="desc">' + esc(ext.description) + '</div>'
            + '<div class="footer"><span class="publisher">' + esc(ext.publisher) + '</span><span class="actions">' + actions + '</span></div>'
            + '</div></div>';
    }

    function render() {
        const query = document.getElementById('search').value.trim().toLowerCase();
        const list = document.getElementById('list');
        if (items.length === 0) { list.innerHTML = '<div class="message">' + esc(S.empty) + '</div>'; return; }

        const visible = items.filter(ext => !query
            || (ext.name + ' ' + ext.publisher + ' ' + ext.description).toLowerCase().includes(query));
        if (visible.length === 0) { list.innerHTML = '<div class="message">' + esc(S.noResults) + '</div>'; return; }

        let html = '';
        for (const status of ['pending', 'enabled', 'disabled']) {
            const group = visible.filter(ext => ext.status === status);
            if (group.length === 0) continue;
            html += '<div class="section' + (collapsed[status] ? ' collapsed' : '') + '" data-section="' + status + '">'
                + '<span class="chevron">▾</span>' + esc(S[status]) + '<span class="count">' + group.length + '</span></div>';
            if (!collapsed[status]) html += group.map(itemHtml).join('');
        }
        list.innerHTML = html;
    }

    document.getElementById('search').addEventListener('input', render);

    document.getElementById('list').addEventListener('click', event => {
        const section = event.target.closest('.section');
        if (section) {
            collapsed[section.dataset.section] = !collapsed[section.dataset.section];
            render();
            return;
        }
        const item = event.target.closest('.item');
        if (!item) return;
        const button = event.target.closest('button');
        if (button) {
            vscode.postMessage({ type: button.dataset.action, id: item.dataset.id });
            return;
        }
        selectedId = item.dataset.id;
        render();
        vscode.postMessage({ type: 'open', id: selectedId });
    });

    window.addEventListener('message', event => {
        if (event.data.type === 'update') {
            items = event.data.items;
            selectedId = event.data.selectedId ?? selectedId;
            render();
        }
    });

    vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
    }
}

module.exports = SidebarView;
