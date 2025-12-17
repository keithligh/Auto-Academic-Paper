/**
 * Table Engine for LaTeX Preview
 * 
 * EXTRACTED FROM: LatexPreview.tsx
 * SCOPE: Manual Table Walker, row splitting, cell splitting.
 * STRATEGY: Dependency Injection for formatting to avoid circular deps.
 */

export interface TableResult {
    sanitized: string;
    blocks: Record<string, string>;
}

export function processTables(text: string, formatText: (s: string) => string): TableResult {
    const blocks: Record<string, string> = {};
    let blockCount = 0;

    const createPlaceholder = (html: string): string => {
        // Unique ID for Tables to avoid collision with main counter
        const id = `LATEXPREVIEWTABLE${blockCount++}:`;
        blocks[id] = html;
        return `\n\n${id}\n\n`; // Add whitespace for safety
    };

    const beginTags = ['\\begin{tabular}', '\\begin{tabularx}', '\\begin{longtable}'];
    let searchPos = 0;
    let result = '';

    while (searchPos < text.length) {
        let firstMatchIndex = -1;
        let matchedTag = '';

        for (const tag of beginTags) {
            const idx = text.indexOf(tag, searchPos);
            if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
                firstMatchIndex = idx;
                matchedTag = tag;
            }
        }

        if (firstMatchIndex === -1) {
            result += text.substring(searchPos);
            break;
        }

        result += text.substring(searchPos, firstMatchIndex);

        const envName = matchedTag.replace('\\begin{', '').replace('}', '');
        const endTag = `\\end{${envName}}`;

        let depth = 1;
        let currentPos = firstMatchIndex + matchedTag.length;
        let tableContentEnd = -1;

        while (currentPos < text.length) {
            if (text.startsWith(`\\begin{${envName}}`, currentPos)) {
                depth++;
                currentPos += matchedTag.length;
            } else if (text.startsWith(endTag, currentPos)) {
                depth--;
                if (depth === 0) {
                    tableContentEnd = currentPos;
                    break;
                }
                currentPos += endTag.length;
            } else {
                currentPos++;
            }
        }

        if (tableContentEnd === -1) {
            result += text.substring(firstMatchIndex);
            break;
        }

        let contentStart = firstMatchIndex + matchedTag.length;

        // Skip arguments like {lcr} or {|p{3cm}|}
        let argDepth = 0;
        let inArgs = false;
        let bodyStartIndex = contentStart;

        let i = contentStart;
        while (i < tableContentEnd) {
            if (text[i] === '{') {
                argDepth++;
                inArgs = true;
            } else if (text[i] === '}') {
                argDepth--;
            } else if (!inArgs && text[i] !== ' ' && text[i] !== '[') {
                // Heuristic: If we hit non-brace/non-space, we might be in body.
            }

            if (inArgs && argDepth === 0) {
                let nextCharIdx = i + 1;
                while (nextCharIdx < tableContentEnd && text[nextCharIdx] === ' ') nextCharIdx++;
                if (text[nextCharIdx] === '{') {
                    i = nextCharIdx - 1;
                    inArgs = false;
                } else {
                    bodyStartIndex = i + 1;
                    break;
                }
            }
            i++;
        }

        let tableBody = text.substring(bodyStartIndex, tableContentEnd);

        // FIX (v1.9.124): STRICT MODE - "Render Valid LaTeX Only"
        // User Directive: "Remove effort to fit wrong LaTeX."
        // We DISABLED the Implicit Splitter (v1.9.122) and Sanitizer (v1.9.119).
        // If the AI fails to output `\\`, the table will break. This is intended correctness.

        /* DISABLED IMPLICIT SPLITTER
        tableBody = tableBody.replace(/(\\)?\s*\\(hline|midrule|toprule|bottomrule|cline)/g, (match, p1, ruleName) => {
            if (p1) return match; 
            return `\\\\ \\${ruleName}`; 
        });
        */

        // Handle case where \hline is at very start (though rare in body)
        if (tableBody.match(/^\\(hline|midrule|toprule|bottomrule)/)) {
            // No change needed at start
        }
        // --- COLUMN WIDTH PARSING (v1.9.106) ---
        // Capture column spec from the skipped args, e.g., {p{22mm}p{48mm}p{58mm}}
        // The loop at L78-106 skipped them, but we didn't save them.
        // Let's re-extract them from the text range [contentStart, bodyStartIndex warning: might include space].
        const preamble = text.substring(contentStart, bodyStartIndex);
        let colGroupHtml = '';

        // Find the last braced argument in the preamble, which is usually the colspec
        // Caveat: \begin{tabular}[t]{...} -> [t] is skipped, then {...} is the colspec.
        // We look for the braced group that closely precedes bodyStartIndex
        const lastBraceMatch = preamble.match(/\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*$/);
        if (lastBraceMatch) {
            const colSpec = lastBraceMatch[1];
            // Simple parser for p{width} and l/c/r
            const cols = [];
            let cIdx = 0;
            while (cIdx < colSpec.length) {
                const char = colSpec[cIdx];
                if (char === 'p' || char === 'm' || char === 'b') {
                    // parse {width}
                    if (colSpec[cIdx + 1] === '{') {
                        let braceDepth = 1;
                        let width = '';
                        let k = cIdx + 2;
                        while (k < colSpec.length && braceDepth > 0) {
                            if (colSpec[k] === '{') braceDepth++;
                            else if (colSpec[k] === '}') braceDepth--;

                            if (braceDepth > 0) width += colSpec[k];
                            k++;
                        }
                        cols.push(width); // Store width
                        cIdx = k;
                        continue;
                    }
                } else if (char === 'l' || char === 'c' || char === 'r') {
                    cols.push('auto');
                } else if (char === 'X') {
                    // FIX (v1.9.111): Support tabularx X columns
                    cols.push('auto');
                } else if (char === '|') {
                    // ignore borders for now
                }
                cIdx++;
            }

            if (cols.some(c => c !== 'auto')) {
                colGroupHtml = '<colgroup>';
                cols.forEach(w => {
                    // FIX (v1.9.110): Use min-width instead of strict width.
                    // This allows dense content to expand columns beyond the p{...} spec, preventing excessive wrapping in HTML.
                    if (w !== 'auto') colGroupHtml += `<col style="min-width:${w}">`;
                    else colGroupHtml += '<col>';
                });
                colGroupHtml += '</colgroup>';
            }
        }

        // ROW SPLITTING
        const rows: string[] = [];
        let currentRow = '';
        let braceDepth = 0;

        for (let j = 0; j < tableBody.length; j++) {
            const char = tableBody[j];
            if (char === '{') braceDepth++;
            else if (char === '}') braceDepth--;

            if (braceDepth === 0 && char === '\\' && tableBody[j + 1] === '\\') {
                rows.push(currentRow);
                currentRow = '';
                j++;
            } else {
                currentRow += char;
            }
        }
        if (currentRow.trim()) rows.push(currentRow);

        // CELL SPLITTING with ROWSPAN TRACKING
        const activeRowspans: Map<number, number> = new Map(); // column -> remaining rows

        const htmlRows = rows.map((row, index) => {
            // FIX (v1.9.114): Explicit Rule Parsing
            // If this row is JUST a rule, mark the PREVIOUS row as having a border, and return empty.
            if (row.trim().match(/^\\(hline|midrule|toprule|bottomrule|cline\{[^}]*\})$/)) {
                // We can't modify the previous HTML string easily here in a map.
                // Better strategy: Return a null marker and handle in a second pass?
                // Or: Since map doesn't look back easily without side effects, let's just return empty string 
                // BUT we rely on the loop below to handle "trailing" rules?
                // actually, the better way is to check if the NEXT row is a rule.
                return '';
            }

            let cleanRow = row.replace(/\\(hline|midrule|toprule|bottomrule)/g, '');
            // Strip \cline{X-Y} commands (partial horizontal lines)
            cleanRow = cleanRow.replace(/\\cline\{[^}]*\}/g, '');

            // FIX (v1.9.115): Refined rule detection
            // 1. A rule at the START of the row belongs to the PREVIOUS row's boundary. We strip it and check for ANY MORE rules.
            //    If there are more rules (e.g. content \\ \hline), then THIS row needs a border.
            //    We use 'cleanRow' which already stripped all rules? No, cleanRow stripped them, we need to check raw 'row'.
            //    So: remove ^\s*\(rule) then check for \(rule).
            // FIX (v1.9.118): Smart Border Logic
            // Problem: Users like Header/Footer lines, but hate "Grid" (every line).
            // Problem: AI uses \hline for EVERYTHING.
            // Solution: 
            // 1. ALWAYS show \midrule, \bottomrule.
            // 2. ONLY show \hline if it's likely a Header or Footer.

            // FIX (v1.9.120): Restore Grid, Kill Short Lines
            // User Clarification: "I want separators (Grid), I hate short lines (Cline)."
            // 1. ALLOW \hline everywhere (Data, Header, Footer).
            // 2. IGNORE \cline (Short lines from nowhere).

            // Problem: AI uses \hline for EVERYTHING.
            // Solution: 
            // 1. ALWAYS show \midrule, \bottomrule.
            // 2. ONLY show \hline if it's likely a Header or Footer.

            // FIX (v1.9.121): Correctness Restoration
            // The "Short Lines from Nowhere" were NOT \cline. They were "Ghost Rows" caused by the Backslash Bug.
            // Since we fixed the Backslash Bug (v1.9.119), we can now safely support \cline (valid LaTeX).
            // We still support \hline everywhere (Grid).

            // Check current row for rules
            const rawRowWithoutLeadingRule = row.replace(/^\s*\\(hline|midrule|toprule|bottomrule|cline\{[^}]*\})/, '');

            // FIX (v1.9.125): Support \cline (Partial Borders)
            // Parse \cline{start-end} to apply borders to specific cells.
            interface ClineRange { start: number; end: number; }
            const clines: ClineRange[] = [];
            const clineRegex = /\\cline\{(\d+)-(\d+)\}/g;
            let clineMatch;
            while ((clineMatch = clineRegex.exec(row)) !== null) {
                clines.push({ start: parseInt(clineMatch[1]), end: parseInt(clineMatch[2]) });
            }

            // Detect Full Width Rules OR Cline

            // Detect Full Width Rules OR Cline
            // \hline, \midrule, \bottomrule trigger full border.
            const hasFullRule = rawRowWithoutLeadingRule.match(/\\(hline|midrule|bottomrule)/);
            // We don't necessarily want border-bottom class for \cline because \cline draws its OWN line via CSS/HTML handling?
            // Actually, table-engine already handles \cline stripping at line 223?
            // Wait, line 223: cleanRow = cleanRow.replace(/\\cline\{[^}]*\}/g, '');
            // We strip it. If we strip it and don't add a border class, it disappears.
            // IMPL: Detecting \cline and passing it through is hard if we stripped it.
            // BUT: standard table-engine logic DOES handle \cline logic? 
            // Looking at code: We don't seem to have explicit \cline rendering logic in the cell loop!
            // Line 257 handles `multicolumn` and `multirow`. 
            // Unless `\cline` is handled by converting to a border on specific cells?
            // The codebase does NOT seem to implement per-cell borders for \cline.
            // Therefore: Ignoring \cline for the *Row Class* is actually CORRECT for this engine (it can't render partial lines yet).
            // Rendering it as a full border would be WRONG (Partial -> Full).
            // So: I will KEEP ignoring \cline for the border, but purely because we don't support partial rendering yet.
            // However, to be "Correct", I should acknowledge I am ignoring it due to limitation, not "Hate".

            // For now, let's stick to the Full Rule detection.
            const shouldHaveBorder = hasFullRule; // || nextRowStartsFullRule (Wait, I removed lookahead in previous step? No, it was there)

            // Re-adding lookahead for robustness
            const nextRow = rows[index + 1];
            const nextRowStartsFullRule = nextRow && nextRow.trim().match(/^\\(hline|midrule|bottomrule)/);

            const finalShouldHaveBorder = shouldHaveBorder || nextRowStartsFullRule;

            const rowClass = finalShouldHaveBorder ? ' class="with-border-bottom"' : '';

            const cells: string[] = [];
            let currentCell = '';
            braceDepth = 0;

            for (let k = 0; k < cleanRow.length; k++) {
                const char = cleanRow[k];
                if (char === '\\' && cleanRow[k + 1] === '&') {
                    currentCell += '&';
                    k++;
                    continue;
                }

                if (char === '{') braceDepth++;
                else if (char === '}') braceDepth--;

                if (braceDepth === 0 && char === '&') {
                    cells.push(currentCell.trim());
                    currentCell = '';
                } else {
                    currentCell += char;
                }
            }
            cells.push(currentCell.trim());

            // Process cells with column position awareness
            let actualColPos = 0; // 0-indexed column position
            const htmlCellsArr: string[] = [];

            // Helper to determine border style
            // LaTeX cols are 1-indexed. actualColPos is 0-indexed.
            // If row has full border class, we don't need inline style (handled by CSS).
            // But if ONLY cline is present, we need inline style.
            // Wait, "with-border-bottom" applies to the TR. So it draws line under ALL cells.
            // If we have full border, we shouldn't add partial border style (redundant but safe).
            // If we DO NOT have full border, but HAVE clines, we add style.
            const getCellStyle = (colIndex: number, colSpan: number = 1) => {
                // Check if this cell (spanning colIndex to colIndex + colSpan - 1) overlaps with any cline
                // Cline range is inclusive [Start, End] (1-based)
                // Cell range is [colIndex + 1, colIndex + colSpan] (1-based)

                if (shouldHaveBorder) return ''; // Full row border handles it

                const cellStart1 = colIndex + 1;
                const cellEnd1 = colIndex + colSpan;

                // Check overlap with any cline
                // Overlap if (AlignStart <= ClineEnd) && (AlignEnd >= ClineStart)
                // Wait, precise \cline logic: \cline{2-3} draws line under col 2 and 3.
                // If cell spans 2-3, it gets line.
                // If cell is col 2, it gets line.
                // WE WANT THE BORDER IF *ANY PART* OF THE CELL IS COVERED?
                // Usually \cline matches cell boundaries. 
                // Let's assume simplest: If cell falls within range, add border.

                const hasCline = clines.some(c =>
                    Math.max(cellStart1, c.start) <= Math.min(cellEnd1, c.end)
                );

                return hasCline ? ' style="border-bottom: 1px solid #ccc;"' : '';
            };

            for (let cellIdx = 0; cellIdx < cells.length; cellIdx++) {
                // Skip columns that have active rowspans
                while (activeRowspans.has(actualColPos) && activeRowspans.get(actualColPos)! > 0) {
                    actualColPos++;
                }

                let cell = cells[cellIdx];

                // FIX (v1.9.124): STRICT MODE - "Render Valid LaTeX Only"
                // Disabled Sanitizer. If there is a backslash, show the backslash.

                /* DISABLED SANITIZER (v1.9.119)
                if (cell.endsWith('\\')) {
                    cell = cell.slice(0, -1).trim();
                }
                */

                // If cell is empty and this is likely a multirow continuation, skip it
                // This handles the LaTeX pattern where rows under multirow start with &
                if (cell === '' && cellIdx === 0) {
                    // Check if there's an active rowspan at column 0
                    // If so, this empty cell is the "shadow" of the rowspan - skip it
                    // If not, it's a genuinely empty first cell - render it
                    if (activeRowspans.has(0) && activeRowspans.get(0)! > 0) {
                        continue; // Skip this phantom cell
                    }
                }

                // Handle \multicolumn{N}{align}{content}
                const multicolMatch = cell.match(/^\\multicolumn\{(\d+)\}\{[^}]+\}\{([\s\S]*)\}$/);
                if (multicolMatch) {
                    const span = parseInt(multicolMatch[1]);
                    const content = formatText(multicolMatch[2]);
                    htmlCellsArr.push(`<td colspan="${span}"${getCellStyle(actualColPos, span)}>${content}</td>`);
                    actualColPos += span;
                    continue;
                }

                // Handle \multirow{N}{width}{content}
                if (cell.startsWith('\\multirow{')) {
                    const multirowBasic = cell.match(/^\\multirow\{(\d+)\}/);
                    if (multirowBasic) {
                        const rowspan = parseInt(multirowBasic[1]);
                        const startPos = multirowBasic[0].length;

                        let braceCount = 0;
                        let argNum = 0;
                        let contentStart = -1;
                        let contentEnd = -1;

                        for (let i = startPos; i < cell.length; i++) {
                            if (cell[i] === '{') {
                                braceCount++;
                                if (braceCount === 1) {
                                    argNum++;
                                    if (argNum === 2) contentStart = i + 1;
                                }
                            } else if (cell[i] === '}') {
                                braceCount--;
                                if (braceCount === 0 && argNum === 2) {
                                    contentEnd = i;
                                    break;
                                }
                            }
                        }

                        if (contentStart !== -1 && contentEnd !== -1) {
                            const content = cell.substring(contentStart, contentEnd);
                            htmlCellsArr.push(`<td rowspan="${rowspan}"${getCellStyle(actualColPos, 1)}>${formatText(content)}</td>`);
                            // Track this rowspan for subsequent rows
                            activeRowspans.set(actualColPos, rowspan);
                        } else {
                            htmlCellsArr.push(`<td${getCellStyle(actualColPos, 1)}>${formatText(cell)}</td>`);
                        }
                        actualColPos++;
                        continue;
                    }
                }

                // Default cell
                htmlCellsArr.push(`<td${getCellStyle(actualColPos, 1)}>${formatText(cell)}</td>`);
                actualColPos++;
            }

            // Decrement all active rowspans for next row
            Array.from(activeRowspans.keys()).forEach(col => {
                const count = activeRowspans.get(col)!;
                if (count > 1) {
                    activeRowspans.set(col, count - 1);
                } else {
                    activeRowspans.delete(col);
                }
            });

            return `<tr${rowClass}>${htmlCellsArr.join('')}</tr>`;
        }).join('');

        result += createPlaceholder(`<div class="table-wrapper"><table>${colGroupHtml}<tbody>${htmlRows}</tbody></table></div>`);

        searchPos = tableContentEnd + endTag.length;
    }

    return { sanitized: result, blocks };
}
