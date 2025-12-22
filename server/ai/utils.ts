import { json } from "express";

/**
 * Fix JSON escaping issues from AI responses.
 * 
 * IMPORTANT: This function operates on RAW JSON strings, before JSON.parse().
 * When AI outputs invalid escape sequences (like \& or \% for LaTeX),
 * we double the backslash to make it valid JSON. This ensures:
 * - `\&` (invalid) becomes `\\&` (valid) which parses to `\&` (correct)
 */
export function fixAIJsonEscaping(jsonString: string): string {
    let result = '';
    let inString = false;
    let escape = false;

    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        if (char === '"' && !escape) {
            inString = !inString;
            result += char;
            escape = false;
            continue;
        }
        if (inString) {
            if (char === '\\' && !escape) {
                const nextChar = i < jsonString.length - 1 ? jsonString[i + 1] : '';
                // AUTO-ACADEMIC-PAPER-RC1 FIX: 
                // We removed 'b' from valid escapes. Why?
                // Because '\begin' in a JSON string (e.g. "content": "\begin{...}")
                // is often output by AI as literally `\begin`.
                // Standard JSON parsers see `\b` as backspace (ASCII 8).
                // We want `\b` to be preserved as `\b` characters.
                // So we treat `\b` as INVALID, which triggers the logic to double it to `\\b`.
                // This means `\begin` -> `\\begin` -> parsed as `\begin` string. Success.
                // We also removed '/' because '\/' is valid but unnecessary, and sometimes matches dates.
                // We kept check for common ones: " \ / n r t u
                if (['"', '\\', '/', 'f', 'n', 'r', 't', 'u'].includes(nextChar)) {
                    // Valid JSON escape sequence - mark as escaped
                    escape = true;
                    result += char;
                } else {
                    // Invalid JSON escape (like \& \% \# AND \b for begin) - double the backslash to fix
                    // This turns \& into \\& which is valid JSON, parsing to \&
                    // This turns \begin into \\begin which is valid JSON, parsing to \begin
                    result += '\\\\';
                    escape = false;
                }
                continue;
            }
        }
        result += char;
        escape = false;
    }
    return result;
}


/**
 * Sanitize AI-generated LaTeX for the server-side compiler.
 * This acts as a safety net for things the prompt failed to prevent.
 */
