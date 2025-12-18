# Custom LaTeX Preview Architecture ("The Independent Option")

The browser-based preview system uses a **Fully Custom TypeScript Orchestrator** (`processor.ts`) to render academic documents. We have **abandoned `latex.js` entirely** in favor of a robust, fault-tolerant "SaaS" (Software as a Service) parser chassis that integrates our battle-tested custom rendering engines.

## The Pivot: Why We Removed `latex.js`

We previously used a "Hybrid" architecture where we tried to sanitize input for `latex.js`. It failed because:

1.  **Fragility**: A single unknown macro caused a whitespace-of-death crash.
2.  **Black Box**: We couldn't control how it handled lists or tables (hence the "1Text" bugs).
3.  **Containment Costs**: We spent 90% of our time writing code to *prevent* `latex.js` from seeing code.

## 36. The "Plain Text" URL Protocol (v1.9.50)

**The Decision**: We intentionally disabled clickable links in the bibliography to preserve the "printed paper" aesthetic and prevent "link rot" anxiety during the draft phase.

-   **Mechanism**:
    -   The `latexGenerator.ts` injects a specific sequence: `\\ \url{http://...}`.
    -   The `processor.ts` `parseLatexFormatting` function contains a specific regex: `/\url\{([^{}]*)\}/g`.
    -   **Replacement**: It does NOT create an `<a href="...">`. It creates a `<code>$1</code>`.
-   **Visual Result**: URLs appear on a **new line** (forced by `\\`) in **monospace font**, strictly as reference data, not navigation tools.
-   **Why**:
    -   **Aesthetic**: Keeps the bibliography uniform.
    -   **Safety**: Prevents users from clicking away from the app.
    -   **Philosophy**: An academic paper is a static document, not a webpage.

**The Solution:** We built our own "Dumb but Robust" parser.

### The Great Refactor (Visualized)

The transformation of `LatexPreview.tsx` represents the shift from "Monolithic Smart Component" to "Dumb View Layer".

| Metric | Old Architecture (v1.5) | New Architecture (v1.9) |
| :--- | :--- | :--- |
| **Logic Location** | Internal (React Hooks) | External (Pure TypeScript Library) |
| **File Structure** | Monolith (~3000 lines) | Modular `client/src/lib/latex-unifier/` |
| **Entry Point** | `LatexPreview.tsx` | `processor.ts` -> `processLatex()` |
| **Dependencies** | `dompurify` | `katex` (CSS only), `iframe` |
| **Stability** | Fragile (Exceptions Crash UI) | Robust (Try/Catch in Pipeline) |

**The New Role of `LatexPreview.tsx`**:
1.  **Receive String**: Accepts `latexContent`.
2.  **Call Pipeline**: Invokes `processLatex(content)` (Synchronous).
3.  **Inject HTML**: Sets `dangerouslySetInnerHTML`.
4.  **Rehydrate**: Walks DOM to inject interactive placeholders (if any).
5.  **Inject Styles**: Appends scoped CSS.
*That is it. It contains NO rendering logic.*

### 3. Rendering Engine (The "Zero-Library" Core)
**Status: PURE HTML + ISOLATED TIKZ**

The system has been purged of the monolithic `latex.js` library. The `processor.ts` orchestrator delegates to specialized engines:

- **`healer.ts`**: Pre-processing (Markdown stripping, Ghost header exorcism).
- **`tikz-engine.ts`**: Extracts and isolates TikZ diagrams into `<iframe>` placeholders.
- **`math-engine.ts`**: Extracts/Renders Math via KaTeX (preserving structure).
- **`citation-engine.ts`**: Parses `(ref_X)` and generates IEEE-style bibliographies.
- **`table-engine.ts`**: Manually parses complex tables (rows, cells, multicolumn) without regex.
- **`processor.ts`**: Handles final text formatting, lists, algorithms, and assembly.

- **Document Body**: Parsed entirely by this regex/heuristic pipeline into pure HTML/CSS.
- **Math**: Rendered by **KaTeX** (fast, semantic).
- **TikZ Diagrams**: Rendered by **TikZJax** (WebAssembly `jsTeX`) running in **Isolated Iframes**.
    - *Note*: TikZJax is the ONLY remaining "LaTeX" engine, used exclusively for diagrams.
    - *Constraint*: It requires external font assets (`fonts.css`).

### 4. The "China-Friendly" Font Strategy (v1.6.42)
To ensure accessibility in regions with restricted internet (e.g., China) and to fix "Missing character" / "nullfont" errors:
- **CDN**: We bypassed `tikzjax.com` (often blocked/slow).
- **Source**: We use **jsDelivr** (`cdn.jsdelivr.net`), which has robust global routing.
- **Package**: We use `node-tikzjax` (instead of `tikzjax`), as it correctly exposes the `bakoma/ttf` font structure required by the CSS.
    - URL: `https://cdn.jsdelivr.net/npm/node-tikzjax@latest/css/fonts.css`

### 5. The "Silence Protocol" (v1.6.42)
Since TikZJax is a full TeX engine, it emits verbose logs (`This is jsTeX...`, `Missing character...`).
- We inject a **Console Interceptor** into the TikZ iframe.
- It filters out all `jsTeX`-related noise to keep the developer console clean.
- A single "Silencing Active" notice is logged on startup for transparency.

**Math extraction sub-order (CRITICAL):**

Within the Math extraction phase, we must extract in this specific order:

180. **Structured environments** (`align*`, `equation*`, `gather*`, `multline*`) - FIRST
81. **Standalone display math** (`\[...\]`) - SECOND
82. **Standard Inline math** (`\(...\)`) - THIRD (v1.6.2 addition)
83. **Legacy Display math** (`$$...$$`) - FOURTH
84. **Legacy Inline math** (`$...$`) - FIFTH

**Rationale**: If `\[...\]` is extracted before `align*`, and an `align*` environment contains a `\\[4pt]` row spacing (which looks like display math to a naive regex), the inner block gets extracted first, leaving placeholders inside the align* content. When KaTeX tries to render the align* environment, it sees "LATEXPREVIEWMATH0" as LaTeX code and fails. By extracting structured environments first, we preserve their integrity.

### 2. Math Rendering (KaTeX)

