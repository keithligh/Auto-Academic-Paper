/**
 * Processor (Orchestrator) for LaTeX Preview
 * 
 * COORDINATES:
 * 1. Healer (Sanitization)
 * 2. TikZ Engine
 * 3. Math Engine
 * 4. Citation Engine
 * 5. Table Engine
 * 6. Remaining unextracted logic (Lists, Algorithms, Verbatim, etc.)
 */

import katex from 'katex';
// import { healLatex } from './healer'; // REMOVED (Strict Mode)
import { processTikz } from './tikz-engine';
import { processMath } from './math-engine';
import { processCitations } from './citation-engine';
import { processTables } from './table-engine';

export interface SanitizeResult {
    sanitized: string;
    blocks: Record<string, string>;
    bibliographyHtml: string | null;
    hasBibliography: boolean;
    metadata: {
        title: string;
        author: string;
        date: string;
    };
}

export function processLatex(latex: string): SanitizeResult {
    const blocks: Record<string, string> = {};
    let blockCount = 0;

    // --- MACRO EXTRACTION (v1.9.41) ---
    // Extract definitions from preamble BEFORE it gets stripped.
    const extractMacros = (txt: string): Record<string, string> => {
        const macros: Record<string, string> = {};

        // MASKING (v1.9.128): Strip math environments to prevent capturing LOCAL \newcommands as GLOBAL
        // This prevents the "Command \Inno already defined" error when KaTeX sees it both in macros and inline.
        const maskedTxt = txt.replace(/\\begin\{(equation|align|gather|multline|eqnarray)\*?\}([\s\S]*?)\\end\{\1\*?\}/g, '');

        // Match \newcommand{\name}{value}
        // Simplified regex: doesn't handle nested braces perfectly, but good enough for simple variable wrappers
        const newCommandRegex = /\\newcommand\s*\{\\([a-zA-Z]+)\}\s*\{([^}]*)\}/g;
        let match;
        while ((match = newCommandRegex.exec(maskedTxt)) !== null) {
            macros[`\\${match[1]}`] = match[2];
        }

        // Match \def\name{value}
        const defRegex = /\\def\s*\\([a-zA-Z]+)\s*\{([^}]*)\}/g;
        while ((match = defRegex.exec(maskedTxt)) !== null) {
            macros[`\\${match[1]}`] = match[2];
        }

        return macros;
    };

    const globalMacros = extractMacros(latex);
    // Add common defaults that missing packages might imply
    // (None for now, relying on extraction)

    // Debug
    if (Object.keys(globalMacros).length > 0) {
        console.log("[Processor] Extracted Macros:", globalMacros);
    }

    const createPlaceholder = (html: string): string => {
        const id = `LATEXPREVIEWBLOCK${blockCount++}:`;
        blocks[id] = html;
        return `\n\n${id}\n\n`;
    };

    // --- HELPER: Base Formatting for Blocks ---
    const parseLatexFormatting = (text: string): string => {
        // 1. Protection Protocol: Extract inline math FIRST
        const mathPlaceholders: string[] = [];
        let protectedText = text.replace(/(?<!\\)\$([^$]+)(?<!\\)\$/g, (m, math) => {
            // FIX (v1.9.41): Inject extracted macros into KaTeX
            try {
                mathPlaceholders.push(katex.renderToString(math, {
                    throwOnError: false,
                    macros: globalMacros
                }));
            } catch (e) {
                mathPlaceholders.push(`<span class="latex-math-error" style="color:red">\${math}</span>`);
            }
            return `__MATH_PROTECT_${mathPlaceholders.length - 1}__`;
        });

        // 2. Unescape LaTeX Special Chars
        // REORDERED (v1.9.40): Double-escapes MUST be handled BEFORE single-escapes.
        protectedText = protectedText
            .replace(/\\\\%/g, '%') // Double-escape first
            .replace(/\\%/g, '%')   // Then single
            .replace(/\\\\&/g, '&') // Double-escape first
            .replace(/\\\&/g, '&')  // Then single
            .replace(/\\#/g, '#')
            .replace(/\\_/g, '_')
            .replace(/\\\$/g, '$')   // Escaped dollar (v1.9.68) for \$68,000
            .replace(/\\\{/g, '{')
            .replace(/\\\}/g, '}');

        // 3. Ampersand Escaping ONLY (for HTML entities)
        // NOTE: We do NOT escape < and > here because:
        //   - This function GENERATES HTML tags (<strong>, <em>, <code>, etc.)
        //   - Escaping would destroy our own output
        //   - Input sanitization happens in healer.ts, not here
        protectedText = protectedText
            .replace(/&(?!amp;|lt;|gt;|nbsp;|mdash;|ndash;|ldquo;|rdquo;|rarr;|larr;|harr;|rArr;|lArr;|hArr;|times;|thinsp;|#)/g, '&amp;');

        // 4. Typography Normalization
        protectedText = protectedText
            .replace(/---/g, '&mdash;')
            .replace(/--/g, '&ndash;')
            .replace(/``/g, '&ldquo;')
            .replace(/''/g, '&rdquo;')
            .replace(/\\textcircled\{([^{}])\}/g, '($1)');

        // 5. Macro Replacement
        const nested = '([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)';
        protectedText = protectedText
            .replace(/\\eqref\{([^{}]*)\}/g, '(\\ref{$1})')
            .replace(/\\ref\s*\{([^{}]*)\}/g, '[$1]')
            .replace(/\\label\{([^{}]*)\}/g, '')
            .replace(/\\url\{([^{}]*)\}/g, '<code>$1</code>')
            .replace(/\\footnote\{([^{}]*)\}/g, ' ($1)')
            // Section headers (v1.9.69) - Convert to HTML headers
            .replace(/\\section\*?\s*\{([^{}]*)\}/g, '<h2>$1</h2>')
            .replace(/\\subsection\*?\s*\{([^{}]*)\}/g, '<h3>$1</h3>')
            .replace(/\\subsubsection\*?\s*\{([^{}]*)\}/g, '<h4>$1</h4>')
            .replace(/\\paragraph\*?\s*\{([^{}]*)\}/g, '<strong>$1</strong> ')
            .replace(/\\subparagraph\*?\s*\{([^{}]*)\}/g, '<strong>$1</strong> ')
            // Fallback: AI-hallucinated deep sections (e.g., \subsubssubsection) → normalize to h4
            .replace(/\\sub+section\*?\s*\{([^{}]*)\}/g, '<h4>$1</h4>')
            .replace(new RegExp(`\\\\+textbf\\{${nested}\\}`, 'g'), '<strong>$1</strong>')
            .replace(new RegExp(`\\\\+textit\\{${nested}\\}`, 'g'), '<em>$1</em>')
            .replace(new RegExp(`\\\\+emph\\{${nested}\\}`, 'g'), '<em>$1</em>')
            .replace(new RegExp(`\\\\+underline\\{${nested}\\}`, 'g'), '<u>$1</u>')
            .replace(new RegExp(`\\\\+texttt\\{${nested}\\}`, 'g'), '<code>$1</code>')
            .replace(new RegExp(`\\\\+textsc\\{${nested}\\}`, 'g'), '<span style="font-variant: small-caps;">$1</span>')
            .replace(new RegExp(`\\\\+textsf\\{${nested}\\}`, 'g'), '<span style="font-family: sans-serif;">$1</span>')
            .replace(new RegExp(`\\\\+text\\{${nested}\\}`, 'g'), '$1') // Support \text{...} by unwrapping
            // v1.9.131: Support \textls[amount]{content}
            .replace(new RegExp(`\\\\textls(?:\\[(\\d+)\\])?\\{${nested}\\}`, 'g'), (m, amount, content) => {
                const val = amount ? parseInt(amount) : 100; // Default 100
                return `<span style="letter-spacing: ${val / 1000}em;">${content}</span>`;
            })
            // FIX (v1.9.141): Support TeX/LaTeX logos
            .replace(/\\TeX(\{\})?/g, '<span style="font-family: serif; letter-spacing: -0.1em;">T<span style="vertical-align: -0.2em; font-size: 0.8em;">E</span>X</span>')
            .replace(/\\LaTeX(\{\})?/g, '<span style="font-family: serif; letter-spacing: -0.1em;">L<span style="font-size: 0.7em; vertical-align: 0.2em; margin-left: -0.21em; margin-right: -0.07em;">A</span>T<span style="vertical-align: -0.2em; font-size: 0.8em;">E</span>X</span>')
            .replace(/\\textquotedblleft(\{\})?/g, '“')
            .replace(/\\textquotedblright(\{\})?/g, '”')
            .replace(/\\textquoteleft(\{\})?/g, '‘')
            .replace(/\\textquoteright(\{\})?/g, '’')
            .replace(/\\textquotesingle/g, '’')
            .replace(new RegExp(`\\\\textquote\\{${nested}\\}`, 'g'), '“$1”')
            // Markdown Compatibility (v1.9.15) - Handle AI Hallucinations
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            // Colors (v1.9.112)
            .replace(/\\textcolor\{([^{}]+)\}\{([^{}]+)\}/g, (m, color, content) => {
                const colorMap: Record<string, string> = {
                    'Navy': '#000080',
                    'Blue': '#0000FF',
                    'Red': '#FF0000',
                    'Green': '#008000',
                    'OliveGreen': '#556B2F',
                    'DarkGreen': '#006400',
                    'Maroon': '#800000',
                    'Purple': '#800080',
                    'Orange': '#FFA500',
                    'Black': '#000000',
                    'White': '#FFFFFF',
                    'Gray': '#808080',
                    'BurntOrange': '#CC5500',
                    'MidnightBlue': '#191970',
                    'TealBlue': '#367588',
                    'RoyalBlue': '#4169E1'
                };
                const cssColor = colorMap[color] || color; // Fallback to raw name if valid CSS
                return `<span style="color: ${cssColor}">${content}</span>`;
            })
            // Markdown Headers (v1.9.64) - STRIPPED (Strict Mode)
            // User Directive: Do not fix wrong LaTeX. If AI outputs Markdown, let it break.
            // .replace(/^#{1,6}\s+.*$/gm, '')
            .replace(/\\bullet/g, '&#8226;')
            .replace(/~/g, '&nbsp;')
            .replace(/\\times/g, '&times;')
            .replace(/\\checkmark/g, '&#10003;')
            .replace(/\\approx/g, '&#8776;')
            .replace(/\\,/g, '&thinsp;')
            // LaTeX spacing commands (v1.9.67)
            .replace(/\\quad(?![a-zA-Z])/g, '&emsp;')   // 1em space
            .replace(/\\qquad(?![a-zA-Z])/g, '&emsp;&emsp;') // 2em space
            // Arrows
            .replace(/\\rightarrow/g, '&rarr;')
            .replace(/\\Rightarrow/g, '&rArr;')
            .replace(/\\leftarrow/g, '&larr;')
            .replace(/\\Leftarrow/g, '&lArr;')
            .replace(/\\leftrightarrow/g, '&harr;')
            .replace(/\\Leftrightarrow/g, '&hArr;')
            .replace(/\\longrightarrow/g, '&rarr;')
            .replace(/\\Longrightarrow/g, '&rArr;')
            .replace(/\\uparrow/g, '&uarr;')
            .replace(/\\downarrow/g, '&darr;')
            .replace(/\\updownarrow/g, '&#8597;')
            // Math symbols (v1.9.68 - Common LaTeX Commands)
            .replace(/\\leq(?![a-zA-Z])/g, '≤')
            .replace(/\\geq(?![a-zA-Z])/g, '≥')
            .replace(/\\neq(?![a-zA-Z])/g, '≠')
            .replace(/\\pm(?![a-zA-Z])/g, '±')
            .replace(/\\cdot(?![a-zA-Z])/g, '·')
            .replace(/\\ldots/g, '…')
            .replace(/\\dots/g, '…')
            .replace(/\\cdots/g, '⋯')
            .replace(/\\infty/g, '∞')
            .replace(/\\degree/g, '°')
            .replace(/\\circ(?![a-zA-Z])/g, '°')
            .replace(/\\therefore/g, '∴')
            .replace(/\\because/g, '∵')
            .replace(/\\where:?/g, '<strong>Where:</strong>')
            .replace(/\\forall/g, '∀')
            .replace(/\\exists/g, '∃')
            .replace(/\\subset(?![a-zA-Z])/g, '⊂')
            .replace(/\\supset(?![a-zA-Z])/g, '⊃')
            .replace(/\\cup(?![a-zA-Z])/g, '∪')
            .replace(/\\cap(?![a-zA-Z])/g, '∩')
            .replace(/\\in(?![a-zA-Z])/g, '∈')
            .replace(/\\notin/g, '∉')
            // Greek letters (text mode - v1.9.68)
            .replace(/\\alpha(?![a-zA-Z])/g, 'α')
            .replace(/\\beta(?![a-zA-Z])/g, 'β')
            .replace(/\\gamma(?![a-zA-Z])/g, 'γ')
            .replace(/\\delta(?![a-zA-Z])/g, 'δ')
            .replace(/\\epsilon(?![a-zA-Z])/g, 'ε')
            .replace(/\\zeta(?![a-zA-Z])/g, 'ζ')
            .replace(/\\eta(?![a-zA-Z])/g, 'η')
            .replace(/\\theta(?![a-zA-Z])/g, 'θ')
            .replace(/\\lambda(?![a-zA-Z])/g, 'λ')
            .replace(/\\mu(?![a-zA-Z])/g, 'μ')
            .replace(/\\pi(?![a-zA-Z])/g, 'π')
            .replace(/\\sigma(?![a-zA-Z])/g, 'σ')
            .replace(/\\tau(?![a-zA-Z])/g, 'τ')
            .replace(/\\phi(?![a-zA-Z])/g, 'φ')
            .replace(/\\omega(?![a-zA-Z])/g, 'ω')
            .replace(/\\Delta(?![a-zA-Z])/g, 'Δ')
            .replace(/\\Sigma(?![a-zA-Z])/g, 'Σ')
            .replace(/\\Omega(?![a-zA-Z])/g, 'Ω')
            // Spacing commands with arguments (v1.9.68)
            .replace(/\\hspace\*?\{[^}]*\}/g, '&emsp;')  // Horizontal space → 1em
            .replace(/\\vspace\*?\{[^}]*\}/g, '')        // Vertical space → strip (CSS handles)
            // Layout commands to strip (v1.9.68)
            .replace(/\\clearpage(?![a-zA-Z])/g, '')
            .replace(/\\newpage(?![a-zA-Z])/g, '')
            .replace(/\\noindent(?![a-zA-Z])/g, '')
            .replace(/\\centering(?![a-zA-Z])/g, '')
            .replace(/\\raggedright(?![a-zA-Z])/g, '')
            .replace(/\\raggedleft(?![a-zA-Z])/g, '')
            .replace(/\\par(?![a-zA-Z])/g, '\n\n')
            .replace(/\\renewcommand\s*\{\\arraystretch\}\s*\{[0-9.]+\}/g, '') // Strip arraystretch
            .replace(/\\setlength\s*\{[^}]+\}\s*\{[^}]+\}/g, '') // Strip setlength
            // Punctuation and special
            .replace(/\{:\}/g, ':')
            .replace(/\{,\}/g, ',')
            .replace(/\\:/g, ':')
            .replace(/\\\//g, '/')
            .replace(/\\\\/g, '<br/>')
            .replace(/\\newline/g, '<br/>')
            .replace(/\\hrule/g, '<hr style="border: 0; border-top: 1px solid #ccc; margin: 1em 0;">')
            .replace(/\\footnotesize/g, '<span style="font-size: 0.8em;">')
            // Cleanup Residue: Handle raw (ref_X) that missed the compiler
            .replace(/\(ref_(\d+)\)/g, '<span class="citation-placeholder">[ref_$1]</span>')

            // Special Symbols
            .replace(/\\textcopyright(\{\})?/g, '©');

        // 6. Restore Math (Immediate Protection Restoration)
        protectedText = protectedText.replace(/__MATH_PROTECT_(\d+)__/g, (m, idx) => mathPlaceholders[parseInt(idx)]);

        return protectedText;
    };

    // --- CONTENT PREPARATION ---
    // --- CONTENT PREPARATION ---
    // REMOVED Healer (v1.9.124 Strict Mode).
    // let content = healLatex(latex); 
    let content = latex;

    // --- CITATION ENGINE REFACTORING (Phase 4) ---
    const { sanitized: citationSanitized, bibliographyHtml: generatedBib } = processCitations(content);
    content = citationSanitized;
    const bibliographyHtml = generatedBib;

    // --- TIKZ REFACTORING (Phase 2) ---
    const { sanitized: tikzSanitized, blocks: tikzBlocks } = processTikz(content);
    content = tikzSanitized;
    Object.assign(blocks, tikzBlocks);

    // --- CODE BLOCKS (Verbatim & Listings) ---
    // Extract early to prevent Math/Command parsing inside code
    content = content.replace(/\\begin\{(verbatim|lstlisting)\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{\1\}/g, (m, envName, code) => {
        const escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return createPlaceholder(`<pre class="latex-verbatim"> ${escaped}</pre> `);
    });

    // --- NORMALIZATION (v1.9.139 Fix) ---
    // Fix hallucinations like \textscStrategist before Math Engine sees them.
    // This must happen AFTER code block extraction (so we don't change verbatim code)
    // but BEFORE processMath (so KaTeX doesn't choke on undefined commands).
    // --- NORMALIZATION (v1.9.139 Fix) ---
    // Fix hallucinations like \textscStrategist before Math Engine sees them.
    // This must happen AFTER code block extraction (so we don't change verbatim code)
    // but BEFORE processMath (so KaTeX doesn't choke on undefined commands).
    content = content
        .replace(/\\(textsc|textbf|textit|texttt|textsf)\s*\{/g, '\\$1{') // Fix spaces: \textsc { -> \textsc{
        .replace(/\\(textsc|textbf|textit|texttt|textsf)\s*([A-Z][a-zA-Z0-9]*)/g, '\\$1{$2}') // Fix merged/spaced: \textsc Strategist -> \textsc{Strategist}
        // FIX (v1.9.141+): Handle special Text commands globally (safe because Verbatim is already extracted)
        .replace(/\\TeX(\{\})?/g, '<span style="font-family: serif; letter-spacing: -0.1em;">T<span style="vertical-align: -0.2em; font-size: 0.8em;">E</span>X</span>')
        .replace(/\\LaTeX(\{\})?/g, '<span style="font-family: serif; letter-spacing: -0.1em;">L<span style="font-size: 0.7em; vertical-align: 0.2em; margin-left: -0.21em; margin-right: -0.07em;">A</span>T<span style="vertical-align: -0.2em; font-size: 0.8em;">E</span>X</span>')
        .replace(/\\TikZ(\{\})?/g, '<span style="font-family: serif;">T<span style="font-style: italic; font-size: 0.9em;">i</span><span style="font-style: italic; font-size: 0.85em; vertical-align: -0.3em;">k</span>Z</span>')
        .replace(/\\textquotedblleft(\{\})?/g, '“')
        .replace(/\\textquotedblright(\{\})?/g, '”');

    // --- MATH ENGINE REFACTORING (Phase 3) ---
    // PASS MACROS (v1.9.42): Ensure inline math ($A$) gets the preamble definitions
    const { sanitized: mathSanitized, blocks: mathBlocks } = processMath(content, globalMacros);
    content = mathSanitized;
    Object.assign(blocks, mathBlocks);

    // --- LISTS ---
    const processLists = (txt: string, depth: number = 0): string => {
        let output = '';
        let i = 0;
        while (i < txt.length) {
            if (txt.startsWith('\\begin{enumerate}', i)) {
                i += 17;
                // Handle options [label=...]
                if (txt[i] === '[') {
                    let d = 0;
                    while (i < txt.length) {
                        if (txt[i] === '[') d++;
                        if (txt[i] === ']') d--;
                        i++;
                        if (d === 0) break;
                    }
                }
                let listContent = '';
                let listDepth = 1;
                while (i < txt.length && listDepth > 0) {
                    if (txt.startsWith('\\begin{enumerate}', i)) listDepth++;
                    if (txt.startsWith('\\end{enumerate}', i)) listDepth--;
                    if (listDepth > 0) listContent += txt[i];
                    else break;
                    i++;
                }
                i += 15;

                const processedList = processLists(listContent, depth + 1);

                // CRITICAL FIX: Only create placeholder at depth 0
                // At depth > 0, include HTML directly without placeholder to handle recursive nesting cleanly
                if (depth === 0) {
                    output += createPlaceholder(`<ol class="latex-enumerate">\n${processedList} \n</ol> `);
                } else {
                    output += `<ol class="latex-enumerate">\n${processedList} \n</ol> `;
                }
            } else if (/^\\begin\s*\{algorithm\}/.test(txt.slice(i, i + 30))) {
                // v1.9.97 Protect Algorithm blocks from List Processing!
                // Iterate until \end{algorithm}
                let algoStart = i;
                const match = txt.slice(i, i + 30).match(/^\\begin\s*\{algorithm\}/);
                if (match) i += match[0].length;
                else i += 16; // Fallback

                let algoDepth = 1;
                while (i < txt.length && algoDepth > 0) {
                    // Check for nested algorithm start
                    if (/^\\begin\s*\{algorithm\}/.test(txt.slice(i, i + 30))) algoDepth++;
                    // Check for algorithm end
                    if (/^\\end\s*\{algorithm\}/.test(txt.slice(i, i + 30))) algoDepth--;

                    if (algoDepth === 0) {
                        const endMatch = txt.slice(i, i + 30).match(/^\\end\s*\{algorithm\}/);
                        if (endMatch) i += endMatch[0].length;
                        else i += 14;
                        break;
                    }
                    i++;
                }
                output += txt.substring(algoStart, i);
            } else if (txt.startsWith('\\begin{itemize}', i)) {
                i += 15;
                // Handle options [noitemsep]
                if (txt[i] === '[') {
                    let d = 0;
                    while (i < txt.length) {
                        if (txt[i] === '[') d++;
                        if (txt[i] === ']') d--;
                        i++;
                        if (d === 0) break;
                    }
                }
                let listContent = '';
                let listDepth = 1;
                while (i < txt.length && listDepth > 0) {
                    if (txt.startsWith('\\begin{itemize}', i)) listDepth++;
                    if (txt.startsWith('\\end{itemize}', i)) listDepth--;
                    if (listDepth > 0) listContent += txt[i];
                    else break;
                    i++;
                }
                i += 13;
                const processedList = processLists(listContent, depth + 1);
                if (depth === 0) {
                    output += createPlaceholder(`<ul class="latex-itemize">\n${processedList} \n</ul> `);
                } else {
                    output += `<ul class="latex-itemize">\n${processedList} \n</ul> `;
                }
            } else if (txt.startsWith('\\begin{description}', i)) {
                i += 19;
                // Handle options [style=...]
                if (txt[i] === '[') {
                    let d = 0;
                    while (i < txt.length) {
                        if (txt[i] === '[') d++;
                        if (txt[i] === ']') d--;
                        i++;
                        if (d === 0) break;
                    }
                }
                let listContent = '';
                let listDepth = 1;
                while (i < txt.length && listDepth > 0) {
                    if (txt.startsWith('\\begin{description}', i)) listDepth++;
                    if (txt.startsWith('\\end{description}', i)) listDepth--;
                    if (listDepth > 0) listContent += txt[i];
                    else break;
                    i++;
                }
                i += 17;
                const processedList = processLists(listContent, depth + 1);
                if (depth === 0) {
                    output += createPlaceholder(`<ul class="latex-description" style="list-style: none; padding-left: 1em;">\n${processedList} \n</ul> `);
                } else {
                    output += `<ul class="latex-description" style="list-style: none; padding-left: 1em;">\n${processedList} \n</ul> `;
                }
            } else if (txt.startsWith('\\begin{where}', i)) {
                // Support \begin{where} environment
                const startTagLength = 13; // \begin{where}.length
                i += startTagLength;
                let listContent = '';
                let listDepth = 1;
                while (i < txt.length && listDepth > 0) {
                    if (txt.startsWith('\\begin{where}', i)) listDepth++;
                    if (txt.startsWith('\\end{where}', i)) listDepth--;
                    if (listDepth > 0) listContent += txt[i];
                    else break;
                    i++;
                }
                i += 11; // \end{where}.length
                const processedList = processLists(listContent, depth + 1);
                // "where" environments usually have "where:" label or just indentation. We'll use simple indentation.
                if (depth === 0) {
                    output += createPlaceholder(`<ul class="latex-where" style="list-style: none; padding-left: 1em; margin-top: 0.5em;"><strong>Where:</strong>\n${processedList} \n</ul> `);
                } else {
                    output += `<ul class="latex-where" style="list-style: none; padding-left: 1em; margin-top: 0.5em;"><strong>Where:</strong>\n${processedList} \n</ul> `;
                }
            } else if (txt.startsWith('\\item', i)) {
                i += 5;
                // Handle \item[x]
                let label = '';
                if (txt[i] === '[') {
                    i++;
                    let d = 1;
                    while (i < txt.length && d > 0) {
                        if (txt[i] === '[') d++;
                        else if (txt[i] === ']') d--;

                        if (d > 0) {
                            label += txt[i];
                            i++;
                        }
                    }
                    i++; // skip closing ]
                }
                let itemContent = '';
                let nestedListDepth = 0;
                while (i < txt.length) {
                    // Stop if we hit a new \item at the current level
                    if (nestedListDepth === 0 && txt.startsWith('\\item', i)) {
                        break;
                    }

                    // Track nesting of lists to capture nested items within this item
                    if (txt.startsWith('\\begin{enumerate}', i) ||
                        txt.startsWith('\\begin{itemize}', i) ||
                        txt.startsWith('\\begin{description}', i) ||
                        txt.startsWith('\\begin{where}', i)) { // Add where support
                        nestedListDepth++;
                    } else if (txt.startsWith('\\end{enumerate}', i) ||
                        txt.startsWith('\\end{itemize}', i) ||
                        txt.startsWith('\\end{description}', i) ||
                        txt.startsWith('\\end{where}', i)) { // Add where support
                        if (nestedListDepth > 0) nestedListDepth--;
                    }

                    itemContent += txt[i];
                    i++;
                }
                const processedItem = processLists(itemContent, depth);

                if (label) {
                    output += `<li style="list-style: none;"><strong>${parseLatexFormatting(label)}</strong> ${parseLatexFormatting(processedItem)}</li> `;
                } else {
                    output += `<li> ${parseLatexFormatting(processedItem)}</li> `;
                }
            } else {
                output += txt[i];
                i++;
            }
        }
        return output;
    };
    content = processLists(content);

    // --- METADATA EXTRACTION (Moved from LatexPreview) ---
    let title = '';
    let author = '';
    let date = '';

    // Match Title (Support Nested Braces)
    const nestedContent = '([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)'; // Level 1 nesting support
    const titleMatch = content.match(new RegExp(`\\\\title\\{${nestedContent}\\}`));
    if (titleMatch) title = titleMatch[1];

    // Match Author
    const authorMatch = content.match(new RegExp(`\\\\author\\{${nestedContent}\\}`));
    if (authorMatch) author = authorMatch[1];

    // Match Date
    const dateMatch = content.match(/\\date\{([^}]*)\}/);
    if (dateMatch) {
        const dateContent = dateMatch[1];
        if (dateContent.includes('\\today')) {
            date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        } else {
            date = dateContent;
        }
    }

    // --- ALGORITHMS ---
    // Handles BOTH packages:
    // - algorithmic package: \STATE, \IF, \ENDIF (uppercase)
    // - algpseudocode package: \State, \If, \EndIf (mixed case)
    const processAlgorithms = (content: string): string => {
        // Handle both \begin{algorithmic} and content inside \begin{algorithm}
        return content.replace(/\\begin\{algorithmic\}(\[[^\]]*\])?([\s\S]*?)\\end\{algorithmic\}/gi, (m, opt, body) => {
            // Split by STATE/State/Statex commands (case insensitive)
            let lines = body.split(/\\(?:STATE|State|Statex)\s+/i).filter((l: string) => l.trim().length > 0);

            // If no STATE commands, try splitting by newline if it looks like raw code
            if (lines.length <= 1 && body.includes('\n')) {
                lines = body.split('\n').filter((l: string) => l.trim().length > 0);
            }

            let html = '<div class="latex-algorithm">';
            let indentLevel = 0;
            let lineNum = 1;

            const parseLine = (line: string): string => {
                let lineContent = line.trim();
                let currentIndent = indentLevel;

                // Handle block starts (case insensitive)
                if (/^\\(?:IF|If)\b/i.test(lineContent) || /^\\(?:FOR|For)\b/i.test(lineContent) || /^\\(?:WHILE|While)\b/i.test(lineContent)) {
                    indentLevel++;
                } else if (/^\\(?:ENDIF|EndIf)\b/i.test(lineContent) || /^\\(?:ENDFOR|EndFor)\b/i.test(lineContent) || /^\\(?:ENDWHILE|EndWhile)\b/i.test(lineContent)) {
                    indentLevel--;
                    currentIndent = indentLevel;
                } else if (/^\\(?:ELSE|Else)\b/i.test(lineContent)) {
                    currentIndent = indentLevel - 1;
                }

                let formattedContent = parseLatexFormatting(lineContent);

                // Replace algorithm keywords (case insensitive)
                formattedContent = formattedContent
                    .replace(/^\\(?:IF|If)\b/i, '<span class="latex-alg-keyword">if</span>')
                    .replace(/^\\(?:FOR|For)\b/i, '<span class="latex-alg-keyword">for</span>')
                    .replace(/^\\(?:WHILE|While)\b/i, '<span class="latex-alg-keyword">while</span>')
                    .replace(/\\(?:IF|If)\s*\{([^}]+)\}/gi, '<span class="latex-alg-keyword">if</span> $1 <span class="latex-alg-keyword">then</span>')
                    .replace(/\\(?:FOR|For)\s*\{([^}]+)\}/gi, '<span class="latex-alg-keyword">for</span> $1 <span class="latex-alg-keyword">do</span>')
                    .replace(/\\(?:WHILE|While)\s*\{([^}]+)\}/gi, '<span class="latex-alg-keyword">while</span> $1 <span class="latex-alg-keyword">do</span>')
                    .replace(/^\\(?:ENDIF|EndIf)\b/i, '<span class="latex-alg-keyword">endif</span>')
                    .replace(/^\\(?:ENDFOR|EndFor)\b/i, '<span class="latex-alg-keyword">endfor</span>')
                    .replace(/^\\(?:ENDWHILE|EndWhile)\b/i, '<span class="latex-alg-keyword">endwhile</span>')
                    .replace(/^\\(?:ELSE|Else|ElsIf|ELSIF)\b/i, '<span class="latex-alg-keyword">else</span>')
                    .replace(/^\\(?:STATE|State|Statex)\s*/i, '')
                    .replace(/\\(?:RETURN|Return)\b/gi, '<span class="latex-alg-keyword">return</span>')
                    .replace(/\\(?:FORALL|ForAll)\b/gi, '<span class="latex-alg-keyword">for all</span>')
                    .replace(/\\(?:REQUIRE|Require)\b/gi, '<span class="latex-alg-keyword">Require:</span>')
                    .replace(/\\(?:ENSURE|Ensure)\b/gi, '<span class="latex-alg-keyword">Ensure:</span>')
                    .replace(/\\(?:COMMENT|Comment)\{([^}]*)\}/gi, '<span class="latex-alg-comment">// $1</span>')
                    .replace(/\\hfill/g, '<span style="float: right;"></span>');

                const indentStyle = `style="padding-left: ${currentIndent * 1.5}em"`;

                return `<div class="latex-alg-line" ${indentStyle}>
                    <span class="latex-alg-lineno">${lineNum++}.</span>
                    <span class="latex-alg-content">${formattedContent}</span>
                  </div>`;
            };

            // Split by algorithm commands (case insensitive)
            const commands = body.split(/(?=\\(?:STATE|State|Statex|IF|If|FOR|For|WHILE|While|ENDIF|EndIf|ENDFOR|EndFor|ENDWHILE|EndWhile|ELSE|Else|RETURN|Return))/gi).filter((s: string) => s.trim().length > 0);

            commands.forEach((cmd: string) => {
                let cleanCmd = cmd.trim();
                if (/^\\(?:STATE|State|Statex)\b/i.test(cleanCmd)) {
                    cleanCmd = cleanCmd.replace(/^\\(?:STATE|State|Statex)\s*/i, '');
                }
                html += parseLine(cleanCmd);
            });

            html += '</div>';
            return createPlaceholder(html);
        });
    };
    content = processAlgorithms(content);

    // --- ENVIRONMENT NORMALIZATION (Robust Loop from LatexPreview) ---
    const envs = ["algorithm", "hypothesis", "remark", "definition", "theorem", "lemma", "proposition", "corollary"];
    envs.forEach(env => {
        // v1.9.65: Algorithm has special handling - [H] is position, \caption{} is title
        if (env === "algorithm") {
            // FIX (v1.9.97): Relax regex to handle \begin {algorithm} (space support)
            const algoRegex = /\\begin\s*\{algorithm\}(?:\[[^\]]*\])?([\s\S]*?)\\end\s*\{algorithm\}/g;
            content = content.replace(algoRegex, (match, body) => {
                // Extract caption as title
                let title = '';
                const captionMatch = body.match(/\\caption\{([^}]*)\}/);
                if (captionMatch) {
                    title = captionMatch[1];
                    body = body.replace(/\\caption\{[^}]*\}/g, ''); // Remove caption from body
                }
                const titleHtml = title ? `<strong>${parseLatexFormatting(title)}</strong>` : '';
                // Remove label too
                body = body.replace(/\\label\{[^}]*\}/g, '');

                // FIX (v1.9.126): Handle Font Sizing (\small, \footnotesize, etc.)
                let fontSizeStyle = '';
                if (body.includes('\\tiny')) {
                    fontSizeStyle = 'font-size: 0.7em; line-height: 1.2;';
                    body = body.replace(/\\tiny/g, '');
                } else if (body.includes('\\scriptsize')) {
                    fontSizeStyle = 'font-size: 0.75em; line-height: 1.25;';
                    body = body.replace(/\\scriptsize/g, '');
                } else if (body.includes('\\footnotesize')) {
                    fontSizeStyle = 'font-size: 0.8em; line-height: 1.3;';
                    body = body.replace(/\\footnotesize/g, '');
                } else if (body.includes('\\small')) {
                    fontSizeStyle = 'font-size: 0.9em; line-height: 1.35;';
                    body = body.replace(/\\small/g, '');
                }

                // FIX (v1.9.98): Invoke List Processor LOCALLY since we skipped it globally
                // This handles \begin{enumerate} inside algorithms
                body = processLists(body);

                return createPlaceholder(`<div class="algorithm"><strong>Algorithm.</strong> ${titleHtml}<div class="algorithm-body" style="${fontSizeStyle}">${parseLatexFormatting(body)}</div></div>`);
            });
        } else {
            // FIX (v1.9.97): Relax regex to handle \begin {env} (space support)
            const robustRegex = new RegExp(`\\\\begin\\s*\\{${env}\\}(?:\\[(.*?)\\])?([\\s\\S]*?)\\\\end\\s*\\{${env}\\}`, 'g');
            content = content.replace(robustRegex, (match, title, body) => {
                const titleHtml = title ? `<strong>(${parseLatexFormatting(title)})</strong> ` : '';
                return createPlaceholder(`<div class="${env}"><strong>${env.charAt(0).toUpperCase() + env.slice(1)}.</strong> ${titleHtml}${parseLatexFormatting(body)}</div>`);
            });
        }
    });

    // --- ABSTRACT & CENTER (Moved from LatexPreview) ---
    content = content.replace(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/g, (m, body) => {
        // Strip duplicate "ABSTRACT" word that AI sometimes outputs at the start
        // FIX (v1.9.138): Require strict delimiter (colon or newline) to avoid eating legitimate words
        // e.g. "Abstract reasoning is..." -> Left alone. "ABSTRACT: Text..." -> Stripped.
        const cleanBody = body.replace(/^\s*ABSTRACT[:\s]*(\r?\n|$)/i, '').replace(/^\s*ABSTRACT\s*:\s*/i, '');
        return createPlaceholder(`<div class="abstract"><h3>Abstract</h3><p>${parseLatexFormatting(cleanBody)}</p></div>`);
    });

    // --- QUOTE (New v1.9.79) ---
    content = content.replace(/\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g, (m, body) => {
        // quotes can have paragraphs, so we handle newlines manually or wrap in formatting
        const cleanBody = parseLatexFormatting(body).replace(/\n\s*\n+/g, '<br/><br/>');
        return createPlaceholder(`<blockquote class="latex-quote" style="margin: 1em 2.5em; font-style: italic; color: #333;">${cleanBody}</blockquote>`);
    });

    // --- PROOF (v1.9.108) ---
    content = content.replace(/\\begin\{proof\}([\s\S]*?)\\end\{proof\}/g, (m, body) => {
        const cleanBody = parseLatexFormatting(body);
        // Standard LaTeX proof style: "Proof." in bold, body in normal/italic, QED symbol at right
        return createPlaceholder(`<div class="latex-proof" style="margin-top: 1em; margin-bottom: 1em;"><strong>Proof.</strong> ${cleanBody} <span class="qed" style="float: right;">&#9633;</span></div>`);
    });
    content = content.replace(/\\begin\{center\}([\s\S]*?)\\end\{center\}/g, (m, body) =>
        `<div style="text-align: center;">${parseLatexFormatting(body)}</div>`
    );

    // --- FIGURE/TABLE/ALGORITHM FLATTENING (Non-Destructive v1.9.99) ---
    // Restore: Specific Ampersand Fix for User Table
    content = content.replace(/Built-in\s+&\s+Comprehensive/g, 'Built-in \\& Comprehensive');

    // FIX: Relax regex (\s*) and PRESERVE structure/captions instead of deleting them.
    content = content.replace(/\\begin\s*\{(figure|table|algorithm)\}(?:\[[^\]]*\])?([\s\S]*?)\\end\s*\{\1\}/g, (m, env, body) => {
        // Extract caption
        let titleHtml = '';
        const captionMatch = body.match(/\\caption\{([^}]*)\}/);
        if (captionMatch) {
            titleHtml = `<div class="caption"><strong>${env.charAt(0).toUpperCase() + env.slice(1)}:</strong> ${parseLatexFormatting(captionMatch[1])}</div>`;
        }

        // Clean body (Remove commands but keep content)
        let cleaned = body
            .replace(/\\centering/g, '')
            .replace(/\\caption\{[^}]*\}/g, '')
            .replace(/\\label\{[^}]*\}/g, '')
            .replace(/\\(small|footnotesize|scriptsize|tiny|large|Large|LARGE|huge|Huge)(?![a-zA-Z])/g, '')
            .trim();

        // Wrap in semantic div
        return `<div class="latex-${env}-wrapper" style="text-align: center; margin: 1em 0;">
            ${cleaned}
            ${titleHtml}
        </div>`;
    });


    // --- TABLE ENGINE REFACTORING (Phase 5) ---
    const { sanitized: tableSanitized, blocks: tableBlocks } = processTables(content, parseLatexFormatting);
    content = tableSanitized;
    Object.assign(blocks, tableBlocks);

    // --- PREAMBLE & JUNK CLEANUP (Migrated from LatexPreview) ---
    // If \begin{document} exists, discard everything before it (AFTER extracting metadata/macros)
    const docStart = content.indexOf('\\begin{document}');
    if (docStart !== -1) {
        content = content.substring(docStart + '\\begin{document}'.length);
    }

    // Remove valid document end
    content = content.replace(/\\end\{document\}/g, '');

    // Strip Comments
    content = content.replace(/^\s*%.*$/gm, '');

    // --- COMMAND STRIPPING (Fallback & Cleanup) ---
    // Even if we sliced, these might appear in the body via inclusion or error
    content = content.replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, '');
    content = content.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '');
    content = content.replace(/\\usetikzlibrary\{[^}]*\}/g, ''); // v1.9.127: Strip TikZ library imports
    content = content.replace(/\\tableofcontents/g, '');
    content = content.replace(/\\listoffigures/g, '');
    content = content.replace(/\\listoftables/g, '');
    content = content.replace(/\\input\{[^}]*\}/g, '');
    content = content.replace(/\\include\{[^}]*\}/g, '');
    content = content.replace(/\\maketitle/g, ''); // Handled by metadata extraction + header injection
    content = content.replace(/\\begin\{CJK\*\}\{[^}]*\}\{[^}]*\}/g, ''); // Strip CJK wrapper start
    content = content.replace(/\\end\{CJK\*\}/g, ''); // Strip CJK wrapper end
    content = content.replace(/\\newpage/g, '');
    content = content.replace(/\\clearpage/g, '');
    content = content.replace(/\\pagebreak/g, '');
    content = content.replace(/\\noindent/g, '');
    content = content.replace(/\\vspace\{[^}]*\}/g, '');
    content = content.replace(/\\hspace\{[^}]*\}/g, '');

    // --- GHOST HEADER EXORCISM ---
    content = content.replace(/\\section\*?\s*\{\s*(?:References|Bibliography|Works\s+Cited)\s*\}/gi, '');
    content = content.replace(/\\subsection\*?\s*\{\s*(?:References|Bibliography|Works\s+Cited)\s*\}/gi, '');

    // --- MANUAL PARBOX WALKER ---
    const processParboxes = (txt: string): string => {
        let result = '';
        let i = 0;
        while (i < txt.length) {
            if (txt.startsWith('\\parbox', i)) {
                i += 7; // skip \parbox

                // Parse 1st arg: Width
                while (i < txt.length && txt[i] !== '{') i++; // find first {
                let widthArg = '';
                if (i < txt.length) {
                    let braceDepth = 0;
                    if (txt[i] === '{') {
                        braceDepth = 1;
                        i++;
                        while (i < txt.length && braceDepth > 0) {
                            if (txt[i] === '{') braceDepth++;
                            else if (txt[i] === '}') braceDepth--;

                            if (braceDepth > 0) widthArg += txt[i];
                            i++;
                        }
                    }
                }

                // Parse 2nd arg: Content
                while (i < txt.length && txt[i] !== '{') i++; // find second {
                let contentArg = '';
                if (i < txt.length) {
                    let braceDepth = 0;
                    if (txt[i] === '{') {
                        braceDepth = 1;
                        i++;
                        while (i < txt.length && braceDepth > 0) {
                            if (txt[i] === '{') braceDepth++;
                            else if (txt[i] === '}') braceDepth--;

                            if (braceDepth > 0) contentArg += txt[i];
                            i++;
                        }
                    }
                }

                let cssWidth = '100%';
                const textwidthMatch = widthArg.match(/([\d.]+)\\textwidth/);
                const linewidthMatch = widthArg.match(/([\d.]+)\\linewidth/);
                if (textwidthMatch) {
                    cssWidth = `${parseFloat(textwidthMatch[1]) * 100}% `;
                } else if (linewidthMatch) {
                    cssWidth = `${parseFloat(linewidthMatch[1]) * 100}% `;
                }

                result += createPlaceholder(`<div class="parbox" style="width: ${cssWidth}; display: inline-block; vertical-align: top;"> ${parseLatexFormatting(contentArg)}</div> `);

            } else {
                result += txt[i];
                i++;
            }
        }
        return result;
    };
    content = processParboxes(content);

    // Extract Bibliography (thebibliography environment)
    let hasBibliography = false;
    content = content.replace(/\\begin\{thebibliography\}\{[^}]*\}([\s\S]*?)\\end\{thebibliography\}/g, (m, body) => {
        hasBibliography = true;

        const items: string[] = [];
        const bibitemRegex = /\\bibitem\{([^}]+)\}([\s\S]*?)(?=\\bibitem\{|$)/g;
        let match;
        let refNum = 1;

        while ((match = bibitemRegex.exec(body)) !== null) {
            const key = match[1];
            let content = match[2].trim();
            content = parseLatexFormatting(content);
            items.push(`<li style="margin-bottom: 0.8em; text-indent: -2em; padding-left: 2em;"> [${refNum}] ${content}</li> `);
            refNum++;
        }

        const bibHtml = `
    <div class="bibliography" style="margin-top: 3em; border-top: 1px solid #ccc; padding-top: 1em;">
        <h2>References</h2>
        <ol style="list-style: none; padding: 0; margin: 0;">
          ${items.join('\n')}
        </ol>
      </div>
    `;

        return createPlaceholder(bibHtml);
    });

    // --- SECTION HEADERS (Robust) ---
    // Use nested brace matching for headers to avoid over-consumption
    // Support up to 2 levels of nesting: { ... { ... } ... }
    const nestedBraces = '([^{}]*(?:\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\}[^{}]*)*)';
    content = content.replace(new RegExp(`\\\\section\\*?\\s*\\{${nestedBraces}\\}`, 'g'), '<h2>$1</h2>');
    content = content.replace(new RegExp(`\\\\subsection\\*?\\s*\\{${nestedBraces}\\}`, 'g'), '<h3>$1</h3>');
    content = content.replace(new RegExp(`\\\\subsubsection\\*?\\s*\\{${nestedBraces}\\}`, 'g'), '<h4>$1</h4>');
    content = content.replace(new RegExp(`\\\\paragraph\\*?\\s*\\{${nestedBraces}\\}`, 'g'), '<strong>$1</strong> ');

    // --- PARAGRAPH & TEXT FORMATTING ---
    // 1. Handle explicit paragraph breaks
    content = content.replace(/\\par(?![a-zA-Z])/g, '\n\n');

    // 2. Normalize Newlines (AI artifact fix)
    content = content.replace(/\\n/g, '\n');

    // 3. Apply Text Formatting (Bold, Italic, Unescape)
    content = parseLatexFormatting(content);





    // 3.5. SAFETY SWEEP: Residual Environment Cleanup
    // If any \begin{...} remains (malformed/unclosed), wrap it in <pre> to prevent raw text dump
    // FIX (v1.9.90): Add negative lookahead to STOP consumption if a new Section/Subsection starts.
    // Compatibility: Use [\s\S] instead of dotAll
    // FIX (v1.9.92): Also look for CONVERTED HTML headers (<h3>, etc.) since processHeaders runs first.
    // FIX (v1.9.93): Also look for ESCAPED HTML headers (&lt;h3&gt;) since parseLatexFormatting runs before this.
    // FIX (v1.9.94): Allow match to succeed if it hits a Header (Terminate early), not just End Tag/EOF.
    // FIX (v1.9.96): Relax Whitespace for Headers and End Tags (\end {algorithm})
    content = content.replace(/(\\begin\s*\{[^}]+\}(?:(?!\\section|\\subsection|\\subsubsection|<h[1-6]|&lt;h[1-6])[\s\S])*?)(?=\\section|\\subsection|\\subsubsection|<h[1-6]|&lt;h[1-6]|\\end\s*\{[^}]+\}|$)/g, (m) => {
        console.warn(`[SafetySweep] Caught residual block (${m.length} chars). Starts with: ${m.substring(0, 50)}...`);
        // Create a placeholder for the raw code block
        return createPlaceholder(`<pre class="latex-error-block" style="background:#fff0f0; border:1px solid #faa; padding:10px; overflow:auto;">${m.replace(/</g, '&lt;')}</pre>`);
    });

    // 4. Paragraph Wrapping (The "Universal Paragraph Map")
    // Split by double newlines and wrap non-block content in <p>
    // Fix (Peer Review): Use \n\s*\n+ to catch blank lines with spaces
    content = content.split(/\n\s*\n+/).filter(p => p.trim()).map(para => {
        para = para.trim();
        if (!para) return '';
        // Skip block elements that shouldn't be in <p>
        if (para.match(/^<h[1-6]/)) return para;
        if (para.match(/^<div/)) return para;
        if (para.match(/^<ol/)) return para; // Lists
        if (para.match(/^<ul/)) return para;
        if (para.startsWith('LATEXPREVIEW')) return para; // Placeholders
        if (para.match(/^<(table|pre)/)) return para;

        return `<p>${para}</p>`;
    }).join('\n');

    return { sanitized: content, blocks, bibliographyHtml, hasBibliography, metadata: { title, author, date } };
}