export function sanitizeLatexOutput(text: string): string {
    let clean = text;

    // 1. STRIP REASONING ARTIFACTS
    // Models often output "Thinking Algorithm: ... " or "Reasoning: ..." blockquote style.
    // We strip lines starting with "> " (Markdown blockquote).
    // REVERTED (v1.9.141): Back to original DELETE logic.
    // The complex Block Matcher (v1.9.139-140) caused false positives (deleting valid content)
    // and false negatives (leaking reasoning). The original DELETE logic is more predictable:
    // - If AI quotes reasoning: `> Thinking...` -> Deleted (Good)
    // - If AI quotes abstract: `> This paper...` -> Deleted (Acceptable edge case)
    // User prefers occasional edge case loss over consistent paragraph-level failures.
    clean = clean.replace(/^>.*(\r?\n|$)/gm, ""); // DELETE lines starting with >

    clean = clean.replace(/^Thinking Process:[\s\S]*?(\n\n|$)/gim, ""); // Remove "Thinking Process:" blocks

    // AUTO-ACADEMIC-PAPER-RC1 (v1.9.88): Strip Markdown-style thinking
    clean = clean.replace(/^\*Thinking\.*\*\s*(\r?\n|$)/gim, ""); // Remove "*Thinking...*" lines
    clean = clean.replace(/^\*Thinking\s+Process\.*\*\s*(\r?\n|$)/gim, ""); // Remove "*Thinking Process...*"

    // Safe cleaning: Only remove prefix
    clean = clean.replace(/^Here is the content[:.]?\s*/im, "");
    clean = clean.replace(/^Sure, here is the section[:.]?\s*/im, "");
    clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, ""); // Remove XML-style thought tags (common in some fine-tunes)

    // AUTO-ACADEMIC-PAPER-RC1 (v1.9.91): Explicit Abstract Cleaning
    clean = clean.replace(/^Abstract:\s*/i, "");
    clean = clean.replace(/^Title:\s*/i, "");
    // Safe cleaning: Only remove the specific prefix, preserve the rest of the line
    clean = clean.replace(/^Here is the abstract[:.]?\s*/im, "");
    clean = clean.replace(/^Sure, here is the abstract[:.]?\s*/im, "");



    // 2. CONVERT MARKDOWN TO LATEX
    // The user wants "Latex version should show latex, not markdown".
    // Bold: **text** -> \textbf{text}
    clean = clean.replace(/\*\*([^*]+)\*\*/g, "\\textbf{$1}");
    // Italic: *text* -> \textit{text} (Careful not to break math $...$)
    // We only replace * if it's not inside $...$ (Basic heuristic: Assume math uses $, non-math uses *)
    // Better heuristic: match *text* only if text doesn't contain space? No, text usually contains spaces.
    // Let's stick to **bold** as it's the most common hallucination. *Italic* overlaps with multiplication 2*3 too easily.

    // Headers: # Header -> \section{Header}, ## -> \subsection, etc.
    // IMPROVED: Handle leading whitespace and order from deepest (####) to shallowest (#) to avoid false matches.
    clean = clean.replace(/^\s*####\s+(.+)$/gm, "\\paragraph{$1}");
    clean = clean.replace(/^\s*###\s+(.+)$/gm, "\\subsubsection{$1}");
    clean = clean.replace(/^\s*##\s+(.+)$/gm, "\\subsection{$1}");
    clean = clean.replace(/^\s*#\s+(.+)$/gm, "\\section{$1}");

    return clean
        // Universal Math Repair (v1.6.16):
        // Fixes orphaned subscripts/superscripts like `$\theta$_t` or `^2` by merging them back into math mode.
        // Matches: Closing $ (not escaped), followed by _ or ^, followed by a char or {...} block.
        // Replacement: Moves the operator and payload BEFORE the closing $.
        .replace(/(?<!\\)\$\s*([_^])\s*(\{[^}]*\}|[a-zA-Z0-9])/g, '$1$2$')
        // Replace unsupported symbols
        .replace(/\\smalltriangleup/g, '$\\triangle$')
        .replace(/\\checkmark/g, '$\\checkmark$')
        // Strip colors (server-side safety)
        .replace(/\\textcolor\{[^}]+\}\{([^}]*)\}/g, '$1')
        .replace(/\\color\{[^}]+\}/g, '')
        // Ensure \theta is in math mode if not already
        .replace(/(?<!\$)\\theta/g, '$\\theta$');
}

/**
 * Sanitize LaTeX specifically for EXPORT to standalone .tex file.
 * This runs "Just-In-Time" before download to fix common compilation errors
 * that might be tolerated by the web preview but crash pdflatex.
 */
/**
 * Context-Aware Ampersand Sanitizer (The "Smart" Fix)
 * Parsed LaTeX structure to distinguish between:
 * - Alignment Tabs (& in tables/math): PROTECT
 * - Text Ampersands (R&D, Unity & Catalog): ESCAPE (\&)
 * - Preamble/Verbatim (& in \usepackage or \url): PROTECT
 */
