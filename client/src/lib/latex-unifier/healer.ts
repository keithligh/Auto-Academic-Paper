/**
 * Pre-processing fixes for LaTeX input
 *
 * EXTRACTED FROM: LatexPreview.tsx sanitizeLatexForBrowser
 * SCOPE: Only safe, global string manipulations that must run before anything else.
 */

export function healLatex(content: string): string {
    let healed = content;

    // Markdown fence stripping (Line 683)
    // Note: The original regex consumes the start fence but preserves the trailing newline of the block? 
    // Logic: .replace(/^```latex\s*/i, '')
    // We preserve exact behavior.
    healed = healed.replace(/^```latex\s*/i, '').replace(/```$/, '');

    // FIX (v1.9.43): Strip literal \n (backslash-n) sequences from AI output
    // AI sometimes outputs `\\\n\hline` instead of `\\\hline` in tables
    // This is invalid LaTeX and breaks rendering
    healed = healed.replace(/\\n(?![a-zA-Z])/g, ''); // \n not followed by a letter (protects \newcommand, etc.)

    return healed;
}
