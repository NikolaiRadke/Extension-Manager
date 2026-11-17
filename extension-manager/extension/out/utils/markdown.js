/*
 * Extension Manager - Markdown Renderer
 * Copyright 2026 Monster Maker
 *
 * Licensed under the Apache License, Version 2.0
 *
 * Small renderer for README and CHANGELOG files of other extensions.
 * Their content is untrusted: raw HTML is reduced to a short list of
 * tags and attributes, links only allow http(s), mailto and anchors.
 */

"use strict";

const ALLOWED_TAGS = new Set([
    'a', 'b', 'i', 'em', 'strong', 'code', 'pre', 'p', 'div', 'span', 'br', 'hr', 'img',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'sub', 'sup', 'kbd',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'details', 'summary', 'picture', 'del', 's'
]);
const ALLOWED_ATTRS = new Set(['href', 'src', 'alt', 'title', 'width', 'height', 'align']);
const VOID_TAGS = new Set(['br', 'hr', 'img']);

const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

/**
 * GitHub-like heading anchor
 * @param {string} text - Heading text without markup
 * @returns {string}
 */
function slugify(text) {
    return text.toLowerCase().trim().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
}

class MarkdownRenderer {
    /**
     * @param {Function} resolveImage - Maps a relative image path to a webview URI (or null)
     */
    constructor(resolveImage) {
        this.resolveImage = resolveImage || (() => null);
    }

    /**
     * Render markdown to HTML
     * @param {string} markdown
     * @returns {string}
     */
    render(markdown) {
        const lines = String(markdown).replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n');
        return this.renderBlocks(lines);
    }

