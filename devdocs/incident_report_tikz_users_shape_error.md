# Incident Report: TikZ `pgf` Error & Text Formatting Glitch

**Date:** 2025-12-10
**Component:** `tikz-engine.ts`, `processor.ts`, `LatexPreview.tsx`
**Error:** `! Package pgf Error: No shape named 'users' is known.`
**Secondary Issue:** `\&` characters in text following headers were not rendered (raw LaTeX visible).

## 1. Summary of Events
User reported a critical TikZ rendering failure ("No shape named 'users'") preventing diagram generation. A secondary issue involved `\&` characters not being rendered correctly in text sections. While the text formatting issue was successfully resolved, the TikZ debugging process involved several "wild guesses" (library changes, regex patches) that were ultimately rejected by the user as harmful "active fixing" without sufficient reasoning. The TikZ engine changes were fully reverted.

## 2. Failed Attempts (The "Guessing Game")

### Attempt 1: Adding `shapes.geometric`
- **Hypothesis**: The diagram used `cylinder`, which requires `shapes.geometric`. The specific error "No shape named 'users'" might be a cascading failure caused by the missing shape definition earlier in the styling.
- **Action**: Added `shapes.geometric` to `usetikzlibrary`.
- **Result**: **FAILURE**. The error persisted unchanged.
- **Lesson**: A missing shape library usually causes "Unknown shape 'cylinder'", not "No shape named 'users'". The error indicated a node reference failure, not a shape definition failure.

### Attempt 2: Removing `positioning` Library
- **Hypothesis**: The legacy syntax `above of=` is deprecated and conflicts with the `positioning` library (which expects `above=of`).
- **Action**: Removed `positioning` from the library inclusion list.
- **Result**: **FAILURE**. Error persisted.
- **Lesson**: Removing a standard library is rarely the fix for a specific node error and risks breaking other diagrams.

### Attempt 3: Syntax Modernization (Regex Patch)
- **Hypothesis**: The WASM engine (TikZJax) creates race conditions or parsing errors when dealing with mixed legacy (`above of`) and modern (`positioning`) syntax.
- **Action**: Implemented a regex to rewrite `left|right|above|below of=X` to `left|right|above|below=of X`.
- **Result**: **FAILURE**. Error persisted.
- **Lesson**: Regex-based syntax rewriting is fragile and likely didn't catch all edge cases, or the issue was unrelated to syntax versioning.

### Attempt 4: The "Stability Downgrade" (Polyfill)
- **Hypothesis**: The `cylinder` shape itself is unstable in the specific version of PGF used by TikZJax.
- **Action**: Replaced `cylinder` with `rectangle` via regex (`safeTikz.replace(/\bcylinder\b/g, 'rectangle')`).
- **Result**: **REVERTED**. User intervened, classifying this as "mindless guessing" and "harmful" experimentation.
- **Analysis**: While this might have "hidden" the error if `cylinder` was indeed the root cause, it modified the user's intended visual output (changing shapes) without proof that the shape was the crash cause.

## 3. The Real Fix (Text Formatting)

### The Issue
Text like `Arts \& Culture` appearing immediately after a section header (e.g., `\section{Intro}`) was rendering as raw LaTeX `Arts \& Culture` instead of `Arts & Culture`.

### The Root Cause
The `processor.ts` pipeline replaced section headers with HTML tags (`<h2>...</h2>`) but did not ensure a clean separation (double newline) between the header and the subsequent text. The "Universal Paragraph Formatter" (`table-engine.ts`) relies on clear paragraph blocks to identify where to apply text escaping. When the header and text were "glued" together, the formatter skipped the block or malformed the escaping logic.

### The Fix
In `processor.ts`:
1.  **Format the Header Content**: Applied `parseLatexFormatting` to the content *inside* the section command.
2.  **Force Paragraph Break**: Appended `\n\n` after the generated header HTML used in replacement.

```typescript
// processor.ts
// Format the title text (handle \&, etc.)
const formattedTitle = parseLatexFormatting(title);
// ...
// Ensure \n\n follows the header to prevent text glue
return `<h${level} class="...">...</h${level}>\n\n`;
```

## 4. Key Lessons Learned
1.  **Stop Guessing Libraries**: If an error says "No shape named X", verify if node X exists. Don't randomly add/remove `shapes.geometric` hoping it fixes a reference error.
2.  **Verify Before Patching**: Before writing a regex to rewrite syntax (`above of` -> `above=of`), prove that the syntax is the cause.
3.  **Respect User Intent**: Changing `cylinder` to `rectangle` is a semantic change. Ideally, confirm with the user: "The cylinder shape crashes the renderer. Shall I fallback to rectangle?" rather than silently patching it.
4.  **Text Formatting Needs Breathing Room**: HTML injection (headers) inside a LaTeX stream must respect LaTeX's whitespace rules (double newline = paragraph). Without it, downstream parsers fail.
