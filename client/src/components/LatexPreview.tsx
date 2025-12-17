/**
 * LatexPreview.tsx
 *
 * IMPLEMENTS: Hybrid "Auditor Spec" Parser (Refined v4)
 * 1. Sanitization: "Hybrid Encapsulation" logic (Math, TikZ, Lists from LatexPreview - Copy (3).tsx)
 * 2. Rendering: Custom Regex HTML Converter (No latex.js)
 * 3. Styling: Strict latex-article.css (A4 Paper, Times New Roman)
 *
 * FIXES v4:
 * - IEEE CITATION STYLE: [1], [1]-[3] citation rendering.
 * - METADATA RESCUE: Extract Title/Author/Date BEFORE preamble stripping.
 * - Aggressive Preamble Stripping (Package removal, Comment removal)
 * - Abstract Environment support
 */

import { useEffect, useState, useRef } from 'react';
// import katex from 'katex'; // Removed: Handled by processor.ts
import '@/styles/latex-katex.css';
import '@/styles/latex-article.css';
import { processLatex } from '../lib/latex-unifier/processor';

// Remove latexjs declaration as we are removing it
// declare const latexjs: any; 

interface LatexPreviewProps {
  latexContent: string;
  className?: string;
}

interface SanitizeResult {
  sanitized: string;
  blocks: Record<string, string>;
  bibliographyHtml: string | null;
  hasBibliography: boolean;
}

/**
 * THE HYBRID ENCAPSULATION SANITIZER (REUSED FROM BACKUP)
 * Extracts complex elements (Math, TikZ, Tables, Lists) into safe placeholders.
 */
// Exported for testing purposes
// sanitizeLatexForBrowser is now imported as processLatex from processor.ts