`We use **KaTeX**, which is the gold standard for web-based math.

- **Extraction**: Regex finds structured environments (`\begin{equation*}`, `\begin{align*}`, `\begin{gather*}`, `\begin{multline*}`), then standalone display math (`\[...\]`), then standard inline (`\(...\)`), then legacy inline (`$...$`).
- **CRITICAL (v1.5.4)**: We pass the **COMPLETE** environment match (including `\begin{align*}...\end{align*}` tags) to KaTeX, NOT just the body content. KaTeX needs the environment tags to properly parse alignment characters (`&`) and line breaks (`\\`).
- **Placeholder**: Replaced with `LATEXPREVIEWMATH{N}`.
- **Rendering**: The math string is rendered to HTML string using `katex.renderToString()` with `throwOnError: false` for graceful degradation.
- **Injection**: After `Fully Custom TypeScript Parser` finishes, we walk the DOM, find the placeholder text, and replace its parent node with the KaTeX HTML.

#### Math Sizing Strategy (The Physics-Based Heuristic v2)
Current Version: v1.9.36

We rely on **Physical Constraints** rather than arbitrary guesses to scale math. This ensures readability on A4 paper while preventing layout breakage.

**Layer 1: Pre-Render Heuristic (The "Intelligent Array" System)**

Applied during `createMathBlock()` before KaTeX renders.

1.  **Target Selection**:
    *   **Single-Line Equations**: Scaled if they exceed physical width.
    *   **Arrays/Matrices**: Scaled aggressively because they grow horizontally.
    *   **EXEMPT**: Multi-line environments (`align`, `gather`, `multline`) are **never scaled** because they grow *vertically*. Scaling them would shrink legible text unnecessarily.

2.  **The Array Heuristic (v1.9.36)**:
    *   Arrays often have short rows and one long row. A simple character count overestimates width.
    *   **Formula**: `EstimatedWidth = (TotalChars / Rows) * 0.5`.
    *   **Logic**: This realistic multiplier (0.5) approximates average text density, ensuring we don't over-shrink tables containing standard text.

3.  **Physical Bounds**:
    *   **Threshold**: **39em**. This matches the printable width of an A4 page (210mm - 25mm margins) at 11pt font.
    *   **Safety Floor**: Scale is clamped at **0.65x**. We never shrink content below this readable threshold.

4.  **Layout Mechanics (The "No-Clip" Fix)**:
    *   **Wrapper**: `width: max-content`. Prevents the browser from chopping off the right edge before scaling.
    *   **Overflow**: `overflow: visible`. We trust the scaler to fit the content; hidden overflow caused data loss.
    *   **Centering**: `margin: 0 auto`. The scaled block automatically centers itself in the available space.

**Layer 2: CSS Margin Collapsing (The "Vertical Rhythm" Fix)**

To prevents excessive whitespace (double gaps) around math blocks:
*   **Strategy**: The auto-scale wrapper uses `display: block` (instead of `inline-block`).
*   **Effect**: This allows the paragraph's `margin-bottom` (1em) to **collapse** (merge) with the equation's `margin-top` (0.5em).
*   **Result**: A clean 1em gap instead of a 1.5em additive gap.
*   **Spacing**: Reduced `.katex-display` global margins to `0.5em` to tighten the document flow.

### 3. Diagram Rendering (TikZ via Iframe)

TikZ is a Turing-complete vector graphics language. No simple JS library can parse it safely on the main thread.

- **Extraction**: Regex finds `\begin{tikzpicture}` environments.
- **Placeholder**: Replaced with `LATEXPREVIEWMATH{N}`.
- **Rendering**: We construct a complete HTML page that loads **TikZJax** and inject it into an `<iframe>`.
### 7a. Preamble Stripping (The "Anti-Crash" Field)
**Problem**: The Custom Parser creates "ghost tags" or crashes when it sees incomplete macros in the preamble (e.g. `\usepackage[sort&compress]{natbib}` -> `&` crashes regex).
**Universal Fix**: We aggressively strip **all** preamble commands before parsing.
-   **Regex**: `\\usepackage(\[.*?\])?\{.*?\}` and `\\documentclass...`
-   **Why Universal**: It deletes the entire category of "Package Imports". Since the browser mocks all styles via CSS, we never need *any* package import. Removing them prevents 100% of package-related syntax crashes.

### 7b. Text Sanitization (The "Typography" Layer)
**Problem**: LaTeX uses math logic in text (e.g., `{,}` to prevent spacing), which renders literally in HTML (`100{,}000`).
**Universal Fix**: We implement a global replacement layer for typography.
-   **Separators**: `{,}` -> `,` and `{:} -> :`
-   **Structure**: Runs **after** Math Extraction but **before** HTML generation.
-   **Why Universal**: It targets the *syntax pattern* `{char}`, not specific numbers. It handles `100{,}000`, `200{,}000`, and `1{,}234` equally.
- **Environment Wrapping**: We explicitly wrap the extracted TikZ code in `\begin{tikzpicture} ... \end{tikzpicture}` inside the iframe script tag.
- **Responsive SVG Layout (v1.4.0)**: CSS-driven `max-width: 100%` ensures perfect fit on A4 pages without manual scaling hacks.
- **Centering**: Iframes are wrapped in flexbox containers for horizontal centering.
- **ASCII Sanitization**: We strip non-ASCII characters to prevent `btoa` errors.
- **No Typography Normalization**: We **DO NOT** convert `--` to `–` inside TikZ (breaks path syntax).
- **Isolation**: The `<iframe>` isolates the heavy processing and CSS conflicts.

#### Loading State (v1.6.11)

TikZJax rendering can take 500-2000ms (CDN loading + WASM compilation). To improve perceived responsiveness, we display a loading placeholder inside the iframe:

- **Placeholder Text**: `[ Generating diagram... ]` (ASCII-only for cross-platform compatibility)
- **Animation**: Subtle CSS `pulse` animation (opacity 0.5 → 1.0)
- **Hiding Mechanism**: The existing `MutationObserver` (used for height resizing) now also adds `.hidden` class to the placeholder when the SVG appears
- **Architecture Choice**: The placeholder is implemented **inside the iframe** (not React) to preserve the strict isolation philosophy. This avoids cross-frame communication complexity.

**CSS Implementation:**

```css
.tikz-loading {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #666;
  white-space: nowrap;
  animation: pulse 1.5s ease-in-out infinite;
}
.tikz-loading.hidden { display: none; }
```

**Body Layout**: The iframe body uses `flex-direction: column` to stack the loading placeholder above the TikZ container, ensuring proper vertical flow.

### 4. Table Rendering (Manual Parsing & Order of Operations)

**Native TabularX Support (v1.3.1)**: We natively support `tabularx` by parsing it like a standard `tabular` environment. We intentionally **ignore the width argument** and let the browser handle the layout (auto-width), which is superior for responsive HTML.


### 13. The Table Engine (v1.9.125 Strict Mode)
**Goal**: Robust parsing of complex LaTeX tables (tabular, tabularx) with strict adherence to validity.

**The Pipeline**:
1.  **Block Extraction**: Recursive brace-matching parser extracts `\begin{tabular}...` blocks.
2.  **No Guessing (Strict Mode)**:
    -   We **do NOT** implicitly split rows (`Text \hline` -> `Text \hline`).
    -   We **do NOT** sanitize trailing backslashes.
    -   **Requirement**: The input MUST be valid LaTeX (`Text \\ \hline`). If not, it renders broken.
3.  **Row Splitting**:
    -   Split on `\\` (assuming it's not inside a brace).
4.  **Border Detection (Correctness)**:
    -   **Grid**: `\hline` anywhere renders a border.
    -   **Semantic**: `\midrule`, `\bottomrule` render borders.
    -   **Partial**: `\cline{2-4}` is parsed and renders `border-bottom` on specific cells.
5.  **Rendering**: Generate cleaner HTML `<table>`.

- **Thousand Separator Fix (v1.5.16)**: `{,}` (LaTeX thousand separator, e.g., `105{,}000`) is now converted to `,` in `parseLatexFormatting()`.

### 5. Bibliography Injection

**Engine**: `thebibliography` Parser
We manually extract the bibliography environment to ensure citations are rendered correctly.

- **Extraction**: Regex finds `\begin{thebibliography}... \end{thebibliography}`.
- **Item Parsing**: Iterates through `\bibitem{key} content` entries.
- **Rendering**: Generates a clean HTML `<div class="bibliography">` with an ordered list (`<ol>`).
- **IEEE Formatting**: Citations are numbered `[1]`, `[2]`, matching the inline citation processor.

### 6b. Code Blocks (The Universal "Enclosure")
**Supported Environments**: `verbatim`, `lstlisting`

**The Universal Styling**:
We map both "dumb" (`verbatim`) and "smart" (`lstlisting`) code blocks to a single, unified visual style that matches the Algorithm blocks.

-   **Extraction**:
    -   Regex: `\\begin\{(verbatim|lstlisting)\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{\1\}`.
    -   **Universal Catch**: The `(?:\[[^\]]*\])?` pattern intentionally matches *but ignores* any options (e.g., `[language=Python, caption=My Code]`). This ensures the parser doesn't choke on valid LaTeX properties.
-   **Transformation**:
    -   **HTML Escaping**: strictly escaped (`<` -> `&lt;`) to prevent XSS.
    -   **Container**: Wrapped in `<pre class="latex-verbatim">`.
-   **CSS / Visuals**:
    -   **Background**: `#f9f9f9` (Light Grey) for distinct enclosure.
    -   **Border**: 1px solid `#ddd` (Subtle boundary).
    -   **Font**: Courier New.
    -   **Whitespace**: `white-space: pre` preserves all indentation exactly as typed.
-   **Output**: A clean, enclosed box that looks identical regardless of the input method.

### 6c. Algorithm Environment (The "Parsed" Code Zone - v1.9.15)

**Engine**: `algorithmic` Parser
Unlike `verbatim` (which is stupid/raw), `algorithmic` is smart and structural.

- **Extraction**: Regex finds `\begin{algorithmic}` blocks.
- **Parsing**:
  - We do NOT use regex for lines. We use a **Command Tokenizer** that splits by `\STATE`, `\IF`, `\FOR`, `\WHILE`, etc.
  - **Structure**: We track indentation depth (nested loops/conditionals) manually.
- **Rendering**:
  - **Keywords**: Commands like `\IF{x}` are transformed to **if** `x` **then**.
  - **Styling**: Wrapped in `<div class="latex-algorithm">` with line numbers and monospace font.
- **Safety**: We apply text formatting *before* injecting HTML tags to prevent "Double Escaping".
- **Font Sizing (v1.9.126)**: We detect and apply `\small`, `\footnotesize`, `\scriptsize`, `\tiny` commands by removing them from the body and setting the container's CSS `font-size`.

### 7. Advanced Layout & CSS

