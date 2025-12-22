/*
 * LATEX GENERATOR WITH COMPILER
 * ==============================
 * This module generates LaTeX documents from DocumentAnalysis.
 * 
 * THE COMPILER (Post-Processing):
 * 1. Scans text for (ref_X)
 * 2. Replaces (ref_X) with \cite{ref_X}
 * 3. Citation Repair: Fixes hallucinated citations
 * 4. Generates \begin{thebibliography}
 * 5. Appends bibliography as References section
 */
import { DocumentAnalysis, Enhancement } from "@shared/schema";

function escapeLatex(text: string): string {
    return text
        .replace(/\\/g, "\\textbackslash{}")
        .replace(/[{}]/g, (m) => `\\${m}`)
        .replace(/[%$#&_]/g, (m) => `\\${m}`)
        .replace(/~/g, "\\textasciitilde{}")
        .replace(/\^/g, "\\textasciicircum{}");
}

function formatEnhancement(enh: Enhancement, references: { key: string }[]): string {
    if (!enh.title || !enh.description || !enh.content) {
        console.warn(`[LatexGenerator] Enhancement ${enh.id} missing fields. Skipping.`);
        return "";
    }
    const title = escapeLatex(enh.title);
    // Compile citations in description and content
    const desc = compileCitations(enh.description, references);
    const content = compileCitations(enh.content, references);

    // Removed: symbol type no longer has special handling
    // All enhancements (including symbol) are placed in their designated section

    // Enforce [H] placement for tables and figures to prevent drifting
    // Regex: Find \begin{table}[ignore old opts] or \begin{table} and replace with \begin{table}[H]
    const contentFixed = content
        .replace(/\\begin\{table\}(\[.*?\])?/gi, "\\begin{table}[H]")
        .replace(/\\begin\{figure\}(\[.*?\])?/gi, "\\begin{figure}[H]")
        .replace(/\\begin\{algorithm\}(\[.*?\])?/gi, "\\begin{algorithm}[H]");

    return `\\subsection*{${title}}\n${desc}\n\n${contentFixed}\n\n`;
}

function formatAuthorInfo(name?: string, affiliation?: string): string {
    const n = name ? escapeLatex(name) : "Author Name";
    if (affiliation && affiliation.trim()) {
        const aff = escapeLatex(affiliation);
        return `${n}\\\\${aff}`;
    }
    return n;
}

// ====== THE COMPILER ======
// Converts (ref_X) markers to \cite{ref_X} and validates citations
function compileCitations(text: string, references: { key: string }[]): string {
    // Step 1: Build a set of valid reference keys
    const validKeys = new Set(references.map(r => r.key));
    console.log(`[Compiler] Processing citations. Valid keys: ${validKeys.size}`);

    // Step 2: Replace (ref_X) with \cite{ref_X}
    // STRATEGY: "Parse, don't Regex". Match the block, then tokenize the content.
    // IMPROVED REGEX (v1.9): Matches ( ref_... ) more loosely to catch AI sloppiness
    // Matches: "(" + optional space + "ref_" + chars + ")"
    let compiled = text.replace(/\(\s*(ref_[a-zA-Z0-9_,;\s]+?)\s*\)/gi, (match, content) => {
        // CONTENT PARSER: Split by comma, semicolon, or whitespace
        const tokens = content.split(/[,\s;]+/);

        // Find valid keys in tokens
        const valid = tokens.filter((t: string) => {
            const cleanT = t.trim().replace(/[^a-zA-Z0-9_]/g, ''); // Strip punctuation
            return validKeys.has(cleanT);
        });

        if (valid.length > 0) {
            console.log(`[Compiler] Tokenized citations: "${match}" -> \\cite{${valid.join(',')}}`);
            return `\\cite{${valid.join(',')}}`;
        } else {
            // It looked like a ref but had no valid keys? 
            // Escape it so it doesn't crash LaTeX (the underscore is deadly)
            console.warn(`[Compiler] Invalid citation group (No valid keys): ${match}. Escaping to safe text.`);
            return escapeLatex(match);
        }
    });

    // Step 3: Citation Merging - combine adjacent \cite{} commands
    // Converts \cite{ref_1} \cite{ref_2} -> \cite{ref_1,ref_2}
    let prev;
    let loopCount = 0;
    do {
        prev = compiled;
        compiled = compiled.replace(/\\cite\{([^}]+)\}\s*\\cite\{([^}]+)\}/g, (match, keys1, keys2) => {
            console.log(`[Compiler] Merging adjacent citations: ${match}`);
            return `\\cite{${keys1},${keys2}}`;
        });
        loopCount++;
    } while (compiled !== prev && loopCount < 10); // Safety break

    // Step 4: Citation Repair - detect any hallucinated \cite{} that aren't in our list
    compiled = compiled.replace(/\\cite\{([^}]+)\}/g, (match, key) => {
        const keys = key.split(',');
        const allValid = keys.every((k: string) => {
            // Strip any lingering whitespace
            const cleanK = k.trim();
            return validKeys.has(cleanK);
        });

        if (allValid) {
            return match;
        } else {
            console.warn(`[Compiler] Hallucinated citation detected: ${match} -> Replacing with [?]`);
            return `[?]`;
        }
    });

    // Step 5: FINAL SAFETY SWEEP - Catch any ORPHAN (ref_X) that regex missed
    // If we see "(ref_" followed by numbers, just escape it.
    // This prevents "Missing $ inserted" errors if the AI wrote "(ref_12)" but our broad regex missed it for some reason.
    compiled = compiled.replace(/\(ref_(\d+)\)/gi, (match) => {
        console.warn(`[Compiler] Caught orphan citation marker during safety sweep: ${match}`);
        return escapeLatex(match);
    });

    return compiled;
}