function escapeTextAmpersands(latex: string): string {
    // 0. PREAMBLE PROTECTION (Critical Fix)
    // We must NOT escape & in \usepackage[...], \documentclass[...], etc.
    const docStart = latex.indexOf('\\begin{document}');
    let preamble = "";
    let body = latex;

    if (docStart !== -1) {
        preamble = latex.substring(0, docStart);
        body = latex.substring(docStart);
    } else {
        // Fallback: If no document environment found (snippet?), process everything.
        // But warning: this might inadvertently break top-level commands if it's a preamble-only snippet.
        // Assuming body for safety if unsure.
    }

    let result = '';
    const envStack: string[] = [];
    // Environments where & is structural
    const structuralEnvs = new Set([
        'tabular', 'tabular*', 'tabularx', 'longtable',
        'align', 'align*', 'alignat', 'split', 'cases',
        'array', 'matrix', 'bmatrix', 'pmatrix', 'vmatrix', 'Vmatrix'
    ]);
    // Commands whose arguments are verbatim/code (SKIP sanitization inside)
    const verbatimCmds = new Set(['url', 'href', 'code', 'verb']);

    let i = 0;
    while (i < body.length) {
        const char = body[i];

        // 1. Handle Escapes / Commands
        if (char === '\\') {
            const substr = body.substring(i);

            // 1a. Detect Verbatim Commands (\url{...})
            // Optimization: check if next chars match any verbatim cmd
            const cmdMatch = substr.match(/^\\([a-zA-Z@]+)/);
            if (cmdMatch) {
                const cmdName = cmdMatch[1];

                // If it's a verbatim command, skip the command AND its argument
                if (verbatimCmds.has(cmdName)) {
                    // Copy command (\url)
                    result += cmdMatch[0];
                    i += cmdMatch[0].length;

                    // Check for optional arg [] (skip it)
                    if (i < body.length && body[i] === '[') {
                        let bracketDepth = 1;
                        result += '[';
                        i++;
                        while (i < body.length && bracketDepth > 0) {
                            if (body[i] === '[') bracketDepth++;
                            else if (body[i] === ']') bracketDepth--;
                            result += body[i];
                            i++;
                        }
                    }

                    // Check for mandatory arg {} (skip it)
                    if (i < body.length && body[i] === '{') {
                        let braceDepth = 1;
                        result += '{';
                        i++;
                        while (i < body.length && braceDepth > 0) {
                            // Simple brace counting (ignoring escapes inside url is actually usually correct for latex parsers too)
                            if (body[i] === '{') braceDepth++;
                            else if (body[i] === '}') braceDepth--;
                            result += body[i];
                            i++;
                        }
                    }
                    continue;
                }
            }

            // 1b. Detect Environment Start
            const beginMatch = substr.match(/^\\begin\s*\{([^}]+)\}/);
            if (beginMatch) {
                envStack.push(beginMatch[1]);
                result += beginMatch[0];
                i += beginMatch[0].length;
                continue;
            }

            // 1c. Detect Environment End
            const endMatch = substr.match(/^\\end\s*\{([^}]+)\}/);
            if (endMatch) {
                const envName = endMatch[1];
                if (envStack.length > 0) {
                    const last = envStack[envStack.length - 1];
                    // Strict matching + normalization for aligned environments
                    if (last === envName || last.replace(/\*/, '') === envName.replace(/\*/, '') || structuralEnvs.has(last)) {
                        envStack.pop();
                    }
                }
                result += endMatch[0];
                i += endMatch[0].length;
                continue;
            }

            // Regular Escape or other command
            // Copy backslash
            result += char;
            i++;
            // Copy next char literal
            if (i < body.length) {
                result += body[i];
                i++;
            }
            continue;
        }

        // 2. Handle Comments
        if (char === '%') {
            result += char;
            i++;
            while (i < body.length && body[i] !== '\n') {
                result += body[i];
                i++;
            }
            continue;
        }

        // 3. Handle Ampersand
        if (char === '&') {
            let isStructural = false;
            // Check stack (from top down)
            for (let j = envStack.length - 1; j >= 0; j--) {
                const env = envStack[j].replace(/\*$/, ''); // Normalize align*
                if (structuralEnvs.has(env)) {
                    isStructural = true;
                    break;
                }
            }

            if (isStructural) {
                result += '&'; // Keep alignment tab
            } else {
                result += '\\&'; // Escape text ampersand
            }
            i++;
            continue;
        }

        // Default: Copy char
        result += char;
        i++;
    }

    // Recombine (Preamble Unchanged + Sanitized Body)
    return preamble + result;
}