To achieve a "What You See Is What You Get" (WYSIWYG) feel, we implement several layout strategies:

- **Parbox Handling**: `\parbox{width}{content}` is parsed and converted to `<div style="width: ...">`, allowing for multi-column layouts often found in academic headers.
- **A4 Page Simulation**: The container uses fixed dimensions (`210mm` width) and padding to simulate a real paper page.
- **Vertical Rhythm**: We use targeted margin strategies on headers (`h1`-`h4`) and lists (`ul`, `ol`, `p + p`) to ensure consistent vertical spacing, mimicking standard LaTeX document classes.

### 8. Text Formatting & Symbol Normalization (Scoped)

To ensure consistent rendering in **manually parsed blocks** (Tables, Algorithms, Parboxes), we perform aggressive normalization of text and symbols *before* generating their HTML replacements. Note: The main document body relies on `Fully Custom TypeScript Parser`'s native parser.

- **Order of Operations**:
  1. **Inline Math Extraction**: `$...$` is extracted first to prevent HTML escaping from corrupting math syntax.
  2. **Unescaping**: Common LaTeX escapes (`\%`, `\#`, `\&`) are converted to their character equivalents.
  3. **HTML Escaping**: The remaining text is HTML-escaped (`<` -> `&lt;`) to prevent XSS.
  4. **Macro Replacement**: Standard macros are replaced with HTML:
     - `\textbf{...}` -> `<strong>...</strong>`
     - `\textit{...}` -> `<em>...</em>`
     - `\underline{...}` -> `<u>...</u>`
     - `\textsf{...}` -> `<span style="font-family: sans-serif;">...</span>` (v1.9.126)
     - `\textquote{...}` -> `“...”` (Smart Quotes)
     - `\text{...}` -> `...` (Unwrapped Plain Text)
  5. **Symbol Mapping**: LaTeX symbols are mapped to HTML entities:
     - `\bullet` -> `&#8226;`
     - `\times` -> `&times;`
     - `\checkmark` -> `&#10003;`
     - `\approx` -> `&#8776;` (≈)
     - `\,` -> `&thinsp;` (Thin Space)
     - `{:}` -> `:` (Strips brace protection)
     - `\/` -> `/` (Converts escaped slash to forward slash)
     - `~` -> `&nbsp;` (Non-breaking space)
     - `\textquotesingle` -> `’` (Smart Apostrophe)
     - `\textquoteleft` -> `‘` (Left Smart Quote)
     - `\textquoteright` -> `’` (Right Smart Quote)

### 8a. Section Header Processing (v1.9.69)

**Problem**: `\section{}`, `\subsection{}`, `\subsubsection{}` were NOT being processed.

**Fix**: Added handlers: `\section{}` → `<h2>`, `\subsection{}` → `<h3>`, `\subsubsection{}` → `<h4>`, `\paragraph{}` → `<strong>`.

**Fallback**: `\sub+section{}` → `<h4>` handles AI-hallucinated deep levels like `\subsubssubsection`.

### 8aa. Comprehensive Command Support (v1.9.68)

50+ commands added: Math (`\leq`, `\geq`, `\pm`, `\infty`), Logic (`\forall`, `\exists`), Greek letters (`\alpha` through `\omega`), Arrows (`\uparrow`, `\downarrow`), Spacing (`\quad`, `\qquad`).

**Special**: `\$` → `$` for financial notation.

### 8ab. Algorithm Package Dual-Support (v1.9.68)

Both `algorithmic` (uppercase: `\STATE`) and `algpseudocode` (mixed: `\State`) packages now supported via case-insensitive regexes.

### 8b. The Universal Text Formatter (v1.9.37)
Previously, only manually parsing blocks (Tables, Algorithms) received nice formatting (bold, italic, symbols). Standard text paragraphs were just getting wrapped in `<p>` tags, leaving `\textbf{}` raw.

**The Fix:** We implemented a **Universal Paragraph Map** at the end of `processor.ts`.

1.  **Paragraph Splitting (The `\par` Fix)**:
    -   First, we convert all LaTeX `\par` commands to double-newlines (`\n\n`) via `html.replace(/\\par(?![a-zA-Z])/g, '\n\n')`.
    -   This guarantees that `\par` creates a physical break that the splitter can detect.
2.  **Universal Split**: Split content by double-newline (`\n\n`) into paragraphs.
3.  **Iterate**:
    -   If it's a Header (`<h2>`) or Placeholder (`LATEXPREVIEW...`), leave it alone.
    -   Otherwise, run `parseLatexFormatting(text)` on it.
    -   Wrap in `<p>`.
**Result:** Uniform text rendering across the entire document.

### 8c. The Orphaned Backslash Fix (v1.9.142)