// Helper: Extract \usetikzlibrary{...} from content and return global set
function sanitizeTikzLibraries(enhancements: Enhancement[]): { globalLibraries: Set<string>, cleanedEnhancements: Enhancement[] } {
    const globalLibraries = new Set<string>();

    // Default libraries that should always be present
    const defaults = ["positioning", "arrows", "shapes", "calc", "decorations.pathreplacing"];
    defaults.forEach(d => globalLibraries.add(d));

    const cleanedEnhancements = enhancements.map(enh => {
        if (!enh.content) return enh;

        let content = enh.content;
        // Regex to find \usetikzlibrary{...}
        // Matches: \usetikzlibrary { lib1, lib2 }
        const regex = /\\usetikzlibrary\s*\{([^}]+)\}/g;

        let match;
        let libsFound = false;

        while ((match = regex.exec(content)) !== null) {
            libsFound = true;
            const libs = match[1].split(',');
            libs.forEach(l => {
                const clean = l.trim();
                if (clean) globalLibraries.add(clean);
            });
        }

        if (libsFound) {
            // Remove the lines from content
            content = content.replace(regex, "");
            // Clean up empty lines left behind
            content = content.replace(/^\s*[\r\n]/gm, "");
            return { ...enh, content };
        }

        return enh;
    });

    return { globalLibraries, cleanedEnhancements };
}