export function sanitizeLatexForExport(latex: string): string {
    if (!latex) return "";
    let clean = latex;

    // 0. RUNAWAY ARGUMENT PROTECTION
    // NOTE: The "Cascade Stopper" (force-closing at paragraph breaks) was REMOVED.
    // It created orphan braces that caused cascading compile errors.
    // We now rely on fixLatexBalance() at EOF for unclosed structures.

    // Splitter - Break valid commands that incorrectly span paragraphs.
    // This is safe because it preserves both { and }.
    clean = clean.replace(/(\\(?:textbf|textit|texttt|textsc))\{([^{}\n]+?)\n\s*\n([^{}\n]+?)\}/g, '$1{$2}\n\n$1{$3}');

    // 1. SAFETY NET: Escape orphaned "ref_X"
    clean = clean.replace(/\(ref_(\d+)\)/g, "(ref\\_$1)");

    // 2. ALGORITHM PACKAGE FIX
    clean = clean.replace(/\\REQUIRE/g, '\\Require');
    clean = clean.replace(/\\ENSURE/g, '\\Ensure');
    clean = clean.replace(/\\STATE/g, '\\State');
    clean = clean.replace(/\\IF/g, '\\If');
    clean = clean.replace(/\\ENDIF/g, '\\EndIf');
    clean = clean.replace(/\\ELSE/g, '\\Else');
    clean = clean.replace(/\\ELSIF/g, '\\ElsIf');
    clean = clean.replace(/\\FOR/g, '\\For');
    clean = clean.replace(/\\ENDFOR/g, '\\EndFor');
    clean = clean.replace(/\\WHILE/g, '\\While');
    clean = clean.replace(/\\ENDWHILE/g, '\\EndWhile');
    clean = clean.replace(/\\RETURN/g, '\\Return');
    clean = clean.replace(/\\COMMENT/g, '\\Comment');

    // 3. ALGORITHM TEXT MODE FIX
    clean = clean.replace(/\\text\{if\s*\}/g, 'if ');
    clean = clean.replace(/\\text\{then\s*\}/g, 'then ');
    clean = clean.replace(/\\text\{else\s*\}/g, 'else ');
    clean = clean.replace(/\\text\{end\s*\}/g, 'end ');
    clean = clean.replace(/\\text\{for\s*\}/g, 'for ');
    clean = clean.replace(/\\text\{while\s*\}/g, 'while ');
    clean = clean.replace(/\\text\{do\s*\}/g, 'do ');
    clean = clean.replace(/\\text\{return\s*\}/g, 'return ');
    clean = clean.replace(/\\text\{([A-Z][a-zA-Z]*)\}/g, '$1');

    // 4. PACKAGE INJECTION (Belt & Suspenders)
    if (!clean.includes("\\usepackage[utf8]{inputenc}")) {
        clean = clean.replace(/\\documentclass(\[[^\]]*\])?\{[^}]+\}/, (m) => `${m}\n\\usepackage[utf8]{inputenc}`);
    }
    if (!clean.includes("\\usepackage{booktabs}")) {
        clean = clean.replace(/\\documentclass(\[[^\]]*\])?\{[^}]+\}/, (m) => `${m}\n\\usepackage{booktabs}`);
    }
    if (!clean.includes("\\usepackage{float}")) {
        clean = clean.replace(/\\documentclass(\[[^\]]*\])?\{[^}]+\}/, (m) => `${m}\n\\usepackage{float}`);
    }

    // 5. PLACEMENT ENFORCEMENT ([H])
    clean = clean.replace(/\\begin\{(table|figure|algorithm)(\*?)\}(?:\[[^\]]*\])?/g, '\\begin{$1$2}[H]');

    // 6. CONTEXT-AWARE & SANITIZATION (The Smart Fix)
    // Runs state machine to safely escape & in text only
    clean = escapeTextAmpersands(clean);

    // 7. BACKTICK FIX
    // CRITICAL: Regex must NOT span lines ([^`\n] not [^`])!
    // If AI generates an orphan backtick, the old regex would match to the NEXT backtick
    // anywhere in the document, corrupting all LaTeX commands in between.
    clean = clean.replace(/`([^`\n]+)`/g, (match, code) => {
        const escapedCode = code.replace(/\\/g, "\\textbackslash{}");
        return `\\texttt{${escapedCode}}`;
    });

    // 8. ORPHAN BACKTICK FIX
    clean = clean.replace(/`/g, "\\textasciigrave{}");

    // 9. BALANCE FIXER
    clean = fixLatexBalance(clean);

    // 10. MATH MODE REPAIR
    clean = clean.replace(/(?<!\\)\$\s*([_^])\s*(\{[^}]*\}|[a-zA-Z0-9])/g, '$1$2$');

    return clean;
}