**Problem**: Text formatting commands like `\textbf` often arrive with triple backslashes (`\\\textbf`) due to upstream normalization steps (e.g., `\newline` conversion to `\`).
**The "Cleanup" Trap**: Standard regex parsers (`\\textbf`) consume only exactly two backslashes, leaving the third one behind as an orphan (`\<strong>`).
**The Fix**: We updated all text formatting regexes in `processor.ts` to use `\\+` (one or more backslashes).
-   **Old**: `new RegExp('\\\\textbf', 'g')` (Matches `\\textbf` only)
-   **New**: `new RegExp('\\\\+textbf', 'g')` (Matches `\textbf`, `\\textbf`, `\\\textbf`...)
-   **Safety**: This safely consumes all backslash prefixes attached to the command while respecting space-separated commands (e.g., `\\ \textbf` remains `\\` + `\textbf`).

### 8d. Algorithm Symbol Expansion (v1.9.142)
Added support for:
- `\ForAll` -> **for all**
- `\hfill` -> `float: right` spacer (for comments/alignment).

### 9. Environment Normalization

We "flatten" these into standard text formatting.


- **Strategy**: Regex replacement converts environments into bold headers.
  - `\begin{theorem} ... \end{theorem}` -> `\textbf{Theorem:} ...`
  - `\begin{proof} ... \end{proof}` -> `\textit{Proof:} ... \u220E` (QED symbol)
- **Benefit**: This allows the content to be rendered perfectly by the basic text engine without requiring complex CSS counters or package support.

### 10. Security & Isolation

Rendering user-generated LaTeX in the browser presents security risks (XSS).

- **TikZ Isolation**: TikZ code is rendered inside a sandboxed `<iframe>` using `srcdoc`. This prevents the TikZ rendering script from accessing the main application's DOM or cookies.
- **HTML Escaping**: All manual text parsing (tables, algorithms) strictly escapes HTML special characters before injection.
- **No External Resources**: The previewer is configured to block loading of external images or scripts (except the trusted TikZJax CDN).

---

## Summary of Capabilities

| Feature       | Handled By              | Strategy                                             |
| ------------- | ----------------------- | ---------------------------------------------------- |
| **Math**      | **KaTeX**               | Extraction -> Placeholder -> Injection.              |
| **Diagrams**  | **TikZJax**             | Extraction -> Iframe Isolation.                      |
| **Tables**    | **Custom Parser**       | Regex Parse -> HTML Table Generation.                |
| **Citations** | **Universal Processor** | Tokenize `(ref)` -> Merge `[1,2]` -> Inject `\cite`. |

---

### 11. The Unified List Parser (Manual Character-Walker)

To handle arbitrarily nested lists (e.g., `itemize` inside `enumerate`) and optional arguments (e.g., `\item[Label]`), we implemented a **Manual Character-Walker Parser** (`processLists`). Regex was abandoned as insufficient for this level of recursive complexity.

**Strategy (Scorched Earth Policy):**

1. **Manual Parsing**: We do **not** use regex to find list boundaries. We iterate through the string character-by-character, using a **Balanced Brace Counter** to correctly parse complex optional arguments (e.g., `\begin{enumerate}[label=\textbf{\arabic*.}]`).
2. **Leaf-First Recursion**: The parser identifies the "innermost" list (a leaf node that contains no other list start tags) and processes it first. It replaces the list with a safe placeholder (`__LIST_BLOCK_N__`) before processing parent lists. This guarantees infinite nesting support without regex stack overflow or "greedy match" errors.
3. **Pipeline Ordering**: To prevent incorrect parsing, **Verbatim/Code extraction happens BEFORE List parsing**. This ensures `\item` commands inside code blocks are ignored by the list parser.
4. **Recursion-Aware Item Extraction (v1.9.78)**: The `listContent` loop tracks `nestedListDepth` to ensure that nested `\begin...\end` blocks are captured entirely within the parent item. This prevents premature truncation of nested lists.
5. **Inline Recursion (Depth > 0)**:
   - **Top Level (Depth 0)**: List is wrapped in `createPlaceholder` to protect it from downstream regex (like Math).
   - **Nested Levels (Depth > 0)**: Lists are returned as **Raw HTML** (`<ol>...</ol>`) without placeholders. This allows the parent list to wrap the entire nested structure in its own placeholder, maintaining atomic integrity.
6. **Math Safety**: Content is passed through `resolvePlaceholders()` to restore math *before* HTML generation.
7. **Manual Formatting**: We manually parse formatting macros (`\emph`, `\textbf`, `\textsc`) within list items.
8. **Manual Parsing Risks (v1.9.79)**: Manual parsers are fragile. Hardcoded skips (e.g., `i += 15`) led to bugs where valid content was swallowed. Future implementations should use dynamic length checks (e.g., `i += tag.length`). 

---

## 12. Specific Technical Implementations ("Secrets")

This section documents the exact "magic" implementations that solve the hardest problems.

### The "Parbox" Manual Parser

### The "Parbox" Manual Parser

Regex is insufficient for nested braces in LaTeX. To handle `\parbox`, we implemented a **Manual Character-by-Character Parser** (`processParboxes`):

- **Mechanism**: It iterates through the string, tracking brace depth (`{` = +1, `}` = -1).
- **Why**: This allows us to correctly extract the width and content arguments even if the content contains other braces, commands, or environments.
- **Heuristic**: It converts LaTeX lengths like `0.5\textwidth` directly to CSS `width: 50%`.



### 14. Safety Sweep (v1.9.89)
**Purpose**: To prevent "Total Preview Breakdown" when the AI generates truncated or malformed LaTeX (e.g. missing `\end{algorithm}`).
**Mechanism**:
- A final pass regex `(\\begin\{[^}]+\}(?:(?!\\section|...|<h[1-6]|&lt;h[1-6])[\\s\\S])*?)(?=\\section|...|<h|&lt;h|\\end|$)` scans for residual environments.
- **Constraint**: It stops if it encounters a Section header (`\section`), a converted HTML header (`<h3>`), or an **escaped HTML header** (`&lt;h3&gt;`).
- It wraps the fragment in `<pre class="latex-error-block">` containers.
- **Result**: Broken blocks are contained locally; valuable subsequent content remains formatted and visible.

### Vertical Rhythm Strategy (The "Structural Owl")

... (Content omitted for brevity) ...

## 13. Uniform Sanitization Policy (v1.9.86)

**Background**: Historically, we only sanitized "Section" content because we assumed short fields like "Abstract" or "Title" were safe.

**The Breach**: The Abstract generation step (Phase 3) bypassed sanitization. When the AI model (Gemini-3-Pro) outputted chain-of-thought traces (`> Thinking...`), these artifacts leaked directly into the final document.

**The Fix**:
1.  **Universal Sanitization**: Every string outputted by the AI (Titls, Abstracts, Captions) passes through `sanitizeLatexOutput`.
4.  **Check 3**: The output string.

### 13a. The Greedy Regex Trap (v1.9.129 Refinement)

The initial implementation of universal sanitization (v1.9.86) introduced a bug where the Abstract's first word was deleted.
- **Root Cause**: We used `[\s\S]*?` to match "prefixes" like `Here is the abstract`. When the delimiter was missing, this regex greedily consumed the prefix *and* the start of the valid text.
- **Rule**: **Sanitization Regexes MUST be Anchored.** Never use `[\s\S]*` (match everything) for stripping headers. Use `^ExactPattern` line-matching instead, ensuring that only the specific garbage artifact is removed without touching the subsequent content.


We use a specific CSS selector strategy to manage vertical rhythm without complex calculations.

- **Implementation**: This is **injected directly** via a `<style>` tag in `LatexPreview.tsx` to ensure it overrides all other styles.
- **Selector**: `.latex-preview > * + *`
- **Rule**: `margin-top: 1.5em`
- **Effect**: This applies a margin *only* to elements that follow other elements. It ignores the first element and ensures consistent spacing between paragraphs, equations, and figures.
- **Complement**: We also specifically target `.latex-preview .katex-display` and `.latex-preview p > div` with `margin-top: 1.5em !important` to ensure equations and nested blocks obey the rhythm.

### The "Ghost Header" Exorcism

AI models often hallucinate a "References" section header *before* the bibliography, even if one is already generated.

- **The Fix**: A specific regex `(?:\\(?:section|subsection|...)\*?\s*\{\s*(?:References|Bibliography|Works Cited)\s*\})` aggressively hunts down and removes these redundant headers before rendering.

### The "System Stability" Fallback

If the AI fails to generate a `\begin{document}`, the system doesn't crash.

### 13. Code Block Handling & Pipeline Ordering

To support `verbatim` and `lstlisting` environments without corruption from the math parser, we enforced a strict **Processing Order**.

**Strategy:**

1. **Extraction Order (Critical)**: Code blocks are extracted **Step A.2 (Pre-Math)**.
   
   - *Why*: If Math extraction (`$...$`) runs first, it sees `$var$` inside code blocks as inline math, destroying the code logic and replacing it with a placeholder (`LATEXPREVIEWMATH39`).
   - *Fix*: By extracting code blocks first, we convert them to safe HTML placeholders that the Math regex ignores.

2. **Unified Styling**:
   
   - `verbatim` and `lstlisting` are mapped to the `.latex-verbatim` CSS class.
   - This class shares identical styling with `.algorithm-wrapper` (Background, Border, Monospace, scrolling), ensuring all code-like elements look consistent and "enclosed".

3. **HTML Escaping**: Content inside code blocks is manually escaped (`<` -> `&lt;`) to prevent browser rendering issues.
- **The Safety Net**: It detects the absence of the tag and automatically wraps the entire content in a standard `article`.

### TikZ Iframe "Silence"

The TikZJax library, when running in an iframe, often throws "message channel closed" errors due to browser extension interference.

- **The Silencer**: We inject a specific event listener into the iframe that intercepts `window.error` and `unhandledrejection`. If the error message contains "message channel closed", it is `preventDefault()`'ed and suppressed, keeping the console clean for actual debugging.

---

### 14. Stability Optimizations


This section documents the specific handling of edge cases to ensure render stability.

### The "Math Protection" Protocol (For Manual Parsers)

HTML escaping is destructive to LaTeX math (e.g., `x < y` becomes `x &lt; y`, which breaks KaTeX). When we manually parse blocks (like cell contents in a Table):

- **The Trick**: We use a **Protect-Process-Restore** cycle.
  1. **Extract**: We find all `$math$` and `\[math\]` blocks *first* using regex.
  2. **Tokenize**: We replace them with safe placeholders (`__MATH_BLOCK_0__`, `__MATH_BLOCK_1__`).
  3. **Process**: We perform all HTML escaping and text formatting on the surrounding text.
  4. **Restore**: We swap the tokens back for the original LaTeX before passing it to the renderers.

### The "Parent Node Surgery"

**The Surgeon**: During the `TreeWalker` injection phase, we check the parent of the placeholder node.

- **The Operation**: If the parent contains *only* our placeholder ID (e.g., `<p>LATEXPREVIEWBLOCK1</p>`), we do not just replace the text. We **replace the entire parent node** with our new content. This ensures clean, valid HTML structure.

### The "CJK Stripper" (Dual Strategy)

- **The Override**: We use regex to strip the *environment tags* (`\begin{CJK...}`, `\end{CJK}`) but **leave the content intact**.
- **The Result**:
  - **Preview**: The browser's native font fallback mechanism handles the Chinese/Japanese characters perfectly.
  - **LaTeX Source**: The tags remain (on the server), ensuring compatibility with standard LaTeX compilers.

### The "Hyphenation Killer"

- **The Configuration**: We explicitly instantiate the generator with `{ hyphenate: false }`. This forces the browser to handle text wrapping, which is generally superior and more predictable.

---

# Part II: The Visual Rendering Engine

This section documents the **CSS Architecture** and **Layout Engine** that powers the visual preview.

## 7. The Rendering Pipeline (Architecture v5)

**The Old World**: We used `latex.js`. It was fragile, crashed on macros, and couldn't handle complex documents.
**The New World**: We use a **Custom Regex Parser** (Hybrid Architecture).

### Core Philosophy
1.  **Sanitization First**: We strip everything the browser doesn't understand (Preamble, Comments).
2.  **Encapsulation**: We hide complex Math and TikZ in safe placeholders.
3.  **Direct HTML Injection**: We use standard DOM operations (`innerHTML`) to inject the processed content.
4.  **No external runtime**: The "Engine" is just `LatexPreview.tsx` + `processor.ts`.

### Why this works
-   **Zero Crashes**: Regex replacements cannot "crash" the way a compiled parser does.
-   **Full Control**: If a specific environment (like `algorithm`) breaks, we just add a specific handler for it.
-   **Speed**: No heavy library to load. Instant render. It turns a `<div>` into a "Paper".

- **The Container**: `.latex-preview`
  - **Dimensions**: Hardcoded to `width: 210mm` (A4 ISO standard) and `min-height: 297mm`.
  - **Illusion**: Applies `box-shadow: 0 0 15px rgba(0, 0, 0, 0.1)` to make it "pop" from the background.
  - **Margins**: `padding: 25mm` duplicates standard LaTeX article margins.
  - **Background**: Forces `background-color: white !important` to override any dark mode app themes.
  - **Injected Overrides**: `LatexPreview.tsx` injects a `<style>` block that adds `line-height: 1.8 !important` (increased from 1.6) and handles the "Lobotomized Owl" spacing.
- **Typography**:
  - **Font Stack**: `'Lora', 'Times New Roman', serif`. This mimics the serif look of academic papers (`Computer Modern` substitute).
  - **Source**: Fonts are imported via Google Fonts: `https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&display=swap`.
  - **Overrides**: Uses `!important` extensively to ensure Tailwind's reset styles (`index.css`) do not bleed into the preview.

### 2. `latex-base.css` (The Layout Engine)

This is the **Internal Mechanic**. It emulates the TeX box model using CSS Grid and Flexbox.

- **The Grid System**: The `.page` class defines a grid with named lines:
  
  ```css
  grid-template-columns: [margin-left] var(--marginleftwidth) [body] var(--textwidth) [margin-right] var(--marginrightwidth);
  ```
  
  This allows elements to be placed in the "margin par" or "body" accurately.

- **TeX Variables**: It defines CSS variables that map 1:1 to LaTeX lengths:
  
  - `--parindent`: `0` (Disabled globally for modern readability)
  - `--leftmargini`: `2.5em`

  - `--fboxsep`: `3pt`

- **List Logic**: It handles the deep nesting logic of LaTeX lists (`itemize` within `enumerate`) by calculating margins dynamically:
  
  ```css
  .list .list { --leftmargin: var(--leftmarginii); }
  ```

### 3. `latex-katex.css` (The Math)

A standard, unmodified KaTeX stylesheet. It ensures that math fonts (`KaTeX_Main`, `KaTeX_Math`) are loaded and positioned with pixel-perfect accuracy.

## 16. Integration with Tailwind (The Separation)

The application uses Tailwind CSS (`index.css`) for the UI shell (Sidebar, Buttons), but the Preview is **Style-Isolated**.

- **Strategy**: The preview container `.latex-preview` acts as a "CSS Reset Boundary".
- **Conflict Resolution**:
  - `latex-article.css` uses higher specificity and `!important` to win against Tailwind.
  - The `font-serif` variable in `index.css` is set to `"Merriweather"`, but `.latex-preview` forces `"Lora"`.

## 17. Special Visual Secrets

### The "Parbox" Heuristic

`\parbox{0.5\textwidth}{...}` is not natively understood by browsers.

- **The Solution**: Our TS parser extracts the width argument.
- **The Conversion**: It converts `\textwidth` to `100%`, `\columnwidth` to `100%`, and calculates fractions (e.g., `0.3\textwidth` -> `width: 30%`).
- **The Render**: It outputs a `<div class="parbox" style="width: 30%">`.

### The "A4" Responsiveness

While the preview tries to be 210mm wide, it must fit on smaller screens.

- **The Fix**: `max-width: 100%` in `latex-article.css` ensures that if the viewport is narrower than A4, the paper shrinks to fit, while `box-sizing: border-box` ensures padding doesn't break the layout.

### The "Phantom" Elements

To handle LaTeX alignment hacks (like `\phantom{abc}` which takes up space but is invisible), `latex-base.css` defines:

```css
.phantom { visibility: hidden; }
```

This is crucial for aligning equations and table columns precisely as the author intended.

---

## 18. Honest Hacks & Known Limitations

In the spirit of "Software Reality," we document our localized solutions here. We do not pretend these are "parsers"; they are specific compatibility bridges.

### 1. Parbox "Parser" is Relative-Only

The `parbox` width calculator is **blind to absolute units**.

- **Reality**: It strictly looks for `\textwidth`, `\linewidth`, or `\columnwidth`.
- **Limitation**: If a user writes `\parbox{5cm}{...}`, the regex fails to match, and it defaults to `width: 100%`. We do not attempt to convert `cm`, `mm`, or `pt` to pixels.

### 2. Manual Formatting is "Flat"

The `parseLatexFormatting` function used for Tables and Parboxes uses **non-recursive regex**.

- **Reality**: It matches `\textbf{...}` using `[^{}]+`.
- **Limitation**: It **cannot handle nested formatting** (except for Table Rows, which now use `smartSplitRows` to respect brace nesting).
  - `\textbf{Bold}` -> **Bold** (Works)
  - `\textbf{Bold \textit{Italic}}` -> Fails (breaks on the inner brace). The user sees the raw LaTeX commands.

### 6. Plot Safety Protocol (v1.9.82)

Mathematical plots are uniquely fragile.
- **The Problem**: A function like `y=1/x` has asymptotes that shoot to infinity. The TikZ engine's layout algorithms (Fill Width, Adaptive Y) would stretch these invisible lines to fill the screen, creating massive whitespace.
- **The Protocol**:
  1.  **Detection**: If `\plot` is found.
  2.  **Square Scaling**: We enforce `x=1, y=1` to prevent geometric distortion (ellipses).
  3.  **Local Clipping**: We calculate the bounding box of the axes and wrap the `plot` command in a `\begin{scope}` with a precision `\clip`. This trims the asymptote without cutting off labels.
  
### 7. Silent Markdown Stripping


Users often paste AI output that includes markdown code fences.

- **The Fix**: We use a brute-force regex replacement at the very start of the pipeline.
- **The Sanatizer**: `content.replace(/^```latex\s*/i, '')`. We silently modify the user's input before processing, assuming any leading backticks are garbage.

---

## 19. Minor Normalizations & Optimizations

These details ensure a polished user experience by handling edge cases.

### Unicode & Typography

We pre-process specific unicode characters, **BUT WE DO NOT APPLY GLOBAL TYPOGRAPHY NORMALIZATION**.

- **Why**: Applying global replacement of `--` to `–` (en-dash) **CORRUPTS TIKZ CODE**. TikZ uses `--` to define paths.
- **The Rule**: Dashes are left as-is. Smart quotes are allowed but not forced.
- **Circled Text**: `\textcircled{x}` is simplified to `(x)`.

---

## 20. Final Architectures (v1.5.2 Refinements)

### Math Auto-Scaling (Summary - see Section 2 for full details)

We use a **two-layer scaling system** (see "Math Sizing Strategy" in Section 2):

1. **Pre-Render (Layer 1)**: Heuristic-based scaling for long single-line equations. Multi-line environments (`align*`, `gather*`) are **exempt** because they grow vertically, not horizontally.

2. **Post-Render (Layer 2)**: DOM-based `scrollWidth > clientWidth` check catches any overflows that escape Layer 1.
- **Min Scale**: 0.55x floor to prevent microscopic text
- **Method**: `transform: scale()` + `width: (100/scale)%` (not `zoom`, which causes reflow bugs)
- **UX**: No hover effects. No magnifying glass. Just correct sizing.



### Command Stripping (The "No-Op" List)

Certain commands are actively removed to prevent errors or clutter:

- **File System Access**: `\input{...}` and `\include{...}` are removed because the browser cannot access the server's file system.
- **Metadata Lists**: `\tableofcontents`, `\listoffigures`, `\listoftables` are removed as we cannot generate them dynamically without a second pass.
- **Figure Wrappers**: `\begin{figure}` environments are **Non-Destructively Flattened** (v1.9.99). We convert them to `<div class="latex-figure-wrapper">` and preserve inner `\caption{...}` as `<div class="caption">`. This ensures floating content (like TikZ) retains its context and label.
- **Captions/Labels**: `\caption`, `\label`, and `\ref` are currently stripped or replaced with `[?]` placeholders to prevent undefined reference errors.

### Fatal Error Handling

If the renderer encounters a catastrophic failure:

- **The Guard**: A `try-catch` block wraps the entire render process.
- **The UI**: An `Alert` component (shadcn/ui) is rendered in place of the document.

---

## 21. The Dynamic TikZ Engine (Intent-Based Phase 7)

We adhere to the strict "Phase 7" logic documented in `TIKZ_HANDLING.md`. This strategy respects the AI's *intent* (expressed via `node distance`) while ensuring fit and readability.

### 1. The Classifier (The Intent)

We parse the original `node distance` (defaulting to 2.0cm if missing, or 1.8cm if node count > 8).

- **WIDE** (v1.5.6): Horizontal span > 14cm. **Takes priority.**
- **FLAT** (v1.5.7): Aspect ratio > 3:1 (timeline-style). **Second priority.**
- **COMPACT** (Pipeline): `dist < 2.0cm`.
- **LARGE** (Cycle): `dist >= 2.5cm`.
- **MEDIUM**: Everything else.

### 2. The Execution Rules

| Intent      | Goal              | Action                                                               |
| ----------- | ----------------- | -------------------------------------------------------------------- |
| Intent      | Goal              | Action                                                               |
| ----------- | ----------------- | -------------------------------------------------------------------- |
| **WIDE**    | **Fit to A4**     | Dynamic `scale=(14/span × 0.9)`, `transform shape`                   |
| **FLAT**    | **Balance Ratio** | Multiplier: `y × (ratio/2)`, `x × 1.5`, strip old x/y                |
| **COMPACT** | **Fit to A4**     | `scale=0.75` (if dense), `transform shape`, `node distance=1.5cm`    |
| **LARGE**   | **Readability**   | **Continuous Scale**: `target=12/span` (12cm width). Clamped [1.3, 2.5] |
| **MEDIUM**  | Balance           | **Smart Scale**: `1.0` (Fits A4) or `0.8/0.9` + Dist (2.5cm)         |

- `node distance` (in cm) controls `below of=`, `right of=` positioning → independent of coordinate scaling
- Title offsets like `+(0,2)` use TikZ's y-unit (default 1cm) → affected by y-scale

**The Fix:** Inject `y=0.5cm` for LARGE relative diagrams:

- Title at `+(0,2)` = `2 × 0.5cm = 1cm` instead of 2cm
- `node distance=8.4cm` remains unaffected (specified in absolute cm)

### 4. The "Absolute Positioning" Override (v1.5.6)

Diagrams using `\node at (x,y)` syntax bypass `node distance` entirely. If the horizontal span exceeds A4 safe width (14cm), CSS responsive shrinking causes node overlap.

- **The Fix**: Extract ALL `(x,y)` coordinates (not just `at` patterns), calculate span, apply dynamic scale.
- **Formula**: `scale = min(1.0, 14/span) × 0.9` with floor at 0.5.
- **Requirement**: `transform shape` is mandatory for proportional shrinking.

### 5. The "Aspect Ratio" Override (v1.5.7)

Timeline diagrams often have extreme aspect ratios (e.g., 10cm wide × 2.5cm tall = 4:1). This makes them look "squashed".

- **Root Cause**: Initial coordinate extraction only matched `at (x,y)` patterns, missing `\draw (x,y)` paths that define vertical extent.
- **The Fix**: Extract ALL `(x,y)` pairs from the TikZ body to calculate true vertical span.
- **Formula**: `yMultiplier = min(3.0, max(1.5, aspectRatio / 2.0))`, `xMultiplier = 1.5`
- **Override**: Existing `x=`/`y=` values are stripped and replaced (cannot skip, must fix ratio).

This ensures that "Cycle" diagrams (Large intent) get the massive spacing they need to avoid overlap, while "Pipelines" (Compact intent) are shrunk proportionally.

## 22. Mathematical Precision & KaTeX Handling (v1.5.8)

We use **KaTeX** for rendering mathematics, prioritizing speed and "just works" display over 100% LaTeX feature parity.

### 1. The Auto-Scaling Heuristic (The "Tiny Equation" Fix)

Equations that are wider than the page (A4 width) must be scaled down to prevent overflow. However, naive character counting leads to "Tiny Equations" where short rendered math gets shrunk because the source code is verbose.

- **The Problem**: `\mathrm{Integration}` is ~20 characters in code but only ~11 characters wide visually.
- **The Solution**: We apply a **Strip-First Heuristic** before calculating length.
  - Removes `\mathrm{...}`, `\text{...}`, `\textbf{...}`.
  - Removes sizing commands `\left`, `\right`, `\big`.
  - *Result*: `estimatedWidthEm` is based on "visual density", not "code verbosity".

### 2. Structured Environment Protection

We **NEVER** auto-scale structured environments (`\begin{equation}`, `align`, `gather`, `multline`) based on character count.

- **Reason**: The wrapper tags (`\begin{equation}...`) inflate the character count by ~50 chars, causing the heuristic to incorrectly flag short equations as "too long".
- **Reason 2**: Multiline environments (`align`) grow *vertically*, so horizontal character count is a poor proxy for width.

### 3. The "No Scrollbar" Policy

A4 papers do not have scrollbars.

## 23. The Universal Citation Processor (v1.5.13 System Refactor)

We replaced the fragile regex-based citation patcher with a **Robust Tokenizer** in `server/latexGenerator.ts`. This ensures that *all* AI-generated citations are correctly formatted, regardless of spacing, newlines, or separators.

### The Problem

The AI outputs unpredictable formats:

1. `(ref_1)` (Standard)
2. `( ref_2 )` (Leading/Trailing spaces)
3. `(ref_3, ref_4)` (Grouped with comma)
4. `(ref_5; ref_6)` (Grouped with semicolon)
5. `(ref_7 ref_8)` (Grouped with spaces)

Legacy regexes failed to handle all these variations simultaneously.

### The Solution: Two-Pass Architecture

#### Pass 1: The Robust Tokenizer (Anti-Fragile)

Logic: "Find ANY parenthesized block starting with `ref_`, then **Parse** it (don't regex it)."

- **Step A (Capture)**: `/\(\s*(ref_[\s\S]*?)\)/g`. Captures the *block*, ignoring internal structure.
- **Step B (Tokenize)**: `content.split(/[,\s;]+/)`. Splits by commas, spaces, or semicolons.
- **Step C (Filter)**: Validates tokens against the reference catalog.
- **Result**: Handles *any* combination of separators transparently.

#### Pass 2: The Recursive Merger (Best Practice Enforcement)

Logic: "Recursively merge adjacent `\cite{}` commands into a single group."

- **Input**: `\cite{ref_1} \cite{ref_2}`
- **Output**: `\cite{ref_1,ref_2}`
- **Benefit**: This guarantees compliance with standard academic formatting (e.g., `[1, 2]`) even if the AI output separate blocks. This is a **structural enforcement** of style, not just a fix.

## 24. Render Stability: The Move to Synchronous Execution (v1.6.0)

For a long time, the preview renderer used `setTimeout(..., 50)` hacks to "wait for the DOM". This introduced race conditions where the scaling logic would run before the elements existed (rendering correct but unscaled) or after the user navigated away (React errors).

### The Fix: Synchronous Logic

We removed all artificial delays.

1. **Render Phase**: `Fully Custom TypeScript Parser` generator runs synchronously. HTML strings are generated instantly.
2. **Injection Phase**: `TreeWalker` substitution happens in the same tick.
3. **Measurement Phase**: Scaling logic is wrapped in `requestAnimationFrame`. This is the *browser-native* way to say "Run this code immediately after the next paint, when layout metrics are valid."

**Rule**: **NEVER use `setTimeout` for layout logic.** Always use `requestAnimationFrame` or `useLayoutEffect`.

## 25. Client-Side Citation Rendering (v1.5.15)

The server-side citation processor (`latexGenerator.ts`) outputs `\cite{ref_1,ref_2}` syntax. The client-side renderer (`LatexPreview.tsx`) must convert this to IEEE-style brackets.

### The Problem (v1.5.14)

The client renderer was producing `[1][2]` instead of `[1, 2]`.

### Root Cause

The citation handler was joining individual bracket labels with an empty string instead of grouping them into a single bracket.

### The Fix

Rewrote the `\cite{}` handler to:

1. Parse the comma-separated keys: `\cite{ref_1,ref_2}` → `['ref_1', 'ref_2']`
2. Look up each key in the `citationMap` to get the numeric ID.
3. Collect all valid IDs into a single array.
4. Join them with `,` and wrap in a single bracket pair: `[1, 2]`.

**Result**: `\cite{ref_1,ref_2}` now correctly renders as `[1, 2]` (IEEE/Nature style).

## 27. Enhancement Safety Protocol (v1.6.15)

- **Density:** For dense diagrams (Span ~14cm), `optimalUnit` was 1.0, causing text overlap.

## 28. The TikZ Scaling Saga (v1.6.35 - v1.6.40)

This section documents the rapid iteration cycle that resolved the persistent TikZ diagram rendering issues. The core problem was achieving "Goldilocks" spacing: diagrams with dense text (Cycles) needed expansion, while diagrams with minimal text (Pipelines) needed compact packing. Applying one rule universally always broke the other.

### v1.6.35 (Strict Node Distance) - PARTIAL

**Problem**: System was overriding explicit `node distance=0.8cm` with `8.4cm` (10x explosion). **Fix**: Implemented "Strict Respect" - only override if distance < 0.5cm. **Regression**: Caused Text-Heavy diagrams (Cycles) to squash due to respecting their small (but insufficient) node distances.

### v1.6.36 (Text-Heavy Safety Net) - PARTIAL

**Problem**: Cycles with 0.8cm were squashing. **Fix**: Added threshold: If `isTextHeavy` AND `distance < 2.5cm`, override. **Regression**: Cycles with `3cm` distance still slipped through.

### v1.6.37 (Bifurcated Safety Net) - SUCCESS

**Problem**: Single threshold didn't work for all cases. **Fix**: Completely bifurcated the logic based on content density:

- **Text-Heavy (Cycle)**: Override ANY distance < 8.4cm. (Aggressive Protection)
- **Text-Light (Pipeline)**: Override ONLY distance < 0.5cm. (Permissive Respect) **Result**: Universal stability.

### v1.6.38 (Title Gap Restoration) - BUGGY

**Problem**: Adaptive Y-Scaling (v1.6.31) set `y=1.5cm` default for relative layouts, causing title offsets to explode. **Fix**: Restored v1.6.12 logic: If `verticalSpan === 0`, force `y=0.5cm`. **Regression**: Accidentally removed x/y injection line during edit.

### v1.6.39 (X/Y Injection Restoration)

**Problem**: v1.6.38 edit broke all LARGE intent diagrams by removing the `extraOpts += x=...cm, y=...cm` line. **Symptom**: LARGE intent diagrams rendered at native TikZ scale (1cm/unit), then shrunk by Zoom-to-Fit to appear "tiny". **Fix**: Restored the critical injection line. **Lesson**: Exercise extreme care when editing complex functions.

### v1.6.40 (Compact Layout Tuning) - SUCCESS

**Problem**: 12cm target height was too aggressive for naturally compact diagrams, creating excessive empty space. **Fix**: Reduced scaling parameters:

- **Target Height**: 12cm → 8cm.
- **Y-Clamp Range**: [1.3, 2.2] → [1.0, 1.8]. **Result**: ~30% reduction in vertical empty space while maintaining readability.

## 29. Current TikZ Parameters (v1.6.40)

For **LARGE** intent (Absolute Layouts):

- **Width Budget**: 25cm.
- **X-Unit**: `Math.min(dynamicClamp, optimalUnit)` where `dynamicClamp = (span > 7) ? 1.8 : 1.3` and `optimalUnit = 25 / span`.
- **Y-Unit**: `Math.min(1.8, Math.max(1.0, 8 / verticalSpan))`. For Relative Layouts (`verticalSpan === 0`), force `y = 0.5cm`.
- **Node Distance**: `8.4cm` for Text-Heavy, `5.0cm` for Light. Bifurcated Safety Net applies.

For **COMPACT** intent (Many Nodes):

- **Scale**: 0.75 (>=8 nodes) or 0.85.
- **Node Distance**: 1.5cm.
- **transform shape**: Applied (scales text proportionally).

## 30. Display Math Scrollbar Fix

Display math equations (`\[...\]`) were showing horizontal scrollbars when wider than the container. **Fix**: Changed `.katex-display` CSS from `overflow-x: auto` to `overflow-x: hidden` and added `max-width: 100%`. **Result**: Wide equations are now clipped rather than scrolled, providing a cleaner appearance.
## 24. Layout & Rendering Robustness (v1.9.4 - v1.9.6)

A series of architectural hardening steps were taken to handle "Sloppy" human/AI input and browser engine limitations.

### 24.1 Header Rendering (The Semantic Realignment)
-   **Old Logic**: `\section` mapped to `<h2>`. CSS only styled `<h3>` (Sections) and `<h4>` (Subsections). Result: Headers were tiny/unstyled.
-   **New Logic**: Semantic realignment.
    -   `\section` -> `<h2>` (CSS: 14pt Bold)
    -   `\subsection` -> `<h3>` (CSS: 12pt Bold)
    -   `\subsubsection` -> `<h4>` (CSS: 11pt Italic)
-   **Sloppy Regex**: Headers are now matched using `[\s\S]*?` to capture titles containing newlines or extra whitespace.

### 24.2 TikZ Robustness Suite
To prevent "Blank Diagrams" (silent crashes), the TikZ engine now performs aggressive pre-flight sanitization:
1.  **Comment Stripping**: All `%` comments are stripped *before* flattening code to newlines. (Prevents code being commented out by flattened `%`).
2.  **Library Injection**: Standard libraries (`arrows, shapes, calc, positioning`) are explicitly injected into every script block.
3.  **Font Safety**: `\sffamily` (Sans Serif) and other font commands are stripped to prevent engine crashes (missing metrics).
4.  **Environment Sanitization**: `itemize` and `enumitem` parameters (e.g., `[leftmargin=*]`) are removed or converted to manual `$\bullet$` lists.
5.  **Collapse Prevention**: The iframe enforces `min-height: 100px` (reduced from 200px in v1.9.16) to ensure visibility without excessive whitespace.
6.  **Option Safety (Double Bracket)**: The merger logic explicitly re-wraps combined options in `[...]` to prevent invalid syntax (`x=1, y=2` vs `[x=1, y=2]`) which causes silent render failures.

### 24.3 Citation Logic (Ref ID Force)
-   **Old Logic**: Sequential ID based on appearance order (`[1], [2]`).
-   **New Logic**: If the key matches `ref_X`, strictly force ID `X`. (`ref_5` -> `[5]`). Fallback to sequential for named references (`Smith2020`).

### 24.4 Table Robustness
-   **Ampersand Glitch**: Specific regex patches exist for known AI typos like `Built-in & Comprehensive` (unescaped `&`).
-   **Width**: Tables are forced to `width: 100%` via CSS to prevent aggressive text wrapping in narrow columns.

## 30. Universal Prompt Hardening (v1.9.37)

**The Philosophy**: You cannot fix every AI hallucination with regex. At some point, you must fix the *source*.

### 1. The "No Labels" Contract
- **Problem**: AI models, when asked for specific sections, often hallucinate labels like `SECTION NAME: Introduction` or `CONTENT: ...` inside the JSON content field.
- **Old Fix**: Endlessly chasing these patterns with regex (`/^SECTION NAME:/`, `/^Title:/`).
- **New Fix (The Contract)**: We updated the System Prompt (Phase 3 & 5) to explicitly forbid labels:
  > `"content": "Raw LaTeX Only. Starts directly with text/commands. NO LABELS."`
- **Universality**: This prevents the issue for *all* future document types, reducing the load on the sanitization layer.

### 2. The "Table Stability" Protocol
- **Problem**: The AI often writes `Policy analysis & public sentiment` inside a table cell.
- **The Crash**: `&` is a special column separator in LaTeX. If unescaped, it creates an extra column, causing the table parser to overflow and break the layout (10 columns instead of 4).
- **The Fix (Prompt Level)**: We added a critical validation rule to the Prompt:
  > `ESCAPE SPECIAL CHARACTERS: You MUST escape & (as \&) and % (as \%) in text content.`
- **Result**: The AI now generates `Policy analysis \& public sentiment`, which parses correctly as text within a single cell.

### 3. The "Ghost Content" Safety Net
- **Layer 1 (Prompt)**: The primary defense (as above).
- **Layer 2 (Code)**: We retain the regex strippers in `latexGenerator.ts` as a fallback safety net.
  - `content.replace(/^SECTION NAME:.*?\n/i, '')`
  - `content.replace(/^CONTENT:\s*/i, '')`
- **Layer 3 (Rendering)**: We updated `LatexPreview.tsx` to handle `\par` commands (often leaked by AI) by converting them to double-newlines (`\n\n`), ensuring they are processed as proper paragraphs rather than rendered as raw text.

### 31. The Universal Text Pass (v1.9.39)
**Problem**: After removing `latex.js`, "standard" LaTeX text (like `\&`, `\textbf`, `\par`) was falling through as raw string content because the new modular engines only targeted specific blocks (TikZ, Math, etc.).
**Solution**: A global `parseLatexFormatting()` pass is now applied to the *entire* document content at the very end of the `processor.ts` pipeline.
**Scope**:
- **Unescaping**: Handles `\&` -> `&`, `\%` -> `%`, `\$` -> `$`, `\{` -> `{`.
- **Typogaphy**: Converts `--` to en-dash, `---` to em-dash, ` `` ` to quotes.
- **Double-Escape Handling**: critical for AI output, `\\&` is converted to `&` (prioritized over single escape).
### 32. TikZ Arrow Sanitization (v1.9.44)
**Problem**: The AI frequently writes Arrows like `\rightarrow` or `\Rightarrow` inside TikZ node labels *without* math mode (e.g., `Node A \rightarrow Node B`). This causes a `! Missing $ inserted` crash in TikZJax.
**Solution**: We automatically wrap known arrow commands in `\ensuremath{...}` within `tikz-engine.ts`.
-   `\rightarrow` -> `\ensuremath{\rightarrow}`
-   `\leftarrow` -> `\ensuremath{\leftarrow}`
-   `\Rightarrow` -> `\ensuremath{\Rightarrow}`
-   `\Leftarrow` -> `\ensuremath{\Leftarrow}`
-   `\leftrightarrow` -> `\ensuremath{\leftrightarrow}`
-   `\Leftrightarrow` -> `\ensuremath{\Leftrightarrow}`
**Mechanism**: `\ensuremath` checks `\ifmmode`. If true (already in math), it does nothing. If false (text mode), it wraps the content in `$ ... $`. This makes the fix robust regardless of context.

### 33. The Grayscale Mandate (v1.9.48)
**Problem**: AI generated diagrams often included colors (`red!60`, `blue`) which violated academic printing standards (Black & White).
**Solution**: Updated System Prompts (Thinker & Rewriter) to explicitly ban color and mandate grayscale or patterns (`dotted`, `dashed`, `thick`).
**Universality**: Applies to ALL future content generation requests.

### 34. Universal List Argument Stripping (v1.9.48)
**Problem**: `itemize` and `description` environments with optional arguments (e.g., `\begin{itemize}[noitemsep]`) leaked the argument as literal text because the parser only skipped the environment name.
**Solution**: Implemented a recursive bracket-skipping loop in `processor.ts` (List Engine) for all list types.
**Universality**: Handles ANY valid LaTeX optional argument structure, including nested brackets (e.g., `[label={[a]}]`), ensuring no configuration text ever leaks into the render.

### 35. Forced Table Cell Alignment (v1.9.48)
**Problem**: Lists inside tables inherited the global `text-align: justify`, causing awkward gaps in narrow table columns.
**Solution**: Enforced `text-align: left !important` via CSS selector `.latex-preview td *`.
**Universality**: Applies to ALL content (lists, paragraphs, divs) inside ANY table cell, overriding all conflicting global styles.

### 37. Bibliography URL Line Break (v1.9.63)
**Change**: Bibliography URLs now appear on a new line for improved readability.
- **Before**: `Author. Title. Venue, 2024. URL: https://...`
- **After**: `Author. Title. Venue, 2024.` (new line) `\url{https://...}`
- **Implementation**: Added `\\\\` (LaTeX line break) before `\url{}` in `latexGenerator.ts`.

### 38. The "Self-Destructing Escaping" Fix (v1.9.65)
**Problem**: HTML header tags (`<h2>`, `<h3>`) rendered as literal text (`&lt;h2&gt;Introduction&lt;/h2&gt;`).
**Root Cause**: `parseLatexFormatting()` escaped `<` and `>` to HTML entities, but it also GENERATES those very tags!
**The Paradox**: A function that creates `<strong>`, `<em>`, `<h2>` was destroying its own output by escaping angle brackets.
**Solution**: Removed `<>` escaping from `parseLatexFormatting()`. HTML escaping should happen at INPUT (untrusted data boundary), not OUTPUT (processed data exit).
**Universal Impact**: Fixed rendering of ALL HTML tags: `<h2>`, `<h3>`, `<h4>`, `<strong>`, `<em>`, `<code>`, `<br/>`, etc.

### 39. Algorithm Environment Caption Handling (v1.9.65)
**Problem**: `Algorithm. (H) \caption{Title}` appeared as literal text instead of a properly formatted header.
**Root Cause 1**: The `[H]` option is a LaTeX **position specifier** (like `[htbp]` for floats), NOT a title. The parser was treating it as title text.
**Root Cause 2**: `\caption{...}` inside the algorithm body was passed through unprocessed.
**Solution**: Special handling for `algorithm` environment in `processor.ts`:
1. Ignore `[H]` (or any position specifier like `[t]`, `[b]`)
2. Extract `\caption{...}` from body and use it as the title
3. Strip `\caption{}` and `\label{}` from the body before rendering

### 40. Nested Placeholder Resolution (v1.9.65)
**Problem**: `LATEXPREVIEWMATH99` appearing as literal text inside algorithm blocks.
**Root Cause**: When `processMath()` extracts math to placeholders, and then `processAlgorithms()` wraps the body (containing those placeholders) into ANOTHER placeholder, the math placeholders become "nested". The final restoration only resolved top-level placeholders.
**Solution**: Added recursive placeholder resolution in `LatexPreview.tsx`:
```typescript
while (hasUnresolved && resolveCount < maxResolves) {
    for (const key in blocks) {
        blocks[key] = blocks[key].replace(/(LATEXPREVIEW[A-Z]+[0-9]+)/g, (match) => {
            return blocks[match] || match;
        });
    }
}
```
This ensures placeholders within placeholder HTML content are fully resolved before DOM injection.

### 41. Markdown Header Stripping (v1.9.64)
**Problem**: AI sometimes outputs Markdown headers (`# ABSTRACT`, `## Section`) inside LaTeX content.
**Root Cause**: LLMs occasionally mix Markdown and LaTeX syntax, especially for section headers.
**Solution**: Added stripping of Markdown headers in `parseLatexFormatting()`:
```typescript
.replace(/^#{1,6}\s+.*$/gm, '')
```
**Prompt Fix**: Added `NO MARKDOWN HEADERS` to abstract prompt and `PURE LATEX ONLY` rule to Phase 3.

### 42. Multirow Table Support with Rowspan Tracking (v1.9.65)
**Problem 1**: `\multirow{4}{*}{\textbf{Academic}}` rendered as literal text.
**Root Cause**: Simple regex couldn't handle nested braces like `\textbf{}` inside `\multirow{}`.
**Solution**: Implemented brace-counting parser that tracks depth to correctly extract the content argument.

**Problem 2**: Tables with `\multirow` had misaligned columns - the last column shifted right.
**Root Cause**: In HTML tables, when a cell has `rowspan="4"`, subsequent rows should have fewer cells (they skip that column). But we were generating empty `<td></td>` for the "phantom cell" that starts rows 2-4 in LaTeX.
**The HTML Rule**: A `rowspan="N"` cell occupies its column for N rows. Rows 2-N must NOT have a cell in that position.
**Solution**: Implemented `activeRowspans: Map<column, remainingRows>` to track which columns have active rowspans. On each row:
1. Decrement all active rowspan counters
2. If first cell is empty AND column 0 has active rowspan → skip the phantom cell
**Result**: Correct column alignment for all multirow tables.

### 43. Structure Processing (The "Recursive List Engine") (v1.9.132)
**Problem**: LaTeX lists (`itemize`, `enumerate`, `description`) and definition blocks (`where`) need complex recursive parsing to handle nesting.
**Architecture**: `processor.ts` uses a recursive pointer-based parser (`processLists()`).
-   **Supported Environments**:
    -   `itemize`: Bullets (`<ul>`).
    -   `enumerate`: Numbers (`<ol>`).
    -   `description`: Definition lists (`<ul class="latex-description">`).
    -   **`where`**: (Added v1.9.132) Native support for math variable definition blocks. Renders as a semantic list with a bold "**Where:**" label.
-   **Mechanism**: The parser tracks depth counter, captures content between `\begin{...}` and `\end{...}`, and recursively re-processes the inner content before wrapping it in HTML. This supports infinite nesting (e.g. `enumerate` inside `itemize` inside `where`).
