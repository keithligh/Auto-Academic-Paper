/*
 * Copyright © 2025 Keith Li <keith@keithli.com>
 *
 * This file is part of Auto Academic Paper.
 *
 * Auto Academic Paper is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Auto Academic Paper is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Auto Academic Paper. If not, see <https://www.gnu.org/licenses/>.
 */

import katex from 'katex';

/**
 * latex-to-html.ts
 * 
 * THE DIRECT OPTION
 * A robust, fault-tolerant LaTeX parser.
 */

// ==========================================
// 1. TEXT FORMATTING
// ==========================================

export const parseLatexFormatting = (text: string): string => {
    let processed = text.replace(/\\\$/g, '__DOLLAR_SIGN__');

    const mathBlocks: string[] = [];
    processed = processed.replace(/\$([^$]+)\$/g, (match, math) => {
        try {
            const html = katex.renderToString(math, { throwOnError: false, displayMode: false });
            mathBlocks.push(html);
            return `__MATH_BLOCK_${mathBlocks.length - 1}__`;
        } catch (e) {
            return match;
        }
    });

    processed = processed
        .replace(/\\([%#_{}])/g, '$1')
        .replace(/\\&/g, '&')
        .replace(/\\textbackslash/g, '\\')
        .replace(/\\textbf\{([^{}]+)\}/g, '<strong>$1</strong>')
        .replace(/\\textit\{([^{}]+)\}/g, '<em>$1</em>')
        .replace(/\\texttt\{([^{}]+)\}/g, '<code>$1</code>')
        .replace(/\\underline\{([^{}]+)\}/g, '<u>$1</u>')
        .replace(/\\emph\{([^{}]+)\}/g, '<em>$1</em>')
        .replace(/\\textsc\{([^{}]+)\}/g, '<span class="small-caps">$1</span>')
        .replace(/\\\\/g, '<br/>')
        .replace(/\\newline/g, '<br/>')
        .replace(/\\quad/g, '&emsp;')
        .replace(/\\qquad/g, '&emsp;&emsp;')
        .replace(/\\,/g, '&thinsp;')
        .replace(/\\ /g, ' ')
        // Common Symbols
        .replace(/\\bullet/g, '&#8226;')
        .replace(/\\circ/g, '&#9675;')
        .replace(/\\checkmark/g, '&#10003;')
        .replace(/\\times/g, '&times;')
        .replace(/\\approx/g, '&#8776;')
        .replace(/---/g, '&mdash;')
        .replace(/--/g, '&ndash;')
        .replace(/``/g, '&ldquo;')
        .replace(/''/g, '&rdquo;');

    processed = processed.replace(/__MATH_BLOCK_(\d+)__/g, (match, index) => {
        return mathBlocks[parseInt(index)];
    });

    processed = processed.replace(/__DOLLAR_SIGN__/g, '$');

    return processed;
};

// ==========================================
// 2. HELPERS
// ==========================================

const replaceCommand = (text: string, cmd: string, replacer: (body: string) => string): string => {
    let result = text;
    while (true) {
        const idx = result.indexOf(cmd);
        if (idx === -1) break;

        let curr = idx + cmd.length;
        while (curr < result.length && /\s/.test(result[curr])) curr++;

        if (curr < result.length && result[curr] === '[') {
            let depth = 0;
            let endOpt = -1;
            for (let j = curr; j < result.length; j++) {
                if (result[j] === '[') depth++;
                else if (result[j] === ']') depth--;
                if (depth === 0) { endOpt = j; break; }
            }
            if (endOpt !== -1) {
                curr = endOpt + 1;
                while (curr < result.length && /\s/.test(result[curr])) curr++;
            }
        }

        if (curr < result.length && result[curr] === '{') {
            let depth = 0;
            let endBrace = -1;
            for (let j = curr; j < result.length; j++) {
                if (result[j] === '{') depth++;
                else if (result[j] === '}') depth--;
                if (depth === 0) { endBrace = j; break; }
            }

            if (endBrace !== -1) {
                const body = result.substring(curr + 1, endBrace);
                const replacement = replacer(body);
                result = result.substring(0, idx) + replacement + result.substring(endBrace + 1);
            } else {
                result = result.substring(0, idx) + result.substring(idx + cmd.length);
            }
        } else {
            result = result.substring(0, idx) + result.substring(idx + cmd.length);
        }
    }
    return result;
};

const processEnvironment = (text: string, envName: string, processor: (content: string) => string): string => {
    let result = text;
    while (true) {
        const beginMarker = `\\begin{${envName}}`;
        const endMarker = `\\end{${envName}}`;
        const startIndex = result.indexOf(beginMarker);

        if (startIndex === -1) break;

        let depth = 0;
        let endIndex = -1;
        let searchIndex = startIndex;

        while (searchIndex < result.length) {
            const nextBegin = result.indexOf(beginMarker, searchIndex + 1);
            const nextEnd = result.indexOf(endMarker, searchIndex + 1);

            if (nextEnd === -1) break;

            if (nextBegin !== -1 && nextBegin < nextEnd) {
                depth++;
                searchIndex = nextBegin;
            } else {
                if (depth === 0) {
                    endIndex = nextEnd;
                    break;
                }
                depth--;
                searchIndex = nextEnd;
            }
        }

        if (endIndex !== -1) {
            const fullMatch = result.substring(startIndex, endIndex + endMarker.length);
            const replacement = processor(fullMatch);
            result = result.substring(0, startIndex) + replacement + result.substring(endIndex + endMarker.length);
        } else {
            break;
        }
    }
    return result;
};

// ==========================================
// 3. TIKZ & TABLES
// ==========================================

const renderTikz = (tikzCode: string, options: string = ''): string => {
    // Sanitize TikZ Code specifically for TikZJax limitations
    let safeTikz = tikzCode
        // Aggressive Sanitization: Strip the commands entirely if regex is failing on nesting
        // Trying to convert \textit{...} -> ... (just text) or {\itshape ...}
        // The previous regex failed on quotes/newlines. Let's try a simpler approach for TikZ:
        // Remove the command wrapper but keep content.
        .replace(/\\textbf\s*\{/g, '{\\bfseries ')
        .replace(/\\textit\s*\{/g, '{\\itshape ')
        // Also catch cases without braces if they exist (unlikely in generated code but safe to add)
        // And fix the newline issue more aggressively
        .replace(/\\n/g, ' ')
        .replace(/\n/g, ' ');

    console.log("[TikZ Debug] Original:", tikzCode.substring(0, 100));
    console.log("[TikZ Debug] Safe:", safeTikz.substring(0, 100));

    const iframeHtml = `<!DOCTYPE html>
<html><head>
<link rel="stylesheet" href="https://tikzjax.com/v1/fonts.css">
<script src="https://tikzjax.com/v1/tikzjax.js"></script>
<style>body{margin:0;padding:0;overflow:hidden;}svg{width:auto;height:auto;max-width:100%;}</style>
</head><body>
<script type="text/tikz">\\begin{tikzpicture}[scale=0.85,transform shape]${safeTikz}\\end{tikzpicture}</script>
<script>
const observer=new MutationObserver(()=>{
    const svg=document.querySelector('svg');
    if(svg&&window.frameElement){
        const rect=svg.getBoundingClientRect();
        window.frameElement.style.height=(rect.height+5)+'px';
    }
});
observer.observe(document.body,{childList:true,subtree:true});
</script></body></html>`;

    const srcdoc = iframeHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return `<div class="tikz-wrapper"><iframe srcdoc="${srcdoc}"></iframe></div>`;
};

const smartSplitRows = (text: string): string[] => {
    const res: string[] = [];
    let buf = '';
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '{') depth++;
        else if (c === '}') depth--;

        if (depth === 0 && c === '\\' && text[i + 1] === '\\') {
            const nextAfterSlashes = text[i + 2];
            const isRowBreak = nextAfterSlashes === undefined || /[\n\r \t\[\\]/.test(nextAfterSlashes);

            if (isRowBreak) {
                res.push(buf);
                buf = '';
                i++;
                continue;
            } else {
                buf += '\\';
                i++;
                continue;
            }
        }
        buf += c;
    }
    if (buf) res.push(buf);
    return res;
};

const splitCells = (row: string): string[] => {
    let normalizedRow = row.replace(/\\\\&/g, '\\&');
    const cells: string[] = [];
    let currentCell = '';
    let depth = 0;
    let i = 0;

    while (i < normalizedRow.length) {
        const char = normalizedRow[i];
        if (char === '\\') {
            currentCell += char;
            if (i + 1 < normalizedRow.length) {
                currentCell += normalizedRow[i + 1];
                i++;
            }
        } else if (char === '{') {
            depth++;
            currentCell += char;
        } else if (char === '}') {
            if (depth > 0) depth--;
            currentCell += char;
        } else if (char === '&' && depth === 0) {
            cells.push(currentCell);
            currentCell = '';
        } else {
            currentCell += char;
        }
        i++;
    }
    cells.push(currentCell);
    return cells;
};

// ==========================================
// 4. MAIN EXPORT
// ==========================================

export function convertLatexToHtml(latex: string): string {
    let content = latex || "";
    const blocks: string[] = [];

    const pushBlock = (html: string) => {
        blocks.push(html);
        return `__HTML_BLOCK_${blocks.length - 1}__`;
    };

    // Metadata
    const titleMatch = content.match(/\\title\{((?:[^{}]|{[^{}]*})*)\}/);
    const authorMatch = content.match(/\\author\{((?:[^{}]|{[^{}]*})*)\}/);
    const dateMatch = content.match(/\\date\{((?:[^{}]|{[^{}]*})*)\}/);

    let metadataHtml = '';
    if (titleMatch || authorMatch) {
        let dateStr = dateMatch ? parseLatexFormatting(dateMatch[1]) : '';
        if (dateStr.includes('\\today')) {
            dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }

        metadataHtml = `
            <div class="latex-metadata">
                ${titleMatch ? `<h1 class="title">${parseLatexFormatting(titleMatch[1])}</h1>` : ''}
                ${authorMatch ? `<div class="author">${parseLatexFormatting(authorMatch[1])}</div>` : ''}
                ${dateStr ? `<div class="date">${dateStr}</div>` : ''}
            </div>
        `;
    }

    const beginDocIndex = content.indexOf('\\begin{document}');
    if (beginDocIndex !== -1) {
        content = content.substring(beginDocIndex + '\\begin{document}'.length);
    }

    const endDocIndex = content.lastIndexOf('\\end{document}');
    if (endDocIndex !== -1) {
        content = content.substring(0, endDocIndex);
    }

    if (metadataHtml) {
        content = metadataHtml + content;
    }

    content = content.replace(/(^|\n)\s*%.*$/gm, '$1');
    content = content
        .replace(/\\maketitle/g, '')
        .replace(/\\tableofcontents/g, '')
        .replace(/\\listoffigures/g, '')
        .replace(/\\listoftables/g, '')
        .replace(/\\input\{(.*?)\}/g, '<div class="latex-warning">[Include: $1]</div>')
        .replace(/\\include\{(.*?)\}/g, '<div class="latex-warning">[Include: $1]</div>')
        .replace(/\\label\{(.*?)\}/g, '<span class="latex-debug">[Label: $1]</span>')
        .replace(/\\ref\{(.*?)\}/g, '<span class="latex-citation">[Ref: $1]</span>')
        .replace(/\\eqref\{(.*?)\}/g, '($1)')
        .replace(/\\footnote\{(.*?)\}/g, '<span class="latex-footnote"><sup>[Note: $1]</sup></span>')
        .replace(/\\url\{([^{}]*)\}/g, '<span class="url">$1</span>');

    // TikZ
    content = processEnvironment(content, 'tikzpicture', (fullMatch) => {
        const bodyRaw = fullMatch.replace(/^\\begin\{tikzpicture\}(\[.*?\])?/, '').replace(/\\end\{tikzpicture\}$/, '');
        return pushBlock(renderTikz(bodyRaw));
    });

    // Math
    content = content.replace(/\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g, (_, math) => {
        try {
            const html = katex.renderToString(math, { throwOnError: false, displayMode: true });
            return pushBlock(`<div class="equation-container">${html}</div>`);
        } catch { return pushBlock(`<div class="equation-container">$$${math}$$</div>`); }
    });
    content = content.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
        try {
            const html = katex.renderToString(math, { throwOnError: false, displayMode: true });
            return pushBlock(`<div class="equation-container">${html}</div>`);
        } catch { return pushBlock(`<div class="equation-container">$$${math}$$</div>`); }
    });

    // Tables
    const processTable = (fullMatch: string) => {
        let bodyRaw = fullMatch.replace(/^\\begin\{(tabular|tabularx)\}.*?\{.*?\}/, '').replace(/\\end\{(tabular|tabularx)\}/, '');

        // FIX (v1.9.25): Handle "Escaped Escape" Ampersands (AI Hallucination)
        // Convert `\\&` (which looks like Row Break + Ampersand) into `\&` (Escaped Ampersand).
        // This prevents "Fear \\& Greed" from splitting rows.
        bodyRaw = bodyRaw.replace(/\\\\&/g, '\\&');

        const rows = smartSplitRows(bodyRaw).filter(r => r.trim());
        let html = '<div class="table-wrapper"><table><tbody>';
        rows.forEach(row => {
            const cleanRow = row.replace(/\\hline/g, '').replace(/\\toprule/g, '').replace(/\\bottomrule/g, '').replace(/\\midrule/g, '').trim();
            if (!cleanRow) return;
            html += '<tr>';
            splitCells(cleanRow).forEach(cell => {
                html += `<td>${parseLatexFormatting(cell.trim())}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        return pushBlock(html);
    };

    content = processEnvironment(content, 'tabular', processTable);
    content = processEnvironment(content, 'tabularx', processTable);

    // Lists
    const processListBody = (body: string, type: 'ul' | 'ol'): string => {
        const items = body.split(/\\item\b/);
        let listHtml = `<${type}>`;
        for (let i = 1; i < items.length; i++) {
            let itemText = items[i].trim();
            if (itemText.includes('\\begin{itemize}')) {
                itemText = processEnvironment(itemText, 'itemize', (m) => processListBody(m.replace(/^\\begin\{itemize\}/, '').replace(/\\end\{itemize\}$/, ''), 'ul'));
            }
            if (itemText.includes('\\begin{enumerate}')) {
                itemText = processEnvironment(itemText, 'enumerate', (m) => processListBody(m.replace(/^\\begin\{enumerate\}/, '').replace(/\\end\{enumerate\}$/, ''), 'ol'));
            }
            listHtml += `<li>${parseLatexFormatting(itemText)}</li>`;
        }
        listHtml += `</${type}>`;
        return listHtml;
    };

    content = processEnvironment(content, 'itemize', (match) => {
        const body = match.replace(/^\\begin\{itemize\}/, '').replace(/\\end\{itemize\}$/, '');
        return pushBlock(processListBody(body, 'ul'));
    });
    content = processEnvironment(content, 'enumerate', (match) => {
        const body = match.replace(/^\\begin\{enumerate\}/, '').replace(/\\end\{enumerate\}$/, '');
        return pushBlock(processListBody(body, 'ol'));
    });

    // Sections
    const sectionReplacer = (tag: string) => (b: string) => pushBlock(`<${tag}>${parseLatexFormatting(b)}</${tag}>`);
    content = replaceCommand(content, '\\section*', sectionReplacer('h3'));
    content = replaceCommand(content, '\\section', sectionReplacer('h3'));
    content = replaceCommand(content, '\\subsection*', sectionReplacer('h4'));
    content = replaceCommand(content, '\\subsection', sectionReplacer('h4'));
    content = replaceCommand(content, '\\subsubsection*', sectionReplacer('h5'));
    content = replaceCommand(content, '\\subsubsection', sectionReplacer('h5'));

    // Abstract
    content = processEnvironment(content, 'abstract', (m) => {
        const body = m.replace(/\\begin\{abstract\}/, '').replace(/\\end\{abstract\}/, '');
        return pushBlock(`
            <div class="abstract">
                <div class="abstract-title">Abstract</div>
                ${parseLatexFormatting(body)}
            </div>
        `);
    });

    // Paragraphs
    content = parseLatexFormatting(content);
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
    content = paragraphs.map(p => {
        if (p.trim().match(/^__HTML_BLOCK_\d+__$/)) return p;
        return `<p>${p}</p>`;
    }).join('');

    // Restore
    let matchFound = true;
    while (matchFound) {
        matchFound = false;
        content = content.replace(/__HTML_BLOCK_(\d+)__/g, (match, index) => {
            matchFound = true;
            return blocks[parseInt(index)];
        });
    }

    return content;
}