/**
 * Scans LaTeX content and appends missing closing braces/environments.
 * Rebuilds the string to inject closing tags INLINE when a mismatch occurs (e.g. before \end{document}).
 */
export function fixLatexBalance(latex: string): string {
    let result = "";
    const envStack: string[] = [];
    let braceDepth = 0;

    // State machine states
    let state: "NORMAL" | "ESCAPE" | "COMMENT" = "NORMAL";
    let i = 0;

    while (i < latex.length) {
        const char = latex[i];

        if (state === "ESCAPE") {
            // Escape mode: just copy and reset
            result += char;
            state = "NORMAL";
            i++;
            continue;
        }

        if (state === "COMMENT") {
            result += char;
            if (char === '\n') {
                state = "NORMAL";
            }
            i++;
            continue;
        }

        if (char === '\\') {
            state = "ESCAPE";
            // Check for \begin or \end BEFORE adding backslash to result?
            // If we copy '\\', then we parse 'begin...' next loop? No.
            // We must lookahead NOW to handle environments structurally.

            const substr = latex.substring(i);
            const beginMatch = substr.match(/^\\begin\s*\{([^}]+)\}/);
            if (beginMatch) {
                // Found \begin{...}
                envStack.push(beginMatch[1]);
                result += beginMatch[0];
                i += beginMatch[0].length;
                state = "NORMAL"; // Handled
                continue;
            }

            const endMatch = substr.match(/^\\end\s*\{([^}]+)\}/);
            if (endMatch) {
                const envName = endMatch[1];
                const fullTag = endMatch[0];

                // Mismatch Detection and Fix
                if (envStack.length > 0) {
                    const lastEnv = envStack[envStack.length - 1];

                    if (lastEnv === envName) {
                        // Perfect match
                        // First, close any dangling braces inside this env!
                        while (braceDepth > 0) {
                            result += "}";
                            braceDepth--;
                        }
                        envStack.pop();
                        result += fullTag;
                    } else {
                        // Mismatch! e.g. Expecting \end{itemize}, found \end{document}
                        // OR Expecting \end{itemize}, found \end{enumerate}

                        // Strategy: Check if 'envName' is deeper in the stack (e.g. document)
                        // If we found \end{document}, we should close everything up to 'document'.
                        const stackIndex = envStack.lastIndexOf(envName);

                        if (stackIndex !== -1) {
                            // The tag we found DOES exist in stack, but it's not at the top.
                            // Example: Stack=[doc, itemize], Found=\end{doc}
                            // We must close [itemize] first.

                            // 1. Close dangling braces
                            while (braceDepth > 0) {
                                result += "}";
                                braceDepth--;
                            }

                            // 2. Close intermediate environments
                            // Pop until we reach stackIndex (exclusive)
                            while (envStack.length - 1 > stackIndex) {
                                const unclosed = envStack.pop()!;
                                result += `\\end{${unclosed}}`;
                                // Reset braces for new context? structure logic implies braces are local to context? 
                                // Simplified: yes, assume 0 for now as we just closed them.
                            }

                            // 3. Now we are at [doc], and found \end{doc}. Match!
                            envStack.pop();
                            result += fullTag;

                        } else {
                            // The tag we found is NOT in stack. (Orphan end)
                            // e.g. Stack=[doc], Found=\end{weird}
                            // Treat as text/ignore? Or assume user made typo?
                            // Safe bet: Keep it, don't change stack.
                            result += fullTag;
                        }
                    }
                } else {
                    // Stack empty, orphan end. Keep it.
                    result += fullTag;
                }

                i += fullTag.length;
                state = "NORMAL";
                continue;
            }

            // Not an env command, just regular escape (e.g. \text)
            result += char;
            i++;
            continue;
        }

        if (char === '%') {
            state = "COMMENT";
            result += char;
            i++;
            continue;
        }

        // Structural Characters
        if (char === '{') {
            braceDepth++;
        } else if (char === '}') {
            if (braceDepth > 0) {
                braceDepth--;
            }
        }

        result += char;
        i++;
    }

    // FINAL CLEANUP: Ensure everything is closed at EOF
    while (braceDepth > 0) {
        result += "}";
        braceDepth--;
    }
    while (envStack.length > 0) {
        const unclosed = envStack.pop()!;
        result += `\\end{${unclosed}}`;
    }

    return result;
}