// Generate LaTeX document from analysis
export async function generateLatex(
    analysis: DocumentAnalysis,
    enhancements: Enhancement[],
    paperType: string,
    authorName?: string,
    authorAffiliation?: string,
    writerModel?: string,
    strategistModel?: string,
    librarianModel?: string
): Promise<string> {
    try {
        const enabled = enhancements.filter((e) => e.enabled);

        if (!analysis.title) {
            console.warn("[LatexGenerator] Analysis missing title. Using default.");
            analysis.title = "Untitled Academic Paper";
        }
        if (!analysis.abstract) {
            console.warn("[LatexGenerator] Analysis missing abstract. Using default.");
            analysis.abstract = "Abstract not provided.";
        }

        const title = escapeLatex(analysis.title);

        // Sanitize TikZ Libraries from ALL enhancements (before processing sections)
        // This prevents \usetikzlibrary from appearing in the body
        const { globalLibraries, cleanedEnhancements } = sanitizeTikzLibraries(enabled);

        // Use cleaned enhancements for the rest of generation
        // Note: We need to update 'enabled' reference or use the cleaned array
        // Since 'enabled' is a local const, we'll use 'processedEnhancements'
        const processedEnhancements = cleanedEnhancements;

        // Run COMPILER on abstract
        const abstract = compileCitations(analysis.abstract, analysis.references || []);

        // Removed: symbolDefs no longer extracted to preamble
        // Symbol enhancements now placed in sections like other types

        // === CJK DETECTION ===
        const hasCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(analysis.sections?.map(s => s.content).join(" ") || "")
            || /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(analysis.abstract || "");

        const cjkPreamble = hasCJK ? "\\usepackage{CJKutf8}" : "";
        const cjkStart = hasCJK ? "\\begin{CJK*}{UTF8}{min}" : "";
        const cjkEnd = hasCJK ? "\\end{CJK*}" : "";
        // =====================

        let latex = `\\documentclass[11pt]{article}

% Packages
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{amsthm}
\\usepackage[margin=1in]{geometry}
\\usepackage[numbers,sort&compress]{natbib}
\\usepackage{listings}
\\usepackage{algorithm}
\\usepackage{algpseudocode}
\\usepackage{tabularx}
\\usepackage{booktabs} % Fixes \\toprule crashes
\\usepackage{float}    % Fixes table drifting with [H]
${cjkPreamble}

% TikZ and diagram packages
\\usepackage{tikz}
\\usetikzlibrary{${Array.from(globalLibraries).join(',')}}
\\usepackage{forest}

% Theorem environments
\\newtheorem{theorem}{Theorem}
\\newtheorem{lemma}{Lemma}
\\newtheorem{proposition}{Proposition}
\\newtheorem{corollary}{Corollary}
\\newtheorem{hypothesis}{Hypothesis}
\\newtheorem{definition}{Definition}
\\newtheorem{remark}{Remark}
\\newtheorem{constraint}{Constraint}

% Paragraph formatting - no indentation, line breaks between paragraphs
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{1em}

% Title and author
\\title{${title}}
\\author{${formatAuthorInfo(authorName, authorAffiliation)}}
\\date{\\today}


\\begin{document}
${cjkStart}
\\maketitle
\\begin{abstract}
${abstract}
\\end{abstract}

`;

        if (!analysis.sections || analysis.sections.length === 0) {
            console.warn("[LatexGenerator] No sections found. Creating default section.");
            analysis.sections = [{ name: "Introduction", content: "Content generation failed or was empty." }];
        }

        // Track placed enhancements to avoid duplicates
        const placedEnhancementIds = new Set<string>();

        for (const sec of analysis.sections) {
            try {
                if (!sec.name || !sec.content) {
                    console.warn(`[LatexGenerator] Skipping invalid section: ${JSON.stringify(sec)}`);
                    continue;
                }
                const secName = escapeLatex(sec.name);

                // Run COMPILER on section content
                let secContent = compileCitations(sec.content, analysis.references || []);

                // SANITIZATION: Remove redundant \section{...} if the AI hallucinated it at the start
                secContent = secContent.replace(/^\s*\\section\{[^}]+\}\s*/i, "");

                // SANITIZATION: Remove "SECTION NAME:" / "CONTENT:" hallucinations (AI chat residue)
                // Example: "SECTION NAME: Introduction\nCONTENT:\nThis paper..."
                secContent = secContent.replace(/^SECTION NAME:[\s\S]*?\nCONTENT:\s*/i, "");
                secContent = secContent.replace(/^SECTION TITLE:[\s\S]*?\nCONTENT:\s*/i, "");
                // v1.9.127: Also catch "NAME:...CONTENT:" without SECTION prefix
                secContent = secContent.replace(/^NAME:[\s\S]*?\nCONTENT:\s*/i, "");
                secContent = secContent.replace(/^CONTENT:\s*/i, "");

                // Add Section Header
                latex += `\\section{${secName}}\n\n`;

                // --- INLINE ENHANCEMENT PLACEMENT ---
                // Improved Matching Logic (v2.0): Robust Normalization
                const normalizeSectionName = (s: string) => {
                    return s.toLowerCase()
                        .replace(/^(section|part|chapter)\s+/i, "") // Remove "Section" prefix
                        .replace(/^(\d+|[xmivlc]+)\s*[.:-]\s*/i, "") // Remove numbering (1., IV., etc.)
                        .replace(/[^a-z0-9]/g, ""); // Strip all punctuation/spaces for fuzzy comparison
                };

                const secNameNorm = normalizeSectionName(sec.name || "");

                // Use processedEnhancements (cleaned of \usetikzlibrary)
                const secEnhs = processedEnhancements.filter((e) => {
                    // symbol type now included in section placement
                    const loc = (e.location || "").toLowerCase();
                    const locNorm = normalizeSectionName(loc);

                    // 1. Direct weak match (original logic)
                    if (sec.name?.toLowerCase().includes(loc) || loc.includes(sec.name?.toLowerCase() || "")) return true;

                    // 2. Normalized strict match (handles "IV. Methodology" vs "Methodology")
                    if (secNameNorm.includes(locNorm) || locNorm.includes(secNameNorm)) return true;

                    return false;
                });

                // Insert enhancements immediately after header
                for (const enh of secEnhs) {
                    try {
                        if (enh.id && placedEnhancementIds.has(enh.id)) continue;
                        if (enh.id) placedEnhancementIds.add(enh.id);

                        latex += formatEnhancement(enh, analysis.references || []);
                    } catch (enhError) {
                        console.error(`[LatexGenerator] Failed to format enhancement ${enh.id}:`, enhError);
                    }
                }

                // Add Section Content
                latex += `${secContent}\n\n`;

            } catch (secError) {
                console.error(`[LatexGenerator] Error processing section ${sec.name}:`, secError);
                latex += `\\section{${sec.name || "Error"}}\n\n[Section content could not be generated due to an error]\n\n`;
            }
        }

        // --- UNMATCHED ENHANCEMENTS ---
        const unmatched = processedEnhancements.filter((e) => {
            // symbol type now included in unmatched check
            return e.id && !placedEnhancementIds.has(e.id);
        });

        if (unmatched.length > 0) {
            latex += `\n% --- Additional Enhancements ---\n`;
            for (const enh of unmatched) {
                try {
                    latex += formatEnhancement(enh, analysis.references || []);
                } catch (enhError) {
                    console.error(`[LatexGenerator] Failed to format unmatched enhancement ${enh.id}:`, enhError);
                }
            }
        }

        // --- BIBLIOGRAPHY ---
        if (analysis.references && analysis.references.length > 0) {
            latex += `\n\\begin{thebibliography}{99}\n`;
            for (const ref of analysis.references) {
                const author = escapeLatex(ref.author);
                const refTitle = escapeLatex(ref.title);
                const venue = escapeLatex(ref.venue);
                const year = ref.year;
                // Check if url exists (needs casting if Typescript doesn't see it yet, or strict check)
                // v1.9.63: URL now starts on a new line for better readability
                // \\\\  = LaTeX line break (\\)
                // \\url = LaTeX \url command
                const url = (ref as any).url ? `\\\\ \\url{${(ref as any).url}}` : "";

                latex += `\\bibitem{${ref.key}} ${author}. \\textit{${refTitle}}. ${venue}, ${year}.${url}\n`;
            }
            latex += `\\end{thebibliography}\n`;
        }

        // --- FOOTER ---
        latex += `
\\vspace{2em}
\\hrule
\\vspace{0.5em}
\\footnotesize \\textit{Generated by Auto-Academic-Paper Created by Keith Li (\\url{https://github.com/keithligh})}
\\\\
\\footnotesize \\textit{Model used: Strategist Agent: ${escapeLatex(strategistModel || "Unknown")} / Writer Agent: ${escapeLatex(writerModel || "Unknown")} / Librarian Agent: ${escapeLatex(librarianModel || "Unknown")}}
\\\\
\\footnotesize \\textbf{Disclaimer:} AI-generated content can contain errors. Please fact-check and verify responsibly.
`;

        latex += `${cjkEnd}\n\\end{document}\n`;

        return latex;
    } catch (error: any) {
        console.error("[LatexGenerator] CRITICAL ERROR:", error);
        return `\\documentclass{article}
\\title{Generation Error}
\\author{System}
\\begin{document}
\\maketitle
\\section*{Critical Error}
The system encountered a critical error while generating the LaTeX document.
\\begin{verbatim}
${error.message || String(error)}
\\end{verbatim}
\\end{document}`;
    }
}