    /**
     * Clean a URL; returns null if it may not be used
     * @param {string} url
     * @param {boolean} isImage
     * @returns {string|null}
     */
    safeUrl(url, isImage) {
        const value = String(url || '').trim().replace(/^<|>$/g, '');
        if (/^https?:\/\//i.test(value)) return value;
        if (!isImage && (/^mailto:/i.test(value) || value.startsWith('#'))) return value;
        if (isImage && value && !/^[a-z][a-z0-9+.-]*:/i.test(value)) return this.resolveImage(value);
        return null;
    }

    /**
     * Reduce one raw HTML tag to the allowed subset
     * @param {string} tag - Complete tag like <img src="x" onerror="...">
     * @returns {string}
     */
    sanitizeTag(tag) {
        const match = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>$/.exec(tag);
        if (!match || !ALLOWED_TAGS.has(match[2].toLowerCase())) return '';
        const [, closing, rawName, rawAttrs] = match;
        const name = rawName.toLowerCase();
        if (closing) return VOID_TAGS.has(name) ? '' : `</${name}>`;

        let attrs = '';
        const attrPattern = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
        let attr;
        while ((attr = attrPattern.exec(rawAttrs)) !== null) {
            const attrName = attr[1].toLowerCase();
            if (!ALLOWED_ATTRS.has(attrName)) continue;
            let value = attr[3] ?? attr[4] ?? attr[5];
            if (attrName === 'href' || attrName === 'src') {
                value = this.safeUrl(value, attrName === 'src');
                if (!value) continue;
            }
            attrs += ` ${attrName}="${escapeHtml(value)}"`;
        }
        return `<${name}${attrs}>`;
    }

    /**
     * Sanitize a chunk of raw HTML: allowed tags stay, all other text is escaped
     * @param {string} html
     * @returns {string}
     */
    sanitizeHtml(html) {
        return html.split(/(<\/?[a-zA-Z][^>]*>)/g)
            .map((part, index) => index % 2 ? this.sanitizeTag(part) : this.renderInline(part))
            .join('');
    }

    /**
     * Inline markup: code, images, links, raw tags, emphasis
     * @param {string} text
     * @returns {string}
     */
    renderInline(text) {
        const stash = [];
        const keep = html => `\u0000${stash.push(html) - 1}\u0000`;

        let out = text
            .replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (m, ticks, code) => keep(`<code>${escapeHtml(code.trim())}</code>`))
            .replace(/!\[([^\]]*)\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"([^"]*)")?\s*\)/g, (m, alt, url, title) => {
                const src = this.safeUrl(url, true);
                return src ? keep(`<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${title ? ` title="${escapeHtml(title)}"` : ''}>`) : escapeHtml(alt);
            })
            .replace(/\[((?:[^\[\]]|\u0000\d+\u0000)*)\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"([^"]*)")?\s*\)/g, (m, label, url) => {
                const href = this.safeUrl(url, false);
                const inner = this.renderInline(label);
                return href ? keep(`<a href="${escapeHtml(href)}">${inner}</a>`) : keep(inner);
            })
            .replace(/<(https?:\/\/[^>\s]+)>/g, (m, url) => keep(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`))
            .replace(/<\/?[a-zA-Z][^>]*>/g, tag => keep(this.sanitizeTag(tag)));

        out = escapeHtml(out)
            .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
            .replace(/__(?=\S)([\s\S]*?\S)__/g, '<strong>$1</strong>')
            .replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\*)/g, '$1<em>$2</em>')
            .replace(/(^|[^_\w])_(?=\S)([^_]*?\S)_(?![_\w])/g, '$1<em>$2</em>')
            .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>')
            .replace(/ {2,}\n/g, '<br>\n');

        // Restore stashed parts (they may contain further placeholders)
        while (/\u0000\d+\u0000/.test(out)) {
            out = out.replace(/\u0000(\d+)\u0000/g, (m, index) => stash[Number(index)]);
        }
        return out;
    }

    /**
     * Split a table row into cells
     * @param {string} line
     * @returns {string[]}
     */
    splitRow(line) {
        return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim());
    }

    /**
     * Block level parser
     * @param {string[]} lines
     * @returns {string}
     */
    renderBlocks(lines) {
        const html = [];
        const isListItem = line => /^\s*([-*+]|\d+[.)])\s+/.test(line);
        const isBlockStart = line => /^\s*(#{1,6}\s|```|~~~|>|<[a-zA-Z/])/.test(line) || isListItem(line)
            || /^\s*([-*_])(\s*\1){2,}\s*$/.test(line);
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            if (!line.trim()) { i++; continue; }

            // Fenced code
            const fence = /^\s*(```+|~~~+)/.exec(line);
            if (fence) {
                const code = [];
                i++;
                while (i < lines.length && !lines[i].trim().startsWith(fence[1])) code.push(lines[i++]);
                i++;
                html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
                continue;
            }

            // Heading
            const heading = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
            if (heading) {
                const level = heading[1].length;
                const content = this.renderInline(heading[2]);
                html.push(`<h${level} id="${escapeHtml(slugify(heading[2]))}">${content}</h${level}>`);
                i++;
                continue;
            }

            // Horizontal rule
            if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { html.push('<hr>'); i++; continue; }

            // Blockquote
            if (/^\s*>/.test(line)) {
                const quote = [];
                while (i < lines.length && lines[i].trim() && /^\s*>/.test(lines[i])) {
                    quote.push(lines[i++].replace(/^\s*>\s?/, ''));
                }
                html.push(`<blockquote>${this.renderBlocks(quote)}</blockquote>`);
                continue;
            }

            // Table
            if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(lines[i + 1])) {
                const head = this.splitRow(line);
                const aligns = this.splitRow(lines[i + 1]).map(cell =>
                    cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : '');
                const cell = (tag, text, index) => `<${tag}${aligns[index] ? ` align="${aligns[index]}"` : ''}>${this.renderInline(text)}</${tag}>`;
                let table = `<table><thead><tr>${head.map((text, index) => cell('th', text, index)).join('')}</tr></thead><tbody>`;
                i += 2;
                while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
                    table += `<tr>${this.splitRow(lines[i++]).map((text, index) => cell('td', text, index)).join('')}</tr>`;
                }
                html.push(table + '</tbody></table>');
                continue;
            }

            // List
            if (isListItem(line)) {
                const ordered = /^\s*\d/.test(line);
                const baseIndent = line.search(/\S/);
                const items = [];
                while (i < lines.length) {
                    const current = lines[i];
                    const indent = current.search(/\S/);
                    if (current.trim() && indent === baseIndent && isListItem(current)) {
                        items.push([current.replace(/^\s*([-*+]|\d+[.)])\s+/, '')]);
                    } else if (current.trim() && indent > baseIndent) {
                        items[items.length - 1].push(current.slice(Math.min(indent, baseIndent + 4)));
                    } else if (!current.trim() && i + 1 < lines.length && lines[i + 1].search(/\S/) > baseIndent) {
                        items[items.length - 1].push('');
                    } else if (current.trim() && indent < 0 + baseIndent + 1 && !isListItem(current) && !isBlockStart(current) && lines[i - 1].trim()) {
                        items[items.length - 1].push(current.trim()); // lazy continuation
                    } else {
                        break;
                    }
                    i++;
                }
                const tag = ordered ? 'ol' : 'ul';
                const itemsHtml = items.map(itemLines => {
                    let content = this.renderBlocks(itemLines);
                    const single = /^<p>([\s\S]*?)<\/p>/.exec(content);
                    if (single && content.indexOf('<p>', 1) === -1) content = single[1] + content.slice(single[0].length);
                    const task = /^\[([ xX])\]\s*/.exec(content);
                    if (task) content = `<input type="checkbox" disabled${task[1] !== ' ' ? ' checked' : ''}> ` + content.slice(task[0].length);
                    return `<li>${content}</li>`;
                }).join('');
                html.push(`<${tag}>${itemsHtml}</${tag}>`);
                continue;
            }

            // Raw HTML block
            if (/^\s*<[a-zA-Z/]/.test(line)) {
                const block = [];
                while (i < lines.length && lines[i].trim()) block.push(lines[i++]);
                html.push(this.sanitizeHtml(block.join('\n')));
                continue;
            }

            // Paragraph
            const paragraph = [];
            while (i < lines.length && lines[i].trim() && (paragraph.length === 0 || !isBlockStart(lines[i]))) {
                paragraph.push(lines[i++]);
            }
            html.push(`<p>${this.renderInline(paragraph.join('\n'))}</p>`);
        }

        return html.join('\n');
    }
}

module.exports = MarkdownRenderer;