/**
 * Robustly extracts and parses JSON from AI output.
 * Handles markdown fences, extra text, and both Objects/Arrays.
 */
export function extractJson(content: string): any {
    // 1. Remove markdown fences (Robust Regex)
    let clean = content.trim();
    // Remove ```json ... ``` or just ``` ... ```
    clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "");

    // 2. Find the outer-most JSON structure (Object or Array)
    const firstBrace = clean.indexOf('{');
    const firstBracket = clean.indexOf('[');

    let start = -1;
    let end = -1;

    // Determine if it's an Object or Array based on which appears first
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        start = firstBrace;
        end = findBalancedJsonEnd(clean, start, '{', '}');
    } else if (firstBracket !== -1) {
        start = firstBracket;
        end = findBalancedJsonEnd(clean, start, '[', ']');
    }

    // AUTO-ACADEMIC-PAPER-RC1 FIX: Enforce Object/Array to prevent primitive parsing bugs
    if (start === -1) {
        throw new Error(`No JSON object or array found (expected { or [). First 50 chars: "${clean.substring(0, 50)}..."`);
    }

    if (end !== -1) {
        clean = clean.substring(start, end + 1);
    } else {
        // Truncated or malformed (no closing found) - take everything from start
        clean = clean.substring(start);
    }

    // 3. Fix escaping issues (Legacy helper)
    // Only apply if simple parse fails, to avoid breaking valid JSON?
    // The legacy code applied it always. Let's keep it but be careful.
    // Actually, let's try to parse FIRST. If it fails, then fix escaping.

    try {
        return JSON.parse(clean);
    } catch (e) {
        // AUTO-ACADEMIC-PAPER-RC1 FIX: Handle Unwrapped JSON Properties
        // Flash models often output `"found": false` instead of `{ "found": false }`
        // Error: "Unexpected non-whitespace character after JSON at position 7"
        const errStr = String(e);
        if (errStr.includes("Unexpected non-whitespace character") || errStr.includes("Unexpected token :")) {
            // Check if it looks like a property: starts with "key":
            if (/^\s*"[^"]+"\s*:/.test(clean)) {
                try {
                    const wrapped = `{${clean}}`;
                    return JSON.parse(wrapped);
                } catch (wrapErr) {
                    // Ignore wrapper failure, proceed to standard escaping fix
                }
            }
        }

        // If simple parse fails, try fixing escaping
        const fixed = fixAIJsonEscaping(clean);
        try {
            return JSON.parse(fixed);
        } catch (e2) {
            // Check if wrapping helps the FIXED string (e.g. unwrapped + bad escapes)
            if (/^\s*"[^"]+"\s*:/.test(fixed)) {
                try {
                    return JSON.parse(`{${fixed}}`);
                } catch (e3) { /* Ignore */ }
            }

            // DETECT TRUNCATION: Check for common JSON parsing errors related to incomplete output
            const errorMsg = e2 instanceof Error ? e2.message : String(e2);
            const isTruncated =
                errorMsg.includes("Unexpected end of JSON input") ||
                errorMsg.includes("Unterminated string") ||
                errorMsg.includes("End of data");

            if (isTruncated) {
                // Throw a specific error that we can catch upstream to abort retries
                throw new Error(`AI_OUTPUT_TRUNCATED: The model response was cut off. This usually means the model hit its max output token limit. Try reducing the 'Enhancement Level' or using a model with a larger context window.`);
            }

            // If that also fails, throw the original error but with more context
            // We truncate the content in the error message to avoid spam
            const preview = clean.length > 200 ? clean.substring(clean.length - 200) : clean;
            throw new Error(`Failed to parse JSON: ${errorMsg}. End of content: "...${preview}"`);
        }
    }
}

