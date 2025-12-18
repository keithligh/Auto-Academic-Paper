/**
 * Math Engine for LaTeX Preview
 * 
 * EXTRACTED FROM: LatexPreview.tsx
 * SCOPE: Math extraction, sanitization, and KaTeX rendering.
 * RULE: EXACT COPY of logic. Do not modernize.
 */

import katex from 'katex';

export interface MathResult {
    sanitized: string;
    blocks: Record<string, string>;
}

export function processMath(latex: string, macros: Record<string, string> = {}): MathResult {
    let content = latex;
    const blocks: Record<string, string> = {};
    let blockCount = 0;

    // === HELPER: Create KaTeX math block ===
    const createMathBlock = (mathContent: string, displayMode: boolean): string => {
        const id = `LATEXPREVIEWMATH${blockCount++}:`;
        try {
            let html = katex.renderToString(mathContent, {
                displayMode,
                throwOnError: false,
                strict: false,
                macros: {
                    "\\eqref": "\\href{#1}{#1}",
                    "\\label": "\\phantom{}",
                    "\\textsc": "\\text{#1}", // FIX (v1.9.140): Polyfill for textsc in math mode
                    ...macros
                }
            });

            // STRATEGY: Auto-scale long SINGLE-LINE equations to fit container
            // CRITICAL: Do NOT scale multi-line environments (align*, gather*, etc.)
            // because they grow VERTICALLY, not horizontally.
            // EXCEPTION (v1.9.31): Arrays behave like tables (grow Horizontally). We MUST scale them.
            if (displayMode) {
                const lineCount = (mathContent.match(/\\\\/g) || []).length;
                const isStructuredEnv = /\\begin\{(equation|align|gather|multline)/.test(mathContent);
                const isArray = /\\begin\{array\}/.test(mathContent);

                // Multiline logic: Skip scaling if it is multiline, UNLESS it is an array.
                // Arrays can have multiple lines (rows) but still be too wide.
                const shouldSkip = (lineCount > 0 || isStructuredEnv) && !isArray;

                if (!shouldSkip) {
                    // Only apply to single-line equations OR Arrays

                    // IMPROVED HEURISTIC: Strip LaTeX commands that inflate length without width
                    // e.g. \mathrm{Integration} (20 chars) -> Integration (11 chars)
                    let roughContent = mathContent
                        .replace(/\\mathrm\{([^}]+)\}/g, '$1')
                        .replace(/\\text\{([^}]+)\}/g, '$1')
                        .replace(/\\textbf\{([^}]+)\}/g, '$1')
                        .replace(/\\(left|right|big|Big|bigg|Bigg)[lrv]?/g, '')
                        .replace(/\\[a-zA-Z]+/g, 'C'); // Replace other macros with 1 char proxy

                    // HEURISTIC ADJUSTMENT FOR ARRAYS
                    // Correction (v1.9.35): User reported "too small".
                    // Previous multiplier 0.7 was too pessimistic (treated text as wide math symbols).
                    // Multiplier 0.5 is closer to average English text width.
                    // MaxEm 39 aligns with 160mm printable width at 11pt.
                    let estimatedWidthEm: number;
                    if (isArray) {
                        const rows = Math.max(1, lineCount);
                        estimatedWidthEm = (roughContent.length / rows) * 0.5;
                    } else {
                        estimatedWidthEm = roughContent.length * 0.35;
                    }

                    const maxEm = 39; // Pushing to the very edge of A4 margins

                    if (estimatedWidthEm > maxEm) {
                        const scale = Math.max(0.65, maxEm / estimatedWidthEm); // Clamp at 0.65 to prevent microscopic text
                        // STRATEGY: display: block + margin: 0 auto restores Margin Collapsing with surrounding paragraphs.
                        // This eliminates the "double gap" caused by inline-block preventing margin merger.
                        // width: max-content ensures it still hugs the table width for scaling calculations.
                        html = `<div class="katex-autoscale" style="display: block; margin: 0 auto; width: max-content; transform: scale(${scale.toFixed(2)}); transform-origin: center center;">${html}</div>`;
                    }
                }
            }

            blocks[id] = html;
        } catch (e) {
            blocks[id] = `<span style="color:red;">Math Error</span>`;
        }
        return displayMode ? `\n\n${id}\n\n` : id;
    };

    // Extract Math (SSOT Order: Structured -> Display -> Standard Inline -> Legacy Inline)

    // FIX (v1.9.9): REDUNDANT DELIMITER SANITIZER
    // AI sometimes double-wraps math: \[ $\theta$_t \] or \( $\theta$_t \)
    // This causes syntax errors or text-mode partial rendering.
    // We strip unescaped $ signs from INSIDE standard math blocks.
    content = content.replace(/\\\[([\s\S]*?)\\\]/g, (m, inner) => {
        return '\\[' + inner.replace(/(?<!\\)\$/g, '') + '\\]';
    });
    content = content.replace(/\\\(([\s\S]*?)\\\)/g, (m, inner) => {
        return '\\(' + inner.replace(/(?<!\\)\$/g, '') + '\\)';
    });
    // FIX (v1.9.10): Also sanitize structured environments (equation, align, etc.)
    content = content.replace(/\\begin\{(equation|align|gather|multline)(\*?)\}([\s\S]*?)\\end\{\1\2\}/g, (m, env, star, inner) => {
        const cleanInner = inner.replace(/(?<!\\)\$/g, '');
        return `\\begin{${env}${star}}${cleanInner}\\end{${env}${star}}`;
    });

    // FIX (v1.9.8): MATH FRAGMENT HEALER
    // AI sometimes writes fragmented equations on a single line:
    // "$\theta_{t+1}$ = $\theta_t$ + f(x)"
    // We detect these lines and wrap them in Display Math ($$ ... $$) while stripping inner $ signs.
    content = content.replace(/^(\s*)\$(.*)\$(.*)=(.*)\$(.*)\$(.*)$/gm, (match) => {
        // Basic heuristic: Line starts with $, contains =, contains other $ pairs.
        // Dangerous if overly broad. Let's make it targeted.
        return match;
    });

    // TARGETED HEALER: Matches lines that look like: $math$ = $math$ + text
    // Must start with $ and have = or + or - outside of dollars?
    // Easier: Search for "$...$ = $...$" pattern specifically.
    content = content.replace(/(\$[^$]+\$)\s*([=+\-])\s*(\$[^$]+\$)/g, (m, p1, op, p2) => {
        // Merge: Remove closing $ of p1, opening $ of p2
        // "$a$ = $b$" -> "$a = b$"
        return p1.slice(0, -1) + ' ' + op + ' ' + p2.slice(1);
    });

    // SPECIFIC HEALER FOR USER REPORTED CASE:
    // $\theta_{t+1}$ = $\theta_{t}$ + f(\text{experience}_t)
    // This has text AFTER the math that should be math.
    // Strategy: If a line is MOSTLY math (starts with $) and contains operators, force it to be one math block?
    // Let's rely on the specific operator merge first. 
    // Refined Merge: $A$ = $B$ + ...
    content = content.replace(/(\$[^$]+\$)\s*([=])\s*(\$[^$]+\$)\s*([+])\s*(.*)$/gm, (match, p1, eq, p2, plus, rest) => {
        // Check if 'rest' looks like math (has \text or subscripts)
        if (rest.includes('\\') || rest.includes('_') || rest.includes('^')) {
            // It's likely all math.
            const cleanP1 = p1.slice(1, -1);
            const cleanP2 = p2.slice(1, -1);
            return `$$ ${cleanP1} = ${cleanP2} + ${rest} $$`;
        }
        return match;
    });

    // FIX (v1.9.7): MATH NOTATION NORMALIZATION
    // AI often outputs $\theta$_t instead of $\theta_t$. This breaks rendering.
    // We normalize this BEFORE extraction.
    // Case 1: Simple subscripts: $\theta$_t -> $\theta_t$
    content = content.replace(/\$([^\$]+)\$_([a-zA-Z0-9]+)/g, '$$$1_{$2}$$');
    // Case 2: Complex subscripts: $\theta$_{t+1} -> $\theta_{t+1}$
    content = content.replace(/\$([^\$]+)\$_\s*\{([^}]+)\}/g, '$$$1_{$2}$$');
    content = content.replace(/\\begin\{(equation|align|gather|multline)(\*?)\}([\s\S]*?)\\end\{\1\2\}/g, (m, env, star, math) => createMathBlock(m, true));
    content = content.replace(/\\\[([\s\S]*?)\\\]/g, (m, math) => createMathBlock(math, true));
    content = content.replace(/\\\(([\s\S]*?)\\\)/g, (m, math) => createMathBlock(math, false)); // Standard Inline \( ... \)
    content = content.replace(/(?<!\\)\$\$([\s\S]*?)(?<!\\)\$\$/g, (m, math) => createMathBlock(math, true)); // Double dollar (Legacy Display)
    content = content.replace(/(?<!\\)\$(?!\$)([^$]+?)(?<!\\)\$/g, (m, math) => createMathBlock(math, false)); // Legacy Inline $ ... $

    return { sanitized: content, blocks };
}