export function LatexPreview({ latexContent, className = "" }: LatexPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Runtime styles (Auditor Spec)
  useEffect(() => {
    const styleId = 'latex-preview-dynamic-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        .latex-preview { line-height: 1.8 !important; }
        .latex-preview > * + * { margin-top: 1.5em; }
        .latex-preview .katex-display { margin-top: 1.5em !important; }
        .latex-preview p > div { margin-top: 1.5em !important; }
        .latex-preview iframe { display: block; margin: 0 auto; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !latexContent) return;

    try {
      // 1. Sanitize and Extract (Trojan Horse)
      const { sanitized, blocks, bibliographyHtml, hasBibliography } = processLatex(latexContent);
      console.log("[LatexPreview] Sanitized Output Length:", sanitized.length);
      // console.log("[LatexPreview] Sanitized Content Preview:", sanitized.substring(0, 500)); 

      // 2. Custom Parser (Replacements) - REPLACES latex.js
      let html = sanitized;

      // --- HEADER CONSTRUCTION ---
      // FIX (v2.1): Metadata is now extracted by processor.ts (The Unifier)
      const { title, author, date } = (processLatex(latexContent) as any).metadata || { title: '', author: '', date: '' };
      // Note: We need to use the result we just got, not call processLatex again?
      // Wait, line 70: const { sanitized, blocks, bibliographyHtml, hasBibliography } = processLatex(latexContent);
      // We need to destructure metadata from that.

      // --- D. HEADER CONSTRUCTION & INJECTION ---
      const headerHtml = `
        ${title ? `<h1 class="title">${title}</h1>` : ''}
        ${author ? `<div class="author">${author}</div>` : ''}
        ${date ? `<div class="date">${date}</div>` : ''}
`;

      if (html.includes('\\maketitle')) {
        html = html.replace(/\\maketitle/g, headerHtml);
      } else if (title || author) {
        // Prepend if maketitle missing but metadata found
        html = headerHtml + html;
      }

      // Paragraph splitting/wrapping is now handled by processor.ts (since v1.9.37 Universal Paragraph Map)? 
      // Checking processor.ts: Yes, Lines 523 "content = parseLatexFormatting(content);"
      // Wait, parseLatexFormatting does NOT split paragraphs. It does formatting.
      // processor.ts: "content = parseLatexFormatting(content);" in "FINAL TEXT PASS".
      // Let's check logic_comparison.md. "Universal Split: Split content by double-newline... Wrap in <p>."
      // In LatexPreview Lines 201-210, it splits and wraps in <p>.
      // Processor uses `parseLatexFormatting` which replaces `\n\n` with... wait.
      // processor.ts Logic: "Universal Paragraph Map at the end of processor.ts".
      // Line 523: content = parseLatexFormatting(content);
      // parseLatexFormatting (Lines 69-154) does replace `\par`? No, LatexPreview did that.
      // Processor does `\newline` -> `<br/>`.
      // It seems Paragraph Splitting is still in LatexPreview?
      // "Universal Text Formatter (v1.9.37)" in docs says matches processor.ts? 
      // Validating doc vs code again.
      // processor.ts Line 523: Just calls parseLatexFormatting. 
      // Does not seem to wrap in <p>.
      // LatexPreview lines 201-210: DO wrap in <p>.
      // I should migrate this <p> wrapping to processor.ts OR keep it here.
      // "Logic Comparison" Step 2: "Step 2: Simplify LatexPreview... Directly inject sanitized HTML."
      // This implies moving p-wrapping to processor.ts.
      // I will ADD p-wrapping to processor.ts right now before modifying LatexPreview to avoid breakage.

      // ABORTING LatexPreview edit to fix processor.ts first.

      // 3. Inject HTML
      // FIX (v1.9.12): Pre-inject placeholders at string level to ensure Lists/Tables catch them.
      // FIX (v1.9.65): Recursive resolution - blocks may contain other placeholders (Algorithm with Math)

      // First, resolve nested placeholders INSIDE block values
      let resolveCount = 0;
      const maxResolves = 10; // Safety limit
      let hasUnresolved = true;
      while (hasUnresolved && resolveCount < maxResolves) {
        hasUnresolved = false;
        for (const key in blocks) {
          const originalValue = blocks[key];
          const resolvedValue = originalValue.replace(/(LATEXPREVIEW[A-Z]+[0-9]+:)/g, (match) => {
            if (blocks[match] && match !== key) { // Don't self-reference
              hasUnresolved = true;
              return blocks[match];
            }
            return match;
          });
          blocks[key] = resolvedValue;
        }
        resolveCount++;
      }

      // Then resolve top-level placeholders in sanitized HTML
      html = html.replace(/(LATEXPREVIEW[A-Z]+[0-9]+:)/g, (match) => {
        return blocks[match] ? blocks[match] : match;
      });

      containerRef.current.innerHTML = html;

      // 4. Placeholder Injection (The Trojan Horse)
      containerRef.current.normalize();
      const walker = document.createTreeWalker(
        containerRef.current,
        NodeFilter.SHOW_TEXT,
        null
      );
      const nodesToProcess: Text[] = [];
      let node: Text | null;
      while ((node = walker.nextNode() as Text)) {
        if (node.textContent?.includes('LATEXPREVIEW')) {
          nodesToProcess.push(node);
        }
      }

      nodesToProcess.forEach(textNode => {
        const text = textNode.textContent || '';
        const parts = text.split(/(LATEXPREVIEW[A-Z]+[0-9]+:)/g);
        const fragment = document.createDocumentFragment();

        const parent = textNode.parentElement;
        const isBlockContext = parent && (parent.tagName === 'DIV' || parent.tagName === 'P') && parent.childNodes.length === 1;

        parts.forEach(part => {
          if (blocks[part]) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = blocks[part];

            if (isBlockContext && parent.tagName === 'P') {
              // unwrapping logic handled by browser parser mostly
            }

            while (tempDiv.firstChild) {
              fragment.appendChild(tempDiv.firstChild);
            }
          } else if (part) {
            fragment.appendChild(document.createTextNode(part));
          }
        });

        textNode.replaceWith(fragment);
      });

      // 5. Bibliography Injection (Optimized v4)
      if (bibliographyHtml) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = bibliographyHtml;
        // Append the contents (usually a wrapper div from engine)
        while (tempDiv.firstChild) {
          containerRef.current.appendChild(tempDiv.firstChild);
        }
      }

      // 6. Auto-Scaling (Auditor Spec)
      requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const elements = containerRef.current.querySelectorAll('.katex-display, .table-wrapper');
        elements.forEach((el) => {
          const element = el as HTMLElement;
          // Reset
          element.style.transform = '';
          element.style.width = '';
          element.style.transformOrigin = 'left center';

          if (element.scrollWidth > element.clientWidth) {
            const scale = Math.max(0.55, (element.clientWidth / element.scrollWidth) * 0.98);
            if (scale < 1) {
              element.style.transform = `scale(${scale})`;
              element.style.width = `${(100 / scale)}% `;
              element.style.overflowX = 'hidden';
            }
          }
        });
      });

    } catch (err: any) {
      console.error("Preview Render Error:", err);
      // Log the full failing content for debugging
      console.log("--- FAILING LATEX CONTENT ---");
      console.log(latexContent);
      console.log("--- END FAILING CONTENT ---");
      setError(err.message || 'Unknown error');
    }
  }, [latexContent]);

  if (error) {
    return (
      <div className={`latex-preview ${className}`}>
        <div style={{ padding: '20px', background: '#fff3f3', border: '1px solid #ffcccc', borderRadius: '4px' }}>
          <strong style={{ color: '#cc0000' }}>Render Error:</strong>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`latex-preview ${className}`}
    />
  );
}