/**
 * Escapes special LaTeX characters in a string.
 */
export function escapeLatex(text: string): string {
    if (!text) return "";
    return text
        .replace(/\\/g, "\\textbackslash{}")
        .replace(/[{}]/g, (m) => `\\${m}`)
        .replace(/[%$#&_]/g, (m) => `\\${m}`)
        .replace(/~/g, "\\textasciitilde{}")
        .replace(/\^/g, "\\textasciicircum{}");
}

/**
 * Finds the matching closing brace for a JSON structure, respecting strings and escapes.
 * Returns the index of the matching closeChar, or -1 if not found.
 */
function findBalancedJsonEnd(text: string, startIndex: number, openChar: string, closeChar: string): number {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < text.length; i++) {
        const char = text[i];

        if (inString) {
            if (char === '\\' && !escaped) {
                escaped = true;
            } else if (char === '"' && !escaped) {
                inString = false;
            } else {
                escaped = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === openChar) {
            depth++;
        } else if (char === closeChar) {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

/**
 * Applies a list of patch replacements to a text string.
 * Uses robust whitespace normalization to find matches even if newlines/spaces differ slightly.
 */
export function applyPatches(content: string, patches: { original: string; new: string }[]): string {
    let currentContent = content;

    for (const patch of patches) {
        // 1. Try Exact Match First
        if (currentContent.includes(patch.original)) {
            // AUTO-ACADEMIC-PAPER-RC1: Sanitize patch content at applying time
            // This ensures "thinking..." traces are stripped even from Rewriter patches
            const cleanNew = sanitizeLatexOutput(patch.new);
            currentContent = currentContent.replace(patch.original, cleanNew);
            console.log(`[Patch] Exact match applied for: "${patch.original.substring(0, 30)}..."`);
            continue;
        }

        // 2. Fuzzy Match (Normalize whitespace)
        // We accept that the AI might have turned newlines into spaces or vice versa
        // Strategy: Create a regex from the 'original' text where every whitespace sequence is \s+

        // Escape regex special characters in the search string
        const escapedSearch = patch.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Replace whitespace sequences with generic whitespace regex
        const fuzzyPatternStr = escapedSearch.replace(/\s+/g, '\\s+');
        const fuzzyRegex = new RegExp(fuzzyPatternStr);

        if (fuzzyRegex.test(currentContent)) {
            currentContent = currentContent.replace(fuzzyRegex, patch.new);
            console.log(`[Patch] Fuzzy match applied for: "${patch.original.substring(0, 30)}..."`);
        } else {
            console.warn(`[Patch] WARNING: Could not find match for patch: "${patch.original.substring(0, 50)}..."`);
            // We do NOT stop. We skip this patch and continue, preserving the rest of the file.
        }
    }

    return currentContent;
}
