# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [1.9.142] - 2025-12-18 (Rendering Robustness: The Clean Sweep)
### Fixed
- **Orphaned Backslashes (`\emph`, `\textbf`)**:
  - **Symptom**: Formatted text appeared with leading backslashes (e.g., `\textbf{Features}` -> `\Features` or `\**Features**`).
  - **Root Cause**: Upstream normalization created triple backslashes (`\\\textbf`). The formatter regex (`\\textbf`) consumed only two, leaving an orphaned backslash (`\`) before the generated HTML tag.
  - **Fix**: Updated all text formatting regexes in `processor.ts` to use `\\+` (one or more backslashes), ensuring all preceding escapes are consumed.
- **Algorithm Rendering (`\ForAll`, `\hfill`)**:
  - **Symptom**: `\ForAll` and `\hfill` in algorithm blocks were rendered as raw text.
  - **Fix**: Added formatting rules to `processor.ts`: `\ForAll` -> **for all**, `\hfill` -> `float: right`.
- **Global Normalization (Logos & Quotes)**:
  - **Feature**: Added native support for `\TeX`, `\LaTeX`, `\TikZ` logos and smart quotes (`\textquotedblleft`/`right`).
- **Math Mode Polyfill**:
  - **Fix**: Added `\textsc` macro to `math-engine.ts` (KaTeX) to prevent crashes when small caps are used inside math environments.

## [1.9.138] - 2025-12-17 (Content Preservation Update)
### Fixed
- **The "Blockquote Eater" (Missing First Line)**:
  - **Symptom**: Abstracts or sections missing their first line (e.g., "This paper..." -> "paper...").
  - **Root Cause**: A regex (`^>.*`) intended to remove AI thinking traces was deleting *all* lines starting with `>`. AI models often format Abstracts as blockquotes (`> This paper...`).
  - **Fix**: Updated `server/ai/utils.ts` to only remove the `> ` prefix ("Unquote") instead of deleting the line. Content is now preserved.
- **Abstract Keyword Collision**:
  - **Symptom**: Sentences starting with "Abstract" lost the first word (e.g., "Abstract reasoning..." -> "reasoning...").
  - **Fix**: Updated `processor.ts` to require a strict delimiter (colon/newline) before stripping the word "ABSTRACT".

## [1.9.141] - 2025-12-17 (REVERT: Original DELETE Logic)
### Reverted
- **Blockquote Handling**: Reverted v1.9.138/139/140 changes.
  - **Reasoning**: The complex "Smart Block Matcher" and "Unquoted Paragraph Filter" caused:
    - **False Positives**: Valid content (e.g., `\textbf{Background}`) was deleted.
    - **False Negatives**: Reasoning headers containing "abstract" substring were preserved.
  - **New State**: Restored original DELETE logic: `clean.replace(/^>.*$/gm, "")`.
  - **Trade-off**: User prefers occasional edge case (quoted abstract deleted) over consistent paragraph-level failures.

## [1.9.140] - 2025-12-17 (Unquoted Reasoning Safety) [REVERTED]
### Fixed
- ~~**Unquoted Reasoning Leak**~~ (Reverted in v1.9.141)

## [1.9.139] - 2025-12-17 (Smart Block Sanitization) [REVERTED]
### Fixed
- ~~**Reasoning Leak in Blockquotes**~~ (Reverted in v1.9.141)

## [1.9.137] - 2025-12-17 (Double-Braced Label Safety)
### Fixed
- **TikZ Brace Polyfill (Label Crash)**:
  - **Symptom**: Brace Polyfill failed (causing render crash) when the label contained nested braces (e.g. `{\textit{Text}}`).
  - **Root Cause**: The Regex `\{([^}]*)\}` for capturing labels stopped at the *first* closing brace, failing to match nested commands.
  - **Fix**: Updated Regex to `\{([\s\S]*?)\};`, lazily capturing *all* content (including nested braces/newlines) until the terminating semicolon.

## [1.9.136] - 2025-12-17 (Robust Diagram Polyfills)
### Fixed
- **TikZ Brace Polyfill Crash**:
  - **Symptom**: TikZ diagrams with braces (`decoration={brace}`) failing to render if options like `, thick` were added.
  - **Root Cause**: The Regex targeting braces was too strict (`\}\]`), failing when trailing options existed.
  - **Fix**: Updated Regex in `tikz-engine.ts` to allow/capture trailing options (`\}[^\]]*\]`) and inject them (`tailOpts`) into the generated Bezier curve command.

## [1.9.135] - 2025-12-17 (Visual Symmetry)
### Fixed
- **Venn Diagram Rendering**:
  - **Symptom**: Venn diagrams appeared lopsided, cramped, or lacked transparency, making overlaps unreadable.
  - **Root Cause**: General Tkiz rules favored "Relative Positioning" (flowcharts) over "Polar Coordinates" (geometry).
  - **Fix**: Added **Venn Diagram Protocol** to Phase 3 System Prompt: Enforce Polar Coordinates, Opacity, and Minimum Size for overlaps.

## [1.9.134] - 2025-12-17 (Mathematical Precision)
### Fixed
- **Inline Math Rendering**:
  - **Symptom**: Variables in narrative text (e.g. `L_{market}`) rendered as raw text.
  - **Root Cause**: Phase 3 Agent wasn't instructed to use dollar signs (`$`) for inline math, so it output Markdown-style or plain labels.
  - **Fix**: Added "INLINE MATH" rule to Phase 3 Prompt: `Use $ ... $ for all mathematical variables`.
  - **Safety**: Verified that `processor.ts` extracts math *before* text cleaning, ensuring variables are protected.

## [1.9.133] - 2025-12-17 (Typography & Text Command Support)
### Fixed
- **`\text{...}` Rendering**:
  - **Symptom**: `\text{Where:}` appeared as literal LaTeX code in the preview.
  - **Root Cause**: The custom processor lacked a handler for the `\text` command (common in `amsmath` environments) and treated it as raw text.
  - **Fix**: Added a rule to `processor.ts` to unwrap `\text{content}` -> `content`.
- **Smart Quotes (`\textquoteleft`, `\textquoteright`)**:
  - **Symptom**: "Market signals" appeared surrounded by literal `\textquoteleft` commands.
  - **Root Cause**: Missing mapping for these specific LaTeX quote commands.
  - **Fix**: Mapped `\textquoteleft` to `‘` and `\textquoteright` to `’` in the global text formatter.

## [1.9.132] - 2025-12-17 (Root Cause Elimination)
### Fixed
- **Hallucinated Placeholders (`[INSERT ENHANCEMENT HERE]`)**:
  - **Symptom**: The AI inserted text placeholders for diagrams in the narrative body, which remained as "junk text" alongside the correctly generated floats.
  - **Root Cause**: The Phase 3 prompt didn't explicitly forbid this behavior, so the AI followed its training data habits.
  - **Fix**: Added a **Negative Constraint** to Phase 3 Prompt: `10. NO PLACEHOLDERS`.
- **LaTeX Double-Escaping (Broken Author Names)**:
  - **Symptom**: Names like "Öpçin" appeared as `\"{O}p\c{c}in` in the PDF.
  - **Root Cause**: Phase 2 AI output LaTeX codes (`\"{O}`) which the generator blindly re-escaped (`\textbackslash"{O}`).
  - **Fix**: Added **"UNICODE ONLY"** rule to Phase 2 Prompt, enforcing UTF-8 output.
- **`where` Environment Rendering**:
  - **Symptom**: `\begin{where}` blocks appeared as raw text with broken `<li>` tags in the preview.
  - **Root Cause**: `processor.ts` lacked a handler for the `where` environment.
  - **Fix**: Added native list processing support for `where`, rendering it with a bold "Where:" label.

## [1.9.131] - 2025-12-17 (Pipeline Stability & Schema Guards)
### Fixed
- **Critical Crash: `Cannot read properties of undefined (reading 'length')`**:
  - **Symptom**: The server crashed during Phase 1 logging.
  - **Root Cause**: The AI returned a partial JSON schema (missing `search_queries` array), and the code blindly accessed `.length`.
  - **Fix 1 (Defense)**: Implemented **Schema Guards** in `service.ts` to default missing arrays to `[]` and log warnings.
  - **Fix 2 (Root Cause)**: Refactored Phase 1 Prompts to move the Schema Definition to the **System Prompt** and wrap input in `<source_text>` XML tags, preventing context confusion.

## [1.9.130] - 2025-12-17 (Attribution & Footer Update)
### Changed
- **LaTeX Footer Attribution**:
  - Updated the footer format to be more explicit and linkable.
  - **New Format**:
    - Line 1: `Generated by Auto-Academic-Paper Created by Keith Li (\url{https://github.com/keithligh})`
    - Line 2: `Model used: Strategist Agent: [Model] / Writer Agent: [Model] / Librarian Agent: [Model]`
  - **Logic**: Updated `latexGenerator` to accept granular model names for each agent role (Strategist, Writer, Librarian) instead of a single generic model usage string.
  - **Note**: Re-generating old jobs (Enhancement Toggle) will show "Unknown" for models as this metadata was not previously persisted.

## [1.9.129] - 2025-12-17 (Abstract Processing Hotfix)
### Fixed
- **Abstract Truncation ("The 'This' Bug")**:
  - **Symptom**: The first word of the abstract (e.g., "This") was consistently stripped, resulting in " paper examines..." instead of "This paper examines...".
  - **Root Cause**: The sanitizer used a **greedy** regex `[\s\S]*?` combined with a double separator `(\n\n|$)` to remove prefixes like "Here is the abstract". When the AI output the abstract compactly (single line or no double newline), the regex over-consumed the prefix *and* the first word(s) of the content.
  - **Fix**: Replaced all greedy "Block Sanitizers" in `server/ai/utils.ts` with **"Prefix Only"** sanitizers (`^Here is the abstract[:.]?\s*`). This targets *only* the specific intro phrase and preserves the rest of the line, guaranteeing content integrity regardless of spacing.

## [1.9.128] - 2025-12-17 (LaTeX Structural Integrity & Sanitization)
### Fixed
- **`\usetikzlibrary` in Document Body**:
  - **Symptom**: `\usetikzlibrary{...}` commands appeared in the document body (from AI-generated enhancements), causing LaTeX compilation errors or "Can only be used in preamble" warnings.
  - **Root Cause**: AI enhancements (TikZ diagrams) included their own library imports, which `latexGenerator` blindly injected into the section content.
  - **Fix**: Implemented `sanitizeTikzLibraries` in `latexGenerator.ts`. It scans all enhancements *before* generation, extracts unique libraries to a global Set, injects them into the Preamble, and strips them from the enhancement content.

- **Equations in Preamble (Symbol Enhancement Fix)**:
  - **Symptom**: `\begin{equation}` blocks appearing before the `\begin{document}` or Abstract, breaking compilation.
  - **Root Cause**: The "Symbol" enhancement was ambiguously defined, causing the AI to generate equations (standard math models) instead of nomenclature lists.
  - **Fix 1 (Conditional Logic)**: Updated `service.ts` to ONLY expose the "Symbol" toolkit option if `paperType` is **"Thesis"**. It is now hidden for standard papers.
  - **Fix 2 (Strict Definition)**: Redefined the "Symbol" prompt to strictly require `\begin{itemize}` lists and explicitly **FORBID** `\begin{equation}` usage.

- **Missing First Word in Abstract**:
  - **Symptom**: The Abstract started with "paper examines..." instead of "This paper examines...", appearing truncated.
  - **Root Cause**: The AI output contained prefixes like "Abstract:" or "Thinking Process: ... \n This...", and uneven newline handling or aggressive regexes in `sanitizeLatexOutput` caused partial deletion.
  - **Fix**:
    1. **Prompt**: Instructed AI to "START DIRECTLY WITH TEXT. Do not use 'Abstract:' prefix."
    2. **Sanitizer**: Added explicit regex to `server/ai/utils.ts` to safely strip "Abstract:", "Title:", and "Here is..." prefixes *before* deeper cleaning.

## [1.9.127] - 2025-12-15 (Strategist Prompt Refinement)
### Fixed
- **`\usetikzlibrary{...}` Rendering as Text**:
  - **Symptom**: `\usetikzlibrary{positioning}` appeared as raw text in the preview.
  - **Root Cause**: Missing preamble stripping rule in `processor.ts`.
  - **Fix**: Added `\usetikzlibrary{...}` to the command stripping section (line 698).

- **TikZ "Dimension too large" Error on Bend Paths**:
  - **Symptom**: Diagrams with `bend left=25` paths failed with "Dimension too large" error.
  - **Root Cause**: IntentEngine overriding user's `node distance=2.5cm` with `8.4cm` for text-heavy diagrams. When combined with `bend` curve calculations, TikZjax overflowed.
  - **Fix**: Added `hasBendPath` detection in `tikz-engine.ts`. When `bend ` or `bend=` is detected, `targetDist` is capped at 5.0cm.

- **TikZ "Undefined control sequence" Error on `\n` in Node Labels**:
  - **Symptom**: Diagrams with `{Value\nproposition}` in node labels failed with "Undefined control sequence" error.
  - **Root Cause**: Old regex `/\\n(?![a-zA-Z])/g` only stripped `\n` if NOT followed by a letter. But in `Value\nproposition`, `\n` is followed by `p`, so it wasn't stripped.
  - **Fix**: Changed to whitelist approach: `/\\n(?!ode|ewline|ewcommand|ewenvironment|oindent|umber|olimits)/g`. Now only protects known LaTeX commands (`\node`, `\newline`, etc.) while stripping AI-generated newlines in labels.

- **`repairLatex` Chatty Claude Output**:
  - **Symptom**: Claude outputting "Here's the corrected version..." with markdown fences instead of raw LaTeX.
  - **Root Cause**: Claude's "helpful" personality overrides simple "no explanation" instructions.
  - **Fix**: Rewrote prompt with 4 anti-chatty techniques: (1) Role reinforcement ("SILENT CODE TRANSFORMER"), (2) Negative reinforcement (explicit FORBIDDEN list), (3) Anchoring (first character must be `\` or `%`), (4) Minimal format example.

### Changed
- **Strategist Prompt (Phase 1) - Academic Transformation Focus**:
  - **Before**: Prompt focused on "long-form", "exhaustive coverage", word count targets.
  - **After**: Reframed as 3-step academic transformation process:
    1. Identify the ACADEMIC ANGLE (insight, field, discourse)
    2. Explore RESEARCH OPPORTUNITIES (frameworks, literature, gaps)
    3. Plan the PAPER (structure, evidence, argument goals)
  - **Reasoning**: The Strategist's job is to explore opportunities to transform source input into journal-ready research, not to micromanage structure.
  - **Philosophy**: "Let LLM do its work" - only constraint is search query count (5/10/20) for API cost control.

- **Removed Word Count Constraints**:
  - Removed `approximate_words` from `sectionPlanSchema` in `shared/schema.ts`.
  - Removed `TARGET LENGTH` directive from Phase 3 (Thinker) prompt.
  - Removed word count example (`500 words`) from Strategist JSON output format.
  - **Reasoning**: Word counts are artificial constraints that interfere with LLM's natural judgment about depth.

- **UI: Disabled Advanced Options Checkboxes**:
  - Added `disabled` attribute to all 6 checkboxes (Citations, Formula, Hypothesis, Diagram, Logical Structure, Symbol).
  - Card remains visible but non-interactive.
  - **Reasoning**: Let LLM decide what enhancements to include based on content needs.

### Technical Notes
- **Option C Implemented**: No `academic_angle` field added to schema. LLM re-derives context as needed in downstream phases. This aligns with the system's philosophy of trusting the LLM.
- **Search Query Limits Preserved**: minimal=5, standard=10, advanced=20 (unchanged, for API cost control).

## [1.9.126] - 2025-12-14 (Formatting & Algorithm Enhancements)
### Fixed
- **Algorithm Font Sizing**:
  - **Symptom**: `\small`, `\footnotesize`, `\scriptsize`, `\tiny` commands inside Algorithm blocks were ignored, causing large text in limited space.
  - **Fix**: Implemented explicit Font Size Switch detection in `processAlgorithms`. Matches commands, strips them, and applies equivalent CSS `font-size` (`0.9em`, `0.8em`, etc.) to the algorithm body.
  - **Philosophy**: "Parsing Valid LaTeX is a Rendering Job." Since `\small` is valid, the renderer must handle it.
- **Typographic Integrity**:
  - **Feature**: Added support for `\textsf{...}` (Sans-sertif) and `\textquote{...}` (Smart Quotes `“...”`).
  - **Fix**: Added support for `\textquotesingle` -> `’` (Smart Apostrophe).
  - **Invalid Removal**: Explicitly removed support for `\textquotes` (plural) which is NOT a valid LaTeX command, preventing "healing" of hallucinated syntax.

## [1.9.113] - 2025-12-13 (Standardized Table Styling)
### Fixed
### Fixed
- **Table "Grid" Lines (Extra Borders)**:
  - **Symptom**: Tables appeared with borders between every row ("black lines everywhere"), violating academic style.
  - **Root Cause**: The AI generated `\hline` after every row, and the table engine faithfully rendered them as borders.
  - **Fix (v1.9.116)**: Updated `table-engine.ts` to **IGNORE** `\hline` for border rendering. Now, only Semantic Rules (`\midrule`, `\bottomrule`) trigger a CSS border.
  - **Refinement (v1.9.118 - Smart Borders)**: Users reported "No separators" when AI used `\hline` for headers. Added "Smart Logic": `\hline` is now ignored *unless* the row is a Header (contains `\textbf`) or the Last Row.
  - **Final Adjust (v1.9.120 - Restored Grid)**: User clarified they *wanted* separators (Grid) but hated "short lines from nowhere" (`\cline`). Updated logic to **ALLOW** `\hline` everywhere (restoring Grid) but **IGNORE** `\cline` (killing short lines).
  - **Refinement (v1.9.118 - Smart Borders)**: Users reported "No separators" when AI used `\hline` for headers. Added "Smart Logic": `\hline` is now ignored *unless* the row is a Header (contains `\textbf`) or the Last Row. This restores structure without grid clutter.
  - **Refinement (v1.9.118 - Smart Borders)**: Users reported "No separators" when AI used `\hline` for headers. Added "Smart Logic": `\hline` is now ignored *unless* the row is a Header (contains `\textbf`) or the Last Row.
  - **Correction (v1.9.121 - Parsing Correctness)**: User demanded explanation for "Short lines from nowhere". Investigation revealed they were **Ghost Rows** (1-col wide) caused by the "Stray Backslash" parsing bug. Since v1.9.119 fixed the Ghost Rows, the short lines are gone. `\cline` is currently ignored intentionally as the engine does not yet support partial border rendering.
- **Grid Restoration (v1.9.122)**:
  - **Symptom**: User reported "No Grid" (Missing lines) even after restoring `\hline`.
  - **Root Cause**: The v1.9.119 "Stable" implicit splitter regex `([^\\])` incorrectly matched the space in `Text \\ \hline`, creating `Text \\ \\ \hline`. This Double Split created an empty "Ghost Row" which swallowed the border logic.
  - **Fix**: Replaced regex with a **Capture Group** logic `(\\)?` that acts correctly: if `\\` is present, touch nothing; if missing, add `\\`. This definitively restores the grid for valid LaTeX.
- **AI Malformed Tables (v1.9.123)**:
  - **Symptom**: Tables appeared "smashed" with content overlapping or missing row breaks.
  - **Root Cause**: The System Prompt instructed "NO horizontal lines", which inadvertently encouraged the AI to be lazy with row terminators (`\\`), resulting in invalid LaTeX.
  - **Fix**: Updated System Prompt to remove styling bias and strictly enforce **VALIDITY**: "Every row MUST end with `\\`. Use `&` for columns. Escape special characters."
- **Strict Mode Rendering (v1.9.124)**:
  - **Philosophy**: User demanded removal of all "best effort" fixes that accommodated invalid LaTeX.
  - **Change**: Disabled the **Implicit Row Splitter** (which guessed missing `\\`) and the **Cell Sanitizer** (which hid parsing artifacts).
  - **Result**: The engine now strictly adheres to LaTeX rules. If the AI generates invalid tables (missing `\\`), they will break. This forces the solution to rely on valid Generation (v1.9.123) rather than patching Rendering.
- **Partial Border Support (v1.9.125)**:
  - **Feature**: Implemented full support for `\cline{start-end}`.
  - **Mechanism**: The parser now extracts column ranges from `\cline` commands and applies `border-bottom` styles specifically to the overlapping cells (handling spans correctly).
  - **Correctness**: Previously ignored due to "laziness", it is now supported because it is Valid LaTeX.

## [1.9.112] - 2025-12-13 (Text Color Support)
  - **Symptom**: Table headers were generated in "Navy" blue instead of standard bold black, confusing users.
  - **Root Cause**: An explicit "Academic Color Palette" instruction in the System Prompt encouraged using Navy/Maroon.
  - **Fix**: Removed the color palette instruction and replaced it with a strict rule: "Use `\textbf{}` for emphasis. AVOID colored text. Black text only."

## [1.9.112] - 2025-12-13 (Text Color Support)
### Fixed
- **Table Header Colors**:
  - **Symptom**: Table headers using `\textcolor{Navy}{...}` appeared as raw text commands in the preview.
  - **Fix**: Added `\textcolor{color}{text}` parser to `processor.ts` with a built-in map for common LaTeX colors (e.g., Navy, OliveGreen, Maroon).
  - **Validation**: Verified against standard XColor/Dvipsnames usage.

## [1.9.111] - 2025-12-13 (Table Generation Strategy Update)
### Fixed
- **Dense Table Legibility**:
  - **Symptom**: Tables with heavy text were generated with narrow fixed-width columns (`p{2.8cm}`), causing extreme wrapping.
  - **Fix**: Updated System Prompt (Phase 3) to mandate `tabularx` with `X` columns for dense text.
  - **Support**: Updated `table-engine.ts` to recognize `X` columns and render them as auto-width.
  - **Philosophy**: Fix the *generation* (root cause) rather than just patching the rendering.

## [1.9.110] - 2025-12-13 (Table Layout Relaxation)
### Fixed
- **Excessive Table Wrapping**:
  - **Symptom**: Tables with narrow `p{...}` columns wrapped text aggressively, even when screen space was available.
  - **Fix**: Modified `table-engine.ts` to translate `p{width}` to CSS `min-width` instead of strict `width`.
  - **Result**: Browser can now expand columns to fit content (auto-layout) while respecting the LaTeX width as a minimum floor.

## [1.9.109] - 2025-12-13 (Table Rendering Robustness)
### Fixed
- **Table Overflow & Clipping**:
  - **Symptom**: Tables with fixed widths (e.g., `p{3.2cm}`) that exceeded the container width were being clipped on the left side due to `flex: center` alignment.
  - **Fix**: Updated `latex-article.css` to use `display: block` with `margin: 0 auto` for centering, and removed `max-width: 100%` constraints.
  - **Result**: Tables now scroll horizontally (`overflow-x: auto`) without data loss when they exceed the page width.

## [1.9.108] - 2025-12-13 (Proof Environment Support)
### Added
- **Proof Environment (`\begin{proof}`)**:
  - **Feature**: Added missing support for the `amsthm` Proof environment.
  - **Visuals**: Renders as a semantic block: **"Proof."** (Bold) + Body + **QED Symbol** ($\square$) floated to the right.
  - **Root Cause**: The environment loop handled `theorem`/`lemma` but `proof` was special (requires QED symbol) and was missing from the parser.

## [1.9.107] - 2025-12-13 (Layout Command Cleanup)
### Fixed
- **Exposed Layout Commands (`\renewcommand`, `\setlength`)**:
  - **Symptom**: Commands like `\renewcommand{\arraystretch}{1.15}` appeared as raw text in the preview.
  - **Fix**: Added regex strippers in `processor.ts` to silently remove `\renewcommand{\arraystretch}{...}` and `\setlength{...}{...}`.
  - **Reasoning**: These are visual layout instructions for PDF, not content. Stripping them prevents visual pollution in the HTML preview.

## [1.9.106] - 2025-12-13 (TikZ Prompt Engineering Fix)
### Fixed
- **TikZ Prompt Under-Specification**:
  - **Problem**: The AI was generating "bad TikZ" (deprecated syntax, massive text that overlaps, PGFPlots that crash) because the System Prompt only said "(Keep it simple)".
  - **Root Cause**: Investigated `server/ai/service.ts` and found the prompt instruction was effectively nonexistent (7 words).
  - **Fix**: Injected a **"TIKZ DIAGRAM RULES"** block into Phase 3 (Drafting) System Prompt:
    1. **Syntax**: Enforce `\usetikzlibrary{positioning}` and `right=of` (edge-to-edge).
    2. **Wrapping**: Force `text width=2.5cm` for long labels.
    3. **Libraries**: Whitelist standard libraries only.
    4. **Safety**: Explicitly ban `pgfplots` and `\addplot`.
  - **Philosophy**: Fix the error at the source (Generation) rather than the sink (Rendering).

## [1.9.104] - 2025-12-13 (UI Standardization: "Academic Art")
### Added
- **UI Design Master**: Created `UI_DESIGN_MASTER.md` as the SSOT for the "Hybrid Typography" system.
- **Design Philosophy**: Formally adopted "Academic Art" aesthetic:
  - **Serif (`font-serif`)**: Used strictly for Branding ("Auto Academic Paper"), Major Page Titles, and Academic Content.
  - **Sans-Serif (`font-sans`)**: Used for UI Controls, Metadata, Logs, and Body Text.

## [1.9.105] - 2025-12-13 (Grok Agentic Search Fix)
### Fixed
- **"No JSON Object" Error (Grok-4-1-Fast)**:
  - **Symptom**: Librarian Research failed with "No JSON object or array found" even when `grok-4-1-fast` was selected.
  - **Root Cause**: The xAI Agentic Search endpoint (`/responses`) returns the final answer in a unique format: `content: [{ type: 'output_text', text: '...' }]`. The previous adapter logic only filtered for `type: 'text'`, silently discarding the actual answer.
  - **Fix**: Updated `server/ai/adapters/grok.ts` to accept `output_text` content type.
  - **Impact**: Full Agentic Research capabilities (Web Search + Synthesis) now strictly functional for Grok 4.1.

### Changed
- **ConfigPage Redesign**:
  - **Header**: Upgraded to the standard "Sticky Blur" header with Serif Branding, matching `LandingPage` and `ResultPage`.
  - **Typography**: Restored Serif fonts to the main "Configuration" title (`h1`).
  - **Layout**: Widened main container from `max-w-4xl` to `max-w-6xl` for consistency with the rest of the app.
  - **Controls**: Restored the "Reset Defaults" button in the main body.

## [1.9.102] - 2025-12-13 (xAI Grok Integration)
### Added
- **xAI Grok Support**: Whitelisted `grok-4-1-fast` and `grok-4-1-fast-non-reasoning` for the Librarian role.
- **Agentic Search Integration**:
  - **Feature**: Connected Librarian to xAI's `/responses` endpoint (Agentic Tool Calling).
  - **Logic**: Implemented strict non-streaming REST calls (streaming search is unstable) to enable Grok to perform autonomous iterative research and return compiled answers with citations.
  - **UI**: Added conditional Dropdown in `ConfigPage.tsx` for Grok models (mirroring Poe UI).
  - **Verification**: Added `server/test_xai_connection.ts` for automated connectivity checks.

## [1.9.101] - 2025-12-13 (Git Merge Strategy: Development -> Main)
### Changed
- **Git Workflow (Local DB Safety)**:
  - **Problem**: Merging `Development` branch (where `local.db` was tracked) into `main` (where `local.db` is ignored/untracked) creates a "Modify/Delete" conflict that risks data loss.
  - **Resolution Strategy**:
    1. **Pre-Merge**: `git rm --cached local.db` on source branch to align tracking status.
    2. **Conflict**: Accept "Delete" on merge (since we want it untracked).
    3. **Protection**: Manually backup `local.db` -> `local.db.bak` before checkout to prevent Git from overwriting the working file during state transitions.
  - **Result**: `local.db` successfully migrated to "Ignored" status without data loss.

## [1.9.100] - 2025-12-13 (Configuration Fixes)
### Fixed
- **Librarian Bot Name Mismatch**: Fixed a typo in `ConfigPage.tsx` and `poe.ts` where the custom bot was defined as `Gemini25Flash-APP` (Client) but rejected by the whitelist or server as invalid. Corrected to `Gemini25Flash-AAP` across the stack.
- **Documentation**: Comprehensively updated `LATEX_PREVIEW_SYSTEM.md` and `TIKZ_HANDLING.md` with recent architectural decisions (Non-Destructive Flattening, Wrapper Preservation).

## [1.9.99] - 2025-12-13 (Non-Destructive Flattening)
### Fixed
- **Missing Figures / Captions**: Identified that legacy "Flattening" logic (intended to inline figures) was **destructive**, aggressively deleting `\caption{...}` and `\begin{figure}` wrappers. This caused diagrams to lose their context and titles.
- **Fix**: Upgraded flattening logic to be **Structured & Non-Destructive**. It now converts `figure`/`table`/`algorithm` wrappers into semantic HTML `<div>` blocks and correctly renders captions instead of deleting them.
- **Scoped List Support**: (v1.9.98) Restored rendering of lists inside algorithms.
- **Whitespace Synchronization**: (v1.9.97) Fixed Red Box triggers.
- **Custom Macros**: Added support for `\where:` -> `Where:` (often hallucinated by AI in equation context).
- **Healer Verification**: Confirmed `healer.ts` correctly strips literal `\n` sequences and Markdown fences (` ```latex `) that confuse the parser.

## [1.9.95] - 2025-12-13 (Symbol Corruption Fix)
### Fixed
- **Critical Font Corruption**: Fixed a severe bug in `parseLatexFormatting` where unprotected math symbol replacements (e.g., `\cap` -> `∩`, `\subset` -> `⊂`) corrupted matching LaTeX commands (e.g., `\caption` -> `∩tion`). Added `(?![a-zA-Z])` lookaheads to all unsafe replacements to ensure they only match whole words/symbols.

## [1.9.94] - 2025-12-13 (Safety Sweep Escaped HTML)
### Fixed
- **Pipeline Order Conflict (Final)**: Updated Safety Sweep `(?!...)` and `(?=...)` conditions to handle **ESCAPED HTML headers** (`&lt;h[1-6]`). The text formatter runs before the sweep and escapes brackets, so checking for `<h3>` was insufficient.
- **Terminator Logic**: Added a positive lookahead `(?=...)` to the regex terminator. This ensures that the sweep successfully *matches* and *wraps* the broken block when it hits a header, instead of failing the match and leaving the code raw.

## [1.9.92] - 2025-12-13 (Safety Sweep HTML Awareness)
### Fixed
- **Pipeline Order Conflict**: Updated Safety Sweep lookahead to detect **HTML headers** (`<h[1-6]`) in addition to LaTeX headers. Because `processHeaders` runs *before* the Safety Sweep, sections are already converted to `<h3>`, etc., causing the previous regex (checking for `\section`) to miss them and swallow the content.

## [1.9.91] - 2025-12-13 (Crash Fixes & Logging)
### Fixed
- **Engine Crash**: Added "Color Aliases" (`Navy --> navy`, `Maroon --> maroon`) to `tikz-engine.ts` to prevent `jsTeX` crashes caused by capitalized color names.
- **Debug Logs**: Added verbose logging to `LatexPreview` and `processor.ts` to capture failing content and safety triggers.

## [1.9.90] - 2025-12-13 (Safety Sweep Refinement)
### Fixed
- **Runaway Error Blocks**: Refined the "Safety Sweep" regex to include a negative lookahead `(?!\\section|\\subsection)`. This ensures that even if a block is unclosed, the error container captures *only* the block and stops at the next section header, preventing the "Red Box" from swallowing the rest of the document.
- **Regex Compatibility**: Replaced ES2018 `s` flag with `[\s\S]` for broader browser support.

## [1.9.89] - 2025-12-13 (Robust Preview Parsing)
### Fixed
- **Total Preview Breakdown**: Implemented "Safety Sweep" in `processor.ts` to detect and wrap malformed LaTeX blocks (like truncated Algorithms) in error containers, preventing them from breaking the entire preview rendering.
- **Robust Headers**: Updated Section/Subsection regexes to use recursive nested brace matching, ensuring headers are parsed correctly even in complex or slightly malformed documents.

## [1.9.88] - 2025-12-13 (Markdown Thinking Cleanup)
### Fixed
- **Persistent Artifacts**: Hardened `sanitizeLatexOutput` to remove Markdown-style `*Thinking...*` and `*Thinking Process...*` artifacts that evaded previous filters.

## [1.9.89] - 2025-12-13 (Robust Preview Parsing)
### Fixed
- **Total Preview Breakdown**: Implemented "Safety Sweep" in `processor.ts` to detect and wrap malformed LaTeX blocks (like truncated Algorithms) in error containers, preventing them from breaking the entire preview rendering.
- **Robust Headers**: Updated Section/Subsection regexes to use recursive nested brace matching, ensuring headers are parsed correctly even in complex or slightly malformed documents.

## [1.9.88] - 2025-12-13 (Markdown Thinking Cleanup)
### Fixed
- **Persistent Artifacts**: Hardened `sanitizeLatexOutput` to remove Markdown-style `*Thinking...*` and `*Thinking Process...*` artifacts that evaded previous filters.

## [1.9.87] - 2025-12-13 (Academic Color Palette)
### Fixed
- **Undefined TikZ Colors**: Fixed `Package pgfkeys Error` caused by AI using `darkgreen`, which is undefined in TikZJax.
- **Aesthetic Enforcement**: Implemented "Color Polyfill" that automatically redefines primary colors to professional shades:
  - `red` -> **Maroon**
  - `blue` -> **Navy Blue**
  - `green` -> **Forest Green**
  - `darkgreen` -> **Defined** (rgb 0, 0.4, 0)

## [1.9.86] - 2025-12-13 (Reasoning Artifact Cleanup)
### Fixed
- **Reasoning Leaks**: Patched `sanitizeLatexOutput` to aggressively strip "Thinking" blockquotes (`> Thinking...`) and "Thinking Process:" headers that were leaking into the final Abstract.
- **Scope**: Applied sanitization specifically to the Abstract generation phase (previously raw output).

## [1.9.85] - 2025-12-13 (Tiered Librarian Limits)
### Added
- **Tiered Search Query Limits**:
  - **Minimal Enhancement**: Capped at **5 queries** (Speed/Cost efficiency).
  - **Standard Enhancement**: Capped at **10 queries** (Balanced research).
  - **Advanced Enhancement**: Capped at **20 queries** (Deep dive, strictly enforced).
  - **Why**: Prevents "analysis paralysis" and ensures resource usage scales proportionally with user intent. Previously, "Advanced" was effectively unlimited, leading to massive context usage without proportional quality gain.

## [1.9.84] - 2025-12-13 (Unified Status Logging)
### Changed
- **SSOT Log Format**: Unified all backend service logs to a single, consistent format:
  - **Format**: `[Phase] Content... (N chars)`
  - **Optimization**: Truncated dynamic section names to 60 characters to fit standard terminal rows while preserving key information.
  - **Scope**: Applied to Strategist, Thinker, Reviewer, Rewriter, and Editor phases.
  - **Benefit**: "One Row Per Update" - Eliminates terminal wrapping and scroll fatigue while maintaining visibility into the "heartbeat" of the generation process.

## [1.9.83] - 2025-12-13 (TikZ Continuous Scaling)
### Fixed
- **TikZ Scale Clamping**: Replaced the "Step Function" clamp (which created a sizing "Cliff" between span 6 and 8) with a **Continuous Adaptive Scaling** logic. Now targets a diagram width of ~12cm (75% A4), ensuring predictable and consistent sizing for diagrams of all intrinsic widths.

## [1.9.82] - 2025-12-13 (TikZ Local Clip)
### Fixed
- **TikZ Auto-Clip Refined**: The previous "Global Clip" (v1.9.81) occasionally cut off axis labels that extended beyond the grid. The new **Local Scope Clip** surgically wraps only the `\draw ... plot ...` command in a clipping scope. This trims asymptotic curves to the axis bounding box while guaranteeing that labels and arrows remain fully visible.

## [1.9.81] - 2025-12-13 (TikZ Auto-Clip)
### Fixed
- **TikZ Unbounded Plots**: Implemented **Auto-Clipping** for diagrams with plots. Mathematical functions (like $1/x$) often shoot to infinity outside the drawn axes. The Engine now calculates the "Explicit Bounding Box" of the axes/nodes and injects a `\clip` command (+1 unit padding) to physically cut off these "Off the Chart" lines, preserving the visual layout.
- **TikZ Plot Distortion**: Enforced strictly square scaling (`x=1, y=1`) prevents ellipses and distortion.

## [1.9.80] - 2025-12-13 (TikZ Scope & Plot Fix)
### Fixed
- **TikZ Scope Shifts**: The Intent Engine now accounts for `xshift` and `yshift` in `scope` environments. Previously, shifted scopes were treated as overlapping, causing wide diagrams to be misclassified as small/compact.
- **TikZ Plot Safety**: Implemented a strict **1:1 Aspect Ratio Enforcement** (`x=1, y=1`) when `plot` commands are detected. This prevents "Vertical Blowout" on asymptotic functions (like $1/x$) and eliminates geometric distortion (squashed circles) caused by mismatched X/Y scaling.

## [1.9.79] - 2025-12-13 (Quote Environment Support)
### Added
- **Quote Environment**:
  - **Feature**: Added support for `\begin{quote} ... \end{quote}`.
  - **Visuals**: Renders as an indented <blockquote> with italic styling and inner formatting (bold, etc.) support.
  - **Bug Fix**: Removed a duplicate index increment in `enumerate` logic that was swallowing content after lists.

## [1.9.78] - 2025-12-13 (Nested List & Algorithm Fix)
### Fixed
- **Nested Lists in Algorithms (The "Empty List" Bug)**:
  - **Symptom**: `\begin{enumerate}` nested inside `\begin{algorithm}` (or invalidly inside `\item`) resulted in empty list items and literal `\end{enumerate}` text.
  - **Root Cause**: The manual `processLists` parser had a "flat" extraction loop. When it encountered a nested `\item`, it thought the parent item had ended, truncating the content passed to the recursive parser.
  - **Fix 1 (Extraction)**: Rewrote the `itemContent` loop to track `nestedListDepth`. It now ignores `\item` tags inside nested environments (`enumerate`, `itemize`, `description`), ensuring the full parent item is captured.
  - **Fix 2 (Recursion)**: Changed `processLists` to output **Inline HTML** instead of placeholders when `depth > 0`. This prevents nested placeholders, which simplified the resolution logic and avoided race conditions.
  - **Impact**: Complex nested algorithms (e.g., SGCV) now render perfectly with full indentation and numbering.

## [1.9.79] - 2025-12-13 (Quote Environment Support)
### Added
- **Quote Environment**:
  - **Feature**: Added support for `\begin{quote} ... \end{quote}`.
  - **Visuals**: Renders as an indented <blockquote> with italic styling and inner formatting (bold, etc.) support.
  - **Bug Fix**: Removed a duplicate index increment in `enumerate` logic that was swallowing content after lists.

## [1.9.77] - 2025-12-13 (Paragraph Formatting Fix)
### Changed
- **Paragraph Spacing Instead of Indentation**:
  - **Problem**: LaTeX export used traditional first-line indentation instead of line breaks between paragraphs.
  - **User Request**: Wanted paragraphs separated by line breaks, no indentation.
  - **Solution**: Added `\setlength{\parindent}{0pt}` and `\setlength{\parskip}{1em}` to LaTeX preamble in `latexGenerator.ts`.
  - **Preview Compatibility**: Already compatible - CSS uses `text-indent: 0` and `margin-bottom: 1em`.

## [1.9.76] - 2025-12-13 (BOM Prevention in LaTeX Export)
### Fixed
- **"Undefined control sequence \documentclass" Error**:
  - **Symptom**: pdflatex failed on line 1 with "Undefined control sequence" on `\documentclass`.
  - **Root Cause**: Express `res.send(string)` was adding UTF-8 BOM (Byte Order Mark: `EF BB BF`) to the file.
  - **Why BOM Breaks LaTeX**: LaTeX parsers expect the file to start with `\` (backslash), not `EF BB BF`.
  - **Solution**: Changed `server/routes.ts` export endpoint from `res.send(exportSafeLatex)` to `res.send(Buffer.from(exportSafeLatex, 'utf-8'))`.
  - **Result**: Binary-safe output without BOM, LaTeX compiles successfully.

## [1.9.75] - 2025-12-13 (Text Mode Algorithm Fix)
### Fixed
- **"Missing $ inserted" in Algorithm Blocks**:
  - **Symptom**: Line 790: `\text{Integrity}(A, C) \geq $\theta$` → "Missing $ inserted" error.
  - **Root Cause**: AI was wrapping algorithm keywords in `\text{}` (a math-mode command), but algorithm environments are already in text mode.
  - **Why It Fails**: `\text{}` requires math mode (`$...$`), creating a mode conflict.
  - **Solution**: Added regex replacements to `sanitizeLatexForExport` in `server/ai/utils.ts`:
    - Remove `\text{if}`, `\text{then}`, `\text{else}`, etc.
    - Strip `\text{}` from identifiers: `\text{Integrity}` → `Integrity`
  - **Reasoning**: Algorithm blocks are prose-like, so text doesn't need special wrapping.

## [1.9.74] - 2025-12-13 (Algorithm Command Normalization)
### Fixed
- **"Undefined control sequence \REQUIRE" Error**:
  - **Symptom**: Line 616: `\REQUIRE` → "Undefined control sequence" error.
  - **Root Cause**: AI was outputting uppercase algorithm commands (`\REQUIRE`, `\STATE`) but the `algpseudocode` package uses mixed-case (`\Require`, `\State`).
  - **Why Mixed-Case**: `algpseudocode` is the modern standard; `algorithmic` (uppercase) is legacy.
  - **Solution**: Added automatic normalization to `sanitizeLatexForExport` in `server/ai/utils.ts`:
    - `\REQUIRE` → `\Require`, `\ENSURE` → `\Ensure`, `\STATE` → `\State`
    - Plus all other uppercase variants (`\IF`, `\FOR`, `\WHILE`, etc.)
  - **Design Decision**: Normalize at export time (not generation) to preserve preview compatibility.

## [1.9.73] - 2025-12-13 (Strategist Anti-Fabrication Hardening)
### Changed
- **User Prompt Constraint Against Fabrication**:
  - **Problem**: "Empirical Validation: Hong Kong Deployments" section appeared despite system prompt forbidding fabrication.
  - **Root Cause**: System prompts are often deprioritized by LLMs; User prompts have higher attention.
  - **Solution**: Added `CRITICAL CONSTRAINT` to Phase 1 Strategist **User Prompt** in `server/ai/service.ts`:
    > "Do NOT plan 'Empirical Validation' or 'Case Studies' unless the Input Text explicitly contains raw data/metrics. If the input is theoretical, your plan MUST be theoretical."
  - **Reasoning - Dual Defense**: System prompt sets the rules, User prompt enforces them at "instruction level".
  - **LLM Behavior**: User prompts are interpreted as "current task requirements" and override general tendencies.

## [1.9.72] - 2025-12-13 (Error Logging Improvement)
### Fixed
- **Generic "AI response was not valid JSON" Error**:
  - **Problem**: User saw generic error but couldn't debug root cause.
  - **Root Cause**: OpenRouter adapter caught `extractJson` errors and swallowed the details:
    ```typescript
    catch (e: any) {
        throw new Error("AI response was not valid JSON"); // Lost e.message!
    }
    ```
  - **Solution**: Changed to `throw new Error(\`AI response was not valid JSON: ${e.message || String(e)}\`);`
  - **Result**: Revealed actual error (e.g., "402 Payment Required - insufficient credits") enabling faster diagnosis.
  - **Dev Principle**: Always propagate inner exceptions; generic errors hide debugging information.

## [1.9.71] - 2025-12-13 (JSON Parser Hardening)
### Fixed
- **"Unexpected non-whitespace character after JSON" Errors**:
  - **Symptom**: Phase 2 (Librarian) failing with `Failed to parse JSON: Unexpected non-whitespace character after JSON at position 7`.
  - **Root Cause**: `extractJson` in `server/ai/utils.ts` was accepting **JSON primitives** (e.g., `0`, `"Error"`, `true`) when AI output text like:
    - `0 papers found` → Parsed `0` (valid JSON number), then crashed on "papers".
    - `"Error": The model failed...` → Parsed `"Error"` (valid JSON string), then crashed on `:`.
  - **Why Primitives Are Dangerous**: All pipeline phases expect structured Object/Array responses. Accepting primitives allowed text responses to be misidentified as "valid JSON".
  - **Solution**: Added strict enforcement in `extractJson`:
    ```typescript
    if (start === -1) {
        throw new Error(`No JSON object or array found (expected { or [). First 50 chars: "${clean.substring(0, 50)}..."`);
    }
    ```
  - **Impact**: Now rejects responses without `{` or `[`, surfaces actual AI failures with context.
  - **Design Decision**: All AI agents MUST return Objects/Arrays per schema; primitives indicate hallucination or formatting failure.

## [1.9.70] - 2025-12-12 (Absolute Anti-Fabrication Rule)
### Changed
- **Phase 1 & 3 Anti-Fabrication Rules Strengthened**:
  - **Problem**: AI was planning sections like "Empirical Validation" and fabricating experiments to fill them.
  - **Root Cause**: Phase 1 (Strategist) planned sections requiring data that didn't exist in source.
  - **Solution - Two-Layer Defense**:
    1. **Phase 1**: Added `ABSOLUTE PRINCIPLE - NO FABRICATION EVER` with 4 sub-rules preventing planning of fabrication-prone sections.
    2. **Phase 3 Rule 7**: Made absolute: "ZERO TOLERANCE. Never invent experiments, statistics, sample sizes, p-values, case studies, user quotes, anecdotes, or stories."
  - **Key Principle**: "If source has data → Use EXACTLY AS-IS. No embellishment. No hallucination."

## [1.9.69] - 2025-12-12 (Section Headers & Bibliography Fix)
### Fixed
- **Section Headers Not Rendering** (Critical Missing Feature):
  - **Symptom**: `\subsection{Title}` appeared as literal text.
  - **Root Cause**: `\section`, `\subsection`, `\subsubsection` handlers were COMPLETELY MISSING from `parseLatexFormatting()`.
  - **Fix**: Added handlers: `\section{}` → `<h2>`, `\subsection{}` → `<h3>`, `\subsubsection{}` → `<h4>`, `\paragraph{}` → `<strong>`.

- **AI-Hallucinated Section Depths**:
  - **Symptom**: `\subsubssubsection{Title}` (invalid LaTeX) appearing as text.
  - **Root Cause**: AI invented non-existent section commands.
  - **Fix**: Added fallback `\sub+section{}` → `<h4>` to gracefully handle any depth.
  - **Prompt Fix**: Added Rule 8 to Phase 3: "VALID SECTIONING ONLY."

- **Bibliography URL Escaping Bug**:
  - **Symptom**: `\https://...` appearing with backslash in bibliography.
  - **Root Cause**: JavaScript escaping error - `\\\\url` produced `\\url` (line break + `url`) instead of `\url`.
  - **Fix**: Changed to `\\url` which correctly produces `\url{}` command.

- **Duplicate "ABSTRACT" Text**:
  - **Symptom**: "Abstract" header followed by "ABSTRACT The content..."
  - **Root Cause**: AI sometimes outputs "ABSTRACT" as first word inside abstract environment.
  - **Fix**: Strip leading `ABSTRACT` word from abstract body since header is generated automatically.

## [1.9.68] - 2025-12-12 (Common LaTeX Commands Overhaul)
### Added
- **50+ Common LaTeX Commands**: Research-based addition of frequently-used commands that were missing:
  - **Math Symbols**: `\leq`, `\geq`, `\neq`, `\pm`, `\cdot`, `\ldots`, `\dots`, `\cdots`, `\infty`
  - **Logic**: `\therefore`, `\because`, `\forall`, `\exists`
  - **Set Theory**: `\subset`, `\supset`, `\cup`, `\cap`, `\in`, `\notin`
  - **Greek Letters**: `\alpha` through `\omega`, plus `\Delta`, `\Sigma`, `\Omega`
  - **Arrows**: `\uparrow`, `\downarrow`, `\updownarrow`
  - **Spacing**: `\hspace{}`, `\vspace{}`
  - **Layout**: `\clearpage`, `\newpage`, `\noindent`, `\centering`, `\raggedright`, `\raggedleft`, `\par`

- **Dollar Sign Escaping**: Added `\$` → `$` for financial notation like `\$68,000`.

- **Algorithm Package Dual Support**:
  - **Problem**: Preview only handled `algorithmic` package (uppercase: `\STATE`), not `algpseudocode` (mixed case: `\State`).
  - **Fix**: Made all algorithm regexes case-insensitive and added: `\State`, `\Statex`, `\If`, `\EndIf`, `\For`, `\EndFor`, `\While`, `\EndWhile`, `\Return`, `\Require`, `\Ensure`, `\Comment`.

## [1.9.67] - 2025-12-12 (LaTeX Spacing Commands)
### Fixed
- **`\quad` and `\qquad` Not Rendering**:
  - **Symptom**: `\quad` appearing as literal text in algorithm blocks.
  - **Root Cause**: These spacing commands were not handled in `parseLatexFormatting()`.
  - **Fix**: Added `\quad` → `&emsp;` (1em) and `\qquad` → `&emsp;&emsp;` (2em).
  - **Universality**: These are the only two "quad" spacing commands in LaTeX.


## [1.9.66] - 2025-12-12 (Anti-Fabrication Prompt Rule)
### Changed
- **Phase 3 Critical Rule 7**: Added anti-fabrication constraint to prevent AI from inventing fake research:
  - **Rule**: `NO FABRICATED RESEARCH. Never invent experiments, statistics, sample sizes, p-values, or case studies.`
  - **Problem**: AI was generating fake experiments ("We conducted a study with n=45..."), fabricated statistics, and invented case studies.
  - **Root Cause**: Prompt said "AGGRESSIVELY ENHANCE" without explicit negative constraints. AI interpreted "enhance" as permission to invent.
  - **Solution**: Explicit negative constraint preserves theoretical writing while blocking fabrication.
  - **Reasoning**: Lesson 75 - "Positive Instructions are Dangerous." LLMs need explicit forbiddens, not just encouragements.

## [1.9.65] - 2025-12-12 (LaTeX Preview Engine Overhaul)
### Fixed
- **HTML Angle Bracket Escaping** (The "Headers Not Rendering" Bug):
  - **Symptom**: `<h2>Introduction</h2>` rendered as literal text instead of a header.
  - **Root Cause**: `parseLatexFormatting()` escaped `<` and `>` to `&lt;` and `&gt;`, destroying our own generated HTML.
  - **Fix**: Removed `<>` escaping from `parseLatexFormatting()`. The function GENERATES HTML, so escaping its output is self-defeating.
  - **Universal Impact**: Fixed all HTML tags (`<h2>`, `<h3>`, `<strong>`, `<em>`, `<code>`, etc.).

- **Algorithm Environment Parsing**:
  - **Symptom**: `Algorithm. (H) \caption{Title}` appeared as literal text.
  - **Root Cause**: `[H]` is a position specifier, not a title. `\caption{}` inside body was not extracted.
  - **Fix**: Special handling for `algorithm` environment - ignores `[H]`, extracts `\caption{}` as title, strips both from body.

- **Nested Placeholder Resolution**:
  - **Symptom**: `LATEXPREVIEWMATH99` appearing inside algorithm blocks instead of rendered math.
  - **Root Cause**: Placeholders inside other placeholders were never resolved (algorithm wrapped body before math was restored).
  - **Fix**: Added recursive placeholder resolution in `LatexPreview.tsx` - resolves placeholders inside block values before final injection.

- **Multirow Table Support** (The "Column Shift" Bug):
  - **Symptom**: `\multirow{4}{*}{\textbf{Academic}}` rendered as literal text, last column misaligned.
  - **Root Cause 1**: Simple regex couldn't handle nested braces like `\textbf{}` inside `\multirow{}`.
  - **Root Cause 2**: No rowspan state tracking - rows after multirow had phantom empty cells.
  - **Fix**: Implemented brace-counting parser + `activeRowspans` Map to track which columns have active rowspans. Subsequent rows skip empty cells covered by rowspans.
  - **Lesson**: "Parse, don't Regex" for nested LaTeX structures.

## [1.9.64] - 2025-12-12 (Markdown Header Stripping)
### Fixed
- **AI Markdown Hallucinations**:
  - **Symptom**: `# ABSTRACT` appearing as literal text in preview.
  - **Root Cause**: AI sometimes outputs Markdown headers (`# Title`, `## Section`) inside LaTeX content.
  - **Fix**: Added stripping of Markdown headers in `parseLatexFormatting()`: `.replace(/^#{1,6}\s+.*$/gm, '')`.
  - **Prompt Fix**: Added `NO MARKDOWN HEADERS` to abstract prompt and `PURE LATEX ONLY` rule to Phase 3.

## [1.9.63] - 2025-12-12 (Bibliography URL Formatting)
### Changed
- **Bibliography URL Line Break**:
  - **Before**: `Author. Title. Venue, 2024. URL: https://...`
  - **After**: `Author. Title. Venue, 2024.` (new line) `\url{https://...}`
  - **Reasoning**: Improves readability in academic papers where URLs can be long.

## [1.9.62] - 2025-12-12 (Phase 4 Web Search Integration)
### Changed
- **Peer Reviewer Web Search**: The Phase 4 Peer Reviewer now actively uses web search for fact-checking claims.
  - **Prompt Upgrade**: Updated system prompt to explicitly instruct the model to "USE WEB SEARCH to verify claims against current literature."
  - **Capabilities**: The Peer Reviewer now verifies claims via live web search, checks novelty against recent publications, and cites URLs/paper titles when possible.
  - **Architecture**: Phase 4 uses `this.librarian` (already implemented), which is now connected to search-capable custom bots.
  - **Reasoning**: A "Peer Reviewer" should not just review existing references but actively fact-check claims against the current state of the field.


## [1.9.61] - 2025-12-12 (JSON Parser Hardening for Flash Models)
### Fixed
- **Unwrapped JSON Properties (The "Flash Model" Bug)**:
  - **Symptom**: `Gemini25Flash-APP` outputs `"found": false` instead of `{ "found": false }`, causing `Failed to parse JSON: Unexpected non-whitespace character after JSON at position 7`.
  - **Root Cause**: Flash models sometimes ignore JSON object wrapper instructions, outputting bare key-value pairs.
  - **Fix**: Enhanced `extractJson()` in `server/ai/utils.ts` to detect this pattern and auto-wrap in `{}`:
    ```typescript
    if (/^\s*"[^"]+"\s*:/.test(clean)) {
        return JSON.parse(`{${clean}}`);
    }
    ```
  - **Reasoning**: This is a pragmatic "bandaid" for unpredictable LLM behavior. The proper fix is using smarter models, but defensive parsing is standard practice in production LLM applications.

## [1.9.60] - 2025-12-12 (Custom Poe Bots for Librarian)
### Changed
- **Custom Bot Integration**:
  - **Librarian**: Now uses custom Poe bots instead of vanilla Gemini models.
  - **Available Bots**:
    - `Gemini25Pro-AAP`: High-reasoning, web search-capable (Recommended for research).
    - `Gemini25Flash-APP`: Faster, cheaper, but less reliable JSON formatting.
  - **UI Update**: `ConfigPage.tsx` now shows "Gemini 2.5 Pro (Custom Bot)" and "Gemini 2.5 Flash (Custom Bot)" in the Librarian dropdown.
  - **Default**: Set to `Gemini25Pro-AAP` in `schema.ts` and `routes.ts` fallback.
  - **Reasoning**: Custom bots have web search pre-configured, eliminating reliance on the flaky `parameters.web_search` injection.

### Fixed
- **Bot Name Typo**: Fixed `Gemini25Flash-AAP` → `Gemini25Flash-APP` (the actual bot name on Poe).


### Added
- **System Hardening (Robustness)**:
    - **Timeouts**: Increased global AI timeout to **3 minutes** (180s) to prevent premature termination of deep research tasks.
    - **Retries**: Implemented **3x Retry Logic** (`p-retry`) for all critical AI calls (Search, Content Generation), protecting against transient API failures.
    - **Progress**: Added **Granular Streaming Feedback** (Word Counts) to give users real-time visibility into the drafting process.

### Changed
- **URL Handling (The "Plain Text" Protocol)**:
    - **Extraction**: The Librarian (Phase 2) now explicitly extracts Source URLs.
    - **Rendering**: URLs appear **ONLY** in the Bibliography (`\begin{thebibliography}`).
    - **Format**: URLs are rendered as **Plain Text** (Monospace `<code>`), strictly on a **New Line** (`\\ \url{...}`). Clickable links are intentionally disabled to preserve academic neutrality and prevented visual pollution.
- **Resource Limits (Standard vs Advanced)**:
    - **Search Queries**: Limited to 15 (Standard) or 50 (Advanced).
    - **Enhancements**: Limited to 20 (Standard) or Unlimited (Advanced).
    - **Reasoning**: Prevents token explosions on lower tiers while allowing deep research for power users.

## [1.9.55] - 2025-12-11 (UX & Terminology Polish)
### Fixed
- **Streaming Feedback (Complexity Reduction)**:
    - **Problem**: Users felt "loops" were infinite because status messages were too long and technical.
    - **Fix**: Shortened status messages (`[Drafting] Section (~500 w)...`) and made the count visible.
    - **Scope**: Expanded to Phase 4 (Deep Review) and Phase 6 (Editor).
- **Terminology Polish (Professionalization)**:
    - **Change**: Replaced specific internal terms with academic equivalents.
        - "Surgical Patching" -> **"Evidence Integration"**
        - "Generating patches" -> **"Synthesizing revisions"**
    - **Reasoning**: The "Editor" persona requires professional, academic language, not software dev slang.

## [1.9.49] - 2025-12-11 (Surgical Editing Prompts)
### Changed
- **Phase 5 (The Rewriter) - Surgical Protocol**:
    - **Problem**: The Rewriter was acting as a "Global Optimizer", condensing and rewriting unflagged sentences in the name of "academic rigor", leading to data loss and aggressive shortening.
    - **Fix**: Implemented "Surgical Editing Protocol" in System and User prompts.
    - **Logic**: Explicitly defines `WHAT TO MODIFY` (Supported Claims, Unverified Claims, Critique) vs `WHAT TO PRESERVE` (Everything else).
    - **Impact**: The AI now acts as a precise copyeditor, touching only the specific sentences identified by the Peer Reviewer.

## [1.9.48] - 2025-12-10 (Grayscale Mandate)
### Changed
- **AI Prompts (Phase 3 & 5)**: Explicitly banned use of colors (`\color`, `\textcolor`, `fill=red!60`) in Diagrams and Text.
    - **Instruction**: "Academic papers are printed in black & white. Use grayscale (black!10, gray!50), patterns (dotted, dashed), or thick lines for contrast."
    - **Reasoning**: Ensures generated PDFs are print-ready and follow academic standards.

### Fixed
- **List Artifacts**: Fixed `itemize` and `description` environments leaking optional arguments (e.g., `[noitemsep]`) into the rendered text.
- **Table Cell Alignment**: Enforced `text-align: left !important` for all table cell content (including lists), overriding global justification rules to prevent weird spacing in narrow columns.

## [1.9.46] - 2025-12-10 (Vertical Compression for Modernized Layouts)
### Fixed
- **TikZ Y-Scaling (Compression)**:
    - **Problem**: "Hyper Boost Taming" (v1.9.45) fixed the override but left vertical spacing too large (3cm edge-to-edge due to `below=of` modernizer vs `below of` center-to-center intent).
    - **Fix**: Reintroduced `y=0.5` compression for relative layouts even if explicit `node distance` is present. This counteracts the expansion caused by "Edge-to-Edge" modernization.
    - **Result**: Vertical flowcharts are now tightly packed (approx 1.5cm net gap for 3cm user input), matching the visual expectations of "Center-to-Center" layouts.

## [1.9.45] - 2025-12-10 (Hyper Boost Taming)
### Fixed
- **TikZ Y-Scaling (Hyper Boost Taming)**:
    - **Problem**: Vertical flowcharts with explicit `node distance` (e.g., 3cm) were being aggressively overridden to 8.4cm or squashed with `y=0.5`.
    - **Fix**: Relaxed override threshold from 8.4cm to 2.8cm (respecting 3cm inputs) and fixed `yUnit` logic to preserve user's unit vector (1.0) instead of squashing (0.5) when explicit distance is present.
    - **Result**: Diagrams respect user's vertical spacing while still optimizing density for unlabeled/messy inputs.

## [1.9.44] - 2025-12-10 (Context-Aware Stabilization)
### Fixed
- **TikZ Arrow Sanitization**:
    - **Problem**: AI generates arrows (`\rightarrow`) in text-mode TikZ nodes, causing `! Missing $ inserted` crashes.
    - **Fix**: Implemented auto-wrapping of arrows in `\ensuremath{...}` within `tikz-engine.ts`.
    - **Result**: Arrows render correctly in both text and math modes.
- **Table \n Stripping**:
    - **Problem**: AI leaks literal `\n` sequences into tables (e.g., `\\\n\hline`), breaking rendering.
    - **Fix**: Added heuristic in `healer.ts` to strip these sequences.
- **Prompt Hardening ($ Escape)**: Added `\\$` rule to AI prompts to prevent invalid pricing tables.
- **Macro Preservation**: `processor.ts` now extracts preamble macros to support simple math variables.

## [1.9.37] - 2025-12-10 (Stabilization & Prompt Hardening)
### Fixed
- **TikZ Syntax (Deprecated Syntax Normalization)**:
    - **Problem**: AI models generate deprecated `right of=` syntax, which ignores node widths and causes overlaps.
    - **Fix**: Implemented Regex Normalizer in `tikz-engine.ts` to convert `right of=` -> `right=of ` (modern syntax) before rendering.
    - **Result**: Diagrams respect node widths and spacing correctly.
- **Universal Prompt Hardening**:
    - **Problem**: "Ghost Content" (labels like `SECTION NAME:`) and Table Crashes (unescaped `&`) were persisting despite regex fixes.
    - **Fix**: Updated System Prompts (Phase 3 & 5) with strict contracts: "NO LABELS" and "ESCAPE SPECIAL CHARACTERS".
    - **Impact**: Solves the root cause of hallucinated labels and table layout breaks.
- **Paragraph Rendering**:
    - **Problem**: `\par` commands rendered as raw text.
    - **Fix**: Pre-converted `\par` to `\n\n` in `LatexPreview.tsx`, enabling correct paragraph splitting.

## [1.9.30] - 2025-12-10 (The "Safe Modular Extraction" Refactor)
### Refactored
- **Monolith Decomposition**: Split `LatexPreview.tsx` (3000+ lines) into the `latex-unifier` library.
    - **`processor.ts`**: Main orchestrator.
    - **`healer.ts`**: Pre-processing and sanitation.
    - **`tikz-engine.ts`**: TikZ isolation and rendering.
    - **`math-engine.ts`**: Math extraction and KaTeX rendering.
    - **`citation-engine.ts`**: Bibliography and citation handling.
    - **`table-engine.ts`**: Complex table parsing.
- **Methodology**: Applied "Safe Extraction" (Copy-Paste -> Verify -> Integrate) to ensure zero regressions.
- **Verification**: Added `processor.test.ts` to verify lists/algorithms, complementing the existing engine test suite.
- **Impact**: `LatexPreview.tsx` reduced to <150 lines, focused purely on React lifecycle and DOM injection.

## [1.9.28] - 2025-12-10 (Documentation: The 60KB -> 4KB Refactor)
### Added
- **Architecture Documentation**: Added "The Great Refactor" section to `LATEX_PREVIEW_SYSTEM.md`, visualizing the massive simplification of `LatexPreview.tsx`.
- **Lessons Learned**: Added Lesson 55 ("The Component Diet") detailing why moving logic out of UI components is critical for maintainability.

## [1.9.18] - 2025-12-10 (Intent Engine Refinement)
### Improved
- **TikZ "Crowded Flat" Handling**:
  - **Symptom**: Timeline diagrams with many nodes (>7) had text overlaps due to insufficient horizontal spacing (default 1.5x).
  - **Fix**: Implemented "Crowded Heuristic" in Intent Engine. If `nodes > 7`, layout switches to "Aggressive Expansion" mode (`xMultiplier = 2.3`), boosting spacing from ~5.25cm to ~8.05cm.
  - **Philosophy**: "Best Estimate" layout based on node count proxy.

## [1.9.19] - 2025-12-10 (Intent Engine Threshold Patch)
### Fixed
- **TikZ FLAT Detection Edge Case (Ratio 3.0)**:
  - **Symptom**: Diagrams with exactly 3:1 aspect ratio (e.g., 15x5) were falling through `isFlat > 3.0` check and being classified as `LARGE`, which uses tighter spacing.
  - **Fix**: Relaxed threshold to `isFlat >= 3.0`. This correctly captures standard timeline layouts into the FLAT engine, leveraging the new "Crowded" expansion logic.

## [1.9.20] - 2025-12-10 (Legibility Tuning)
## [1.9.23] - 2025-12-10 (Missing Intent Implementation)
### Added
- **WIDE Intent Logic**:
  - **Symptom**: Diagrams with `horizontalSpan > 14` were defaulting to `LARGE` because `WIDE` logic was documented but code was missing/merged.
  - **Fix**: Implemented distinct `WIDE` intent for non-FLAT wide diagrams.
  - **Logic**: `scale = (14 / span) * 0.9` (clamped 0.5 - 1.0). Includes `transform shape`.
  - **Goal**: Ensure massive 2D diagrams shrink to fit A4 page width.

## [1.9.24] - 2025-12-10 (Crucial Crash Fix)
### Fixed
- **"The Killer Percent" Bug**:
  - **Symptom**: Diagrams containing percentages (e.g., `100\%`) crashed the Preview with "Undefined control sequence".
  - **Root Cause**: The comment stripping regex `/%.*$/gm` blindly deleted everything after the `%`, including the backslash and the closing braces of the node.
  - **Fix**: Updated regex to `/(?<!\\)%.*$/gm` (Negative Lookbehind) to only remove *unescaped* comments.

## [1.9.25] - 2025-12-10 (Robustness Patch)
### Fixed
- **TikZ Comment Stripping V2**:
  - **Regression**: The negative lookbehind regex fix (v1.9.24) failed in some environments or contexts vs `100\%`.
  - **Fix**: Switched to **Token Replacement Strategy**. Replace `\%` -> `__PCT__`, Strip Comments, Restore `__PCT__` -> `\%`. 100% reliable.
- **Table Row Break Glitch**:
  - **Symptom**: Tables containing `\\&` (e.g., `Fear \\& Greed`) were breaking rows prematurely.
  - **Fix**: Added pre-processing step in Table Parser to normalize `\\&` -> `\&` before splitting rows.

## [1.9.26] - 2025-12-10 (Global Robustness)
### Fixed
- **Global Table Fix ("Nuclear Option")**:
  - **Issue**: Previous table fix was only in the HTML parser, but the system often runs `jsTeX` (PDF engine).
  - **Fix**: Moved the `\\&` -> `\&` replacement to `sanitizeLatexForBrowser` in `LatexPreview.tsx`. It now runs **globally** before *any* parser (HTML or PDF) sees the code.
  - **Result**: Tables with escaped ampersands work everywhere.
- **TikZ Leaks**:
  - **Refinement**: Reinforced the TikZ extraction regex to ensuring diagrams are pulled out before `jsTeX` runs, preventing `jsTeX` crashes on `100\%`.

## [1.9.27] - 2025-12-10 (Universal Text Formatting - ROOT FIX)
### Fixed
- **Text Formatting Pipeline**:
  - **Root Cause**: Paragraph text was bypassing `parseLatexFormatting()` entirely, being rendered as raw text nodes in the DOM walker (line 1661).
  - **Result**: LaTeX notation like `{,}`, `\textbf{}`, `\&`, etc. appeared literally in paragraphs, even though fixes existed in the formatting function.
  - **Fix**: Modified the DOM walker to call `parseLatexFormatting()` on ALL text before creating nodes.
  - **Impact**: UNIVERSAL. All text now receives consistent formatting - thousand separators, bold/italic, special characters, etc.

## [1.9.22] - 2025-12-10 (The Override Patch)
### Fixed
- **Crowded Timeline Font Override**:
  - **Symptom**: The v1.9.21 `font=\large` injection had no effect because it was prepended to the user's `font=\small` option, which took precedence in TikZ (last wins).
  - **Fix**: Explicitly **stripped** the `font=...` option from the user's input string before injecting `font=\Large`.
  - **Update**: Upgraded to `\Large` (Capital L) to better survive the 0.45x browser scaling.

## [1.9.36] - 2025-12-10 (The Math Layout Finalization)
### Fixed
-   **Universal Math Scaling (The "Array" Fix)**:
    -   **Problem**: Wide `array` tables were being clipped or shrunk to unreadable sizes.
    -   **Fix**: Implemented **Intelligent Array Scaling v2**.
        -   **Detection**: Now actively targets `\begin{array}` blocks.
        -   **Heuristic**: `(TotalChars / Rows) * 0.5`. This realistically estimates row width for text-heavy tables.
        -   **Bounds**: Threshold increased to **39em** (Full A4 Width). Scale floor set to **0.65x**.
    -   **Result**: Tables are "Fit-to-Page" without becoming microscopic.
-   **Math Spacing (The "Margin Collapse" Fix)**:
    -   **Problem**: Excessive whitespace above/below equations.
    -   **Fix 1**: Reduced global CSS margins (1.5em -> 0.5em) and padding.
    -   **Fix 2**: Switched auto-scale wrapper to `display: block`. This restores **CSS Margin Collapsing**, merging the paragraph's bottom margin with the equation's top margin (1em + 0.5em -> 1em) instead of stacking them (1.5em).
-   **Clipping**:
    -   **Fix**: Switched from `overflow: hidden` to `visible` + `width: max-content` on the wrapper. This ensures the browser calculates the layout based on the full unscaled width, preventing cut-off columns.
-   **Universal Code Styling (The "Enclosure" Fix)**:
    -   **Problem**: Code blocks (`lstlisting`) looked raw and didn't match the Algorithm styling.
    -   **Fix**: Implemented **Unified Code Blocks**.
        -   Mapped `\begin{lstlisting}` (and `verbatim`) to the `.latex-verbatim` class.
        -   Added CSS to `.latex-verbatim` to match Algorithm blocks (Gray background, border).
        -   **Universal Parser**: `(?:\[[^\]]*\])?` regex handles arbitrary options (e.g., `[language=Python]`), ensuring robust extraction for any code block.
-   **Preamble Stripper (The "Anti-Crash" Fix)**:
    -   **Problem**: `\usepackage[...sort&compress...]` caused the regex parser to choke on the `&` character, resulting in a blank render.
    -   **Fix**: Implemented aggressive stripping of `\documentclass` and `\usepackage` in `processor.ts`. This prevents 100% of Preamble-related crashes.
-   **Typography Sanitization (The "Thousand Separator" Fix)**:
    -   **Problem**: `105{,}000` rendered literally because HTML doesn't understand LaTeX grouping braces.
    -   **Fix**: Added global replacement layer `/{,}/g` -> `,` in `LatexPreview.tsx` (Global Scope). Handles all occurrences in valid text.
-   **Table Engine (Hallucination Sanitizer)**:
    -   **Problem**: AI output `Sentiment (Fear \\& Greed)` (Double Escape) caused the table parser to see `\\` (Row Break) followed by `&`. This broke the table layout.
    -   **Fix**: Added a pre-sanitizer in `table-engine.ts` that reverts `\\\\&` to `\\&` inside the table body before splitting rows. This preserves row integrity against bad escapes.
-   **TikZ Engine (Percent Stripping Fix)**:
    -   **Problem**: `100\%` in TikZ nodes was being truncated by the comment stripper `/.replace(/%.*$/gm, '')/`, causing "Undefined control sequence" errors.
    -   **Fix**: Implemented the "Token Replacement Strategy" (documented in v1.9.25 but missing from code). Protected `\%` as tokens before stripping comments.
-   **Ghost Content Exorcism**:
    -   **Problem**: AI was leaking "SECTION NAME:" and "CONTENT:" labels into the final LaTeX, and `\par` commands were rendering as raw text.
    -   **Fix 1 (Sanitization)**: Added regex strippers in `latexGenerator.ts` to remove prompt residue.
    -   **Fix 2 (Rendering)**: Updated `LatexPreview.tsx` to convert `\par` to `\n\n` (double newline), allowing the paragraph splitter to correctly wrap text in `<p>` tags.
    -   **Fix 3 (Deep Logic - Universal)**: Hardened AI Prompts in `service.ts` (Phase 3 & 5) with "ESCAPE SPECIAL CHARACTERS" and "NO LABELS" rules, preventing the root cause of ghost content and table crashes (unescaped `&`).
### Fixed
- **Dev Server Instability ("Exit 1")**:
  - **Symptom**: The backend server would crash (`exit 1`) whenever a frontend syntax error (e.g., in CSS or TSX) occurred.
  - **Root Cause**: `server/vite.ts` contained a "Hard Exit" in its custom logger: `process.exit(1)` on *any* error intercepted from Vite. This meant a single typo in the client code killed the entire dev environment.
  - **Fix**: Removed `process.exit(1)`. The server now logs the error but stays alive, allowing hot-reloading to fix the typo.
  - **Impact**: Massive improvement in Developer Experience (DX) and system uptime.

## [1.9.16] - 2025-12-09 (The TikZ & Visual Fixes)
### Fixed
- **TikZ Option Merging ("The Double Bracket" Bug)**:
  - **Root Cause**: The option extractor strips brackets (e.g., `[x=1cm]` -> `x=1cm`), but the merge logic blindly prepended overrides (e.g., `x=1.5cm,` + `x=1cm`). This produced invalid TikZ syntax `x=1.5cm, x=1cm` without enclosing brackets, simply injecting raw text into the stream.
  - **Fix Refactored Logic**: The merger now explicitly wraps combined options in `[...]`, ensuring valid syntax like `[x=1.5cm, x=1cm]`.
  - **Result**: Immediate visual updates for all scaling parameters.
- **TikZ Vertical Layout**:
  - **Fix**: Reduced iframe `min-height` from `200px` to `100px` to eliminate massive whitespace below timeline diagrams.
  - **Fix**: Reverted `scale` to `1.0` (from debug values) while retaining the `FLAT` intent multipliers (`x=1.5`, `y=2.0`), restoring the intended aspect ratio.
- **Deployment/Caching**:
  - **Issue**: `npm run dev` servers often serve stale cached bundles.
  - **Fix**: Verified process requires full server restart and hard refresh to confirm visual changes.

## [1.9.15] - 2025-12-09 (The "Algorithm & Layout" Update)
### Added
- **Algorithmic Environment Support**:
    - **Feature**: Full parsing for `\begin{algorithmic}` blocks (States, loops, conditionals).
    - **Styling**: `Courier New`, gray line numbers, and bold keywords (`if`, `then`, `for`).
    - **Logic**: Implemented `processAlgorithms` with smart indentation handling.
- **Center Environment Support**:
    - **Feature**: Added universal support for `\begin{center}` ... `\end{center}`.
    - **Fix**: Resolves "orphaned tags" around tables and figures.

### Fixed
- **Exposed HTML Tags in Algorithms**:
    - **Root Cause**: `parseLatexFormatting` was "double-escaping" injected HTML.
    - **Fix**: Inverted pipeline to format content *before* injecting structural HTML keywords.
- **Subsubsection Styling**:
    - **Fix**: Changed `\subsubsection` (h4) from Italic/Normal to **Bold/Normal** to match standard LaTeX `article` class.

## [1.9.14] - 2025-12-09 (The "Ghost Class" Fix)
### Fixed
- **Persistent Math Scrollbars**:
    - **Symptom**: Vertical scrollbars appeared on equation numbers (e.g., `(2)`).
    - **Root Cause**: Targeted a non-existent CSS class (`.equation-container`) instead of the actual KaTeX output (`.katex-display`). The browser's default overflow handling for the inner element caused sub-pixel scrolling.
    - **Fix**: Targeted `.katex-display` directly with `overflow: hidden !important` and `scrollbar-width: none`.

## [1.9.13] - 2025-12-09 (The "Bulletproof" Robustness Update)
### Fixed (Universal Math & Layout)
- **Missing Link in List Rendering (The "String Injection" Strategy)**:
    - **Symptom**: `LATEXPREVIEWMATH47` placeholders appeared in lists instead of rendered math.
    - **Root Cause**: The post-render DOM `TreeWalker` failed to traverse deeply nested list items created by `innerHTML`.
    - **Fix**: Implemented **String-Level Replacement** (`html.replace`) *before* DOM injection. This guarantees placeholders are restored regardless of nesting depth.
- **Missing List Bullets (The "Specificity" Fix)**:
    - **Symptom**: `itemize` and `enumerate` lists had no bullets/numbers.
    - **Root Cause**: `latex-base.css` contained a hard reset `li { list-style: none }` which beat inherited styles from `ul`.
    - **Fix**: Updated `latex-article.css` to target `.latex-itemize li` directly with `!important`, overriding the base reset.
- **"The Theta Problem" (Math Normalization)**:
    - **Symptom**: AI output `$\theta$_t` (subscript outside formatting) causing rendering errors.
    - **Fix**: Added `Normalizer` regex to pre-process and repair orphaned subscripts/superscripts (`$_x` -> `_x`) before extraction.
- **Fragmented Equations (The "Healer")**:
    - **Symptom**: `$A$ = $B$` (operators outside math mode).
    - **Fix**: Added "Math Healer" to merge adjacent math blocks separated by standard operators.
- **Text Mode Arrows**:
    - **Symptom**: `\rightarrow` rendered as code in text mode.
    - **Fix**: Added explicit HTML entity replacements (`&rarr;`, `&rArr;`, etc.) to the text parser.

## [1.9.6] - 2025-12-09 (Layout Robustness: Headers, TikZ, Tables)
### Fixed
- **Section Headers ("Introduction")**: Corrected Semantic HTML/CSS mismatch.
    - Updated CSS to style `h2` as Section (previously expected `h3`).
    - Updated Regex to `[\s\S]*?` to support newlines in titles.
- **Blank TikZ Diagrams**:
    - **Comment Stripping**: Regex `safeTikz.replace(/%.*$/gm, '')` prevents comments from killing flattened code.
    - **Library Injection**: Added `arrows, shapes, calc` to script block.
    - **Crash Prevention**: Stripped `\sffamily` and sanitized `itemize`/`[leftmargin=*]` to `$\bullet$`.
    - **Visibility**: Added `min-height: 200px` to iframe.
- **Table Layout**:
    - **Width**: Forced to `100%` (was `auto`) to prevent text wrapping.
    - **Data Sanitation**: Added regex to escape specific AI typos (`Built-in & Comprehensive` -> `\&`).
- **Citation Rendering**:
    - **ID Logic**: Enforced "ID Match" mode. `ref_5` -> `[5]` instead of sequential `[1]`.

## [1.8.2] - 2025-12-09 (Intent Engine Restoration & CSS Corruption Fix)
### Fixed
- **CSS Class Name Corruption**: Template literals with spaces in class names broke all styling.
  - **Symptom**: Preview rendered as plain text with no formatting (no title styling, no sections).
  - **Root Cause**: Previous edits introduced spaces in class names: `latex - preview` instead of `latex-preview`.
  - **Affected Areas**: Dynamic style injection (lines 916-923) and JSX className attributes (lines 1194, 1206).
  - **Fix**: Corrected all instances to use proper hyphenated class names.
  - **The Lesson**: **Don't Style Ghosts.** Never write a CSS rule without verifying the class name in the Inspector first. A rule that targets nothing fixes nothing.


## [1.6.42] - 2025-12-10 (China-Friendly Settings Upgrade)
### Fixed
- **TikZ Font 404s**: TikZ diagrams had invisible text ("nullfont" error) because `tikzjax.com` was blocked/slow in China.
  - **Correction**: Switched font CDN to **jsDelivr** using the `node-tikzjax` package (which has correct file structure).
  - **URL**: `https://cdn.jsdelivr.net/npm/node-tikzjax@latest/css/fonts.css`.
- **TikZ Log Spam (The "Silence Protocol")**:
  - **Symptom**: Console was flooded with thousands of `jsTeX` logs ("Missing character", "This is jsTeX").
  - **Correction**: Injected a console interceptor script into the iframe that filters out all `jsTeX`-related noise.
  - **Result**: Clean console, with a single transparency notice on startup.

## [1.6.43] - 2025-12-09 (SSOT Alignment & Indentation Fix)
### Fixed
- **Phantom Indentation**: All paragraphs were forcibly indented by 1.5em due to a global CSS variable.
  - **Correction**: Set `--parindent: 0` in `latex-base.css`.
  - **Impact**: Restores modern, clean paragraph alignment.
- **Parbox Crash**: Regex-based parsing failed on nested braces within `\parbox`.
  - **Correction**: Implemented **Manual Character Walker/Parser** (`processParboxes`).
  - **Impact**: Correctly handles complex, nested LaTeX commands inside parboxes.
- **Math Extraction Gaps**: `\( ... \)` inline math was not extracted, causing render glitches.
  - **Correction**: Added standard inline math extraction and enforced strict SSOT order (Structured -> Display -> Inline -> Legacy).

### Added
- **SSOT Enforcement**: `LatexPreview.tsx` is now 100% aligned with `LATEX_PREVIEW_SYSTEM.md`.

### Added
- **Full TikZ Intent Engine Restoration**: Restored the complete 450-line Intent Engine (`createTikzBlock`) with all v1.5.x-v1.6.40 fixes.
  - **Contents**:
    - pgfplots rejection
    - ASCII sanitization (btoa fix)
    - Bezier brace polyfill (v1.6.21)
    - Coordinate parsing (v1.5.6-v1.5.7)
    - Intent classification (WIDE/FLAT/COMPACT/LARGE/MEDIUM)
    - Adaptive Y-scaling (v1.6.31/v1.6.40)
    - Bifurcated safety net (v1.6.37)
    - Goldilocks protocol
  - **Reasoning**: Intent Engine was accidentally removed during previous architecture changes.
- **v1.6.41 FLAT Intent Font Reduction**: Added `font=\small` for FLAT diagrams with ≥5 nodes.
  - **Problem**: FLAT diagrams with `minimum width` nodes had text overflow because x/y multipliers don't shrink text.
  - **Solution**: Inject `font=\small` when `nodeMatches.length >= 5` to fit labels within fixed-width boxes.

## [1.8.1] - 2025-12-08 (The Custom Parser)
### Architecture Change
- **Removed `latex.js` Dependency**: Completely removed the fragile `latex.js` library.
  - **Reasoning**: It was the single point of failure (crashes on unknown macros, no tabularx support, no TikZ support, difficult error handling). The "Containment" strategy was costing more effort than a replacement.
- **Implemented Custom Parser (`processor.ts`)**: Built a robust, fault-tolerant TypeScript parser.
  - **Philosophy**: "Show Something." Never crash. If a command is unknown, strip it or show a placeholder, but render the rest of the document.
- **Future Development Plan**: Archived the "Iterative Long-Form Generation" strategy (The Architect/Mason/Artist pipeline) to `docs/future_development_plan.md`.
  - **Reasoning**: Feature deferred, but the detailed architectural planning (including "Full Context Propagation" findings) is valuable and preserved.

### Changed
- **Unified Result View**: Renamed `SplitPreview` component to `UnifiedResultView` to reflect the removal of side-by-side mode.
  - **Impact**: Purely semantic refactor for codebase clarity.
- **UI Header Consolidation**: Merged redundant "Document Editor" headers in the Result Page.
  - **Metric**: Reduced vertical header usage by ~50px.
  - **Action**: Consolidated "Original | LaTeX" toggle and "Copy/Preview" controls into a single top-level toolbar.
  - **Removal**: Deleted the "Document Editor" label as per user feedback ("It is not an editor").

## [1.7.4] - 2025-12-08 (Persistence Investigation)
### Investigated
- **Database Persistence**: Confirmed that `advancedOptions` (like `reviewDepth` and the proposed `generationMode`) are ephemeral and **not persisted** in the `conversion_jobs` table.
- **Decision**: No database schema changes will be made for future flags. We accept the limitation that manual API retries lose these flags in exchange for **Zero DB Risk** (No Migrations).

## [1.7.3] - 2025-12-08 (Sophisticated Terminology)
### Changed
- **Processing Page Labels**: User rejected "abstract" labels ("Drafting", "Research").
  - **New Terminology**: Implemented "Sophisticated Active Verbs" to reflect technical depth:
    1. Formulating Execution Strategy
    2. Conducting Online Research
    3. Synthesizing Core Arguments
    4. Executing AI Peer Review
    5. Verify and Injecting Citations
    6. Compiling LaTeX Source
  - **Reasoning**: The UI must communicate the *complexity* of the work, not just the status. Simple nouns felt "uninspiring".

## [1.7.2] - 2025-12-08 (Progress Logic Alignment)
### Fixed
- **Stuck Progress Bar**: The progress indicator was stuck at "Phase 1" despite logs showing advanced activity.
  - **Root Cause**: **Frontend-Backend State Desynchronization**. The frontend regex was listening for the old 5-Phase signal (`[Phase X/5]`), but the backend `service.ts` had been upgraded to a 6-Phase pipeline (`[Phase X/6]`).
  - **Correction**: Updated `ProcessingPage.tsx` regex to match `Page X/6` and specific role keywords (`[Thinker]`, `[Librarian]`).
  - **Lesson**: When refactoring backend pipelines, *always* audit the frontend listeners.

## [1.7.1] - 2025-12-08 (Aggressive Typography & Layout Refinement)
### Changed
- **Wide-Format Dashboard**: Processing Page felt "cramped" and "tall".
  - **Correction**: Increased container width from `max-w-4xl` to **`max-w-6xl`**.
  - **Geometric Integrity**: Enforced `aspect-square` on step indicators to prevent "vertical rectangle" distortion.
- **Aggressive Typography Upgrade ("125% Scale")**: Replaced the "Global 115% Hack" with a native component-level redesign.
  - **Problem**: "Tiny UI" was unreadable. Global CSS zoom (`html { font-size: 115% }`) was rejected as a "dirty patch".
  - **Solution**: Manually shifted all typography codes up by 2 steps.
    - **Baseline**: `text-lg` (18px) is the new minimum for inputs/buttons.
    - **Hero**: `text-8xl` (96px) for commanding presence.
    - **Impact**: Achieves "Ctrl-+ twice" impact natively without browser zoom side-effects.
- **Upload Zone "Squashed" Dimensions**: Recalibrated the center interaction area.
  - **Metric**: `min-h-[360px]` → `min-h-[240px]` (height reduction).
  - **Metric**: `max-w-4xl` → `max-w-3xl` (width reduction).
  - **Reasoning**: The aggressive fonts made the container feel "too vast". Squashing it balances the visual weight of the large text.
- **Layout Unification**: Removed the separator between Upload Zone and Features.
  - **Metric**: Removed `border-t`, reduced padding `pt-10` → `pt-4`.
  - **Result**: A cohesive single-view experience without artificial dividers.

### Fixed
- **Responsive Header Logo**: Restored functionality to abbreviate "Auto Academic Paper" to "AAP" on mobile.
  - **Implementation**: `md:hidden` utility classes (no JS).
- **Hero Alignment**: Fixed "Leaning Left" visual bug by enforcing `flex-col items-center` on the Hero container.

## [1.7.0] - 2025-12-08 (Responsive AI Configuration)
### Added
- **Responsive AI Configuration Page**: Converted the AI Config modal to a dedicated `/config` page route.
  - **Problem**: Modal dialogs are not mobile-friendly.
  - **Solution**: Full-page design with accordion-style sections.
- **"Same as Writer" Toggle**: Added switch in Strategist section to copy Writer's settings.
### Removed
- **AIConfigModal Usage**: Replaced with `/config` navigation.

## [1.6.26] - 2025-12-08
### Fixed
- **TikZ Brace Polyfill (Vertical Artifacts)**: The manual brace polyfill (v1.6.21) assumed all braces were horizontal, applying Y-axis offsets. Vertical braces were rendered as straight lines or distorted loops (the "Vertical Line" artifact).
  - **Correction**: Implemented **Orientation Detection** (`dy > dx`).
    - **Vertical Braces**: Apply offsets to X-axis (creating curvature). Default direction points Left (-X).
    - **Horizontal Braces**: Apply offsets to Y-axis (creating curvature). Default direction points Up (+Y).
  - **Impact**: Vertical braces now curve correctly away from the content, eliminating the "straight line" visual bug and reducing perceived overlap.

## [1.6.40] - 2025-12-08 (Compact Layout Tuning)
### Fixed
- **TikZ Excessive Empty Space**: The Adaptive Y-Scaling (v1.6.31) targeted a 12cm physical height, which was too aggressive for naturally compact diagrams.
  - **Correction**: Reduced target height from **12cm → 8cm** and lowered Y-clamp range from **[1.3, 2.2] → [1.0, 1.8]**.
  - **Reasoning**: Diagrams with moderate vertical span (e.g., 5-6 units) were being stretched 2x when they only needed 1.3x.
  - **Impact**: ~30% reduction in vertical empty space for compact diagrams while maintaining readability.

## [1.6.39] - 2025-12-08 (X/Y Injection Restoration)
### Fixed
- **TikZ "Tiny Diagram" Regression**: The v1.6.38 edit accidentally removed the critical line that injects calculated `x=...cm, y=...cm` values into the TikZ options for LARGE intent diagrams.
  - **Symptom**: All LARGE intent diagrams (Pipelines, Cycles, Wide) rendered at native TikZ scale (1cm=1cm), then got shrunk by "Zoom-to-Fit" to appear "tiny".
  - **Correction**: Restored the `extraOpts += `, x=\${xUnit}cm, y=\${yUnit}cm\`` injection line.
  - **Impact**: Re-enables Adaptive Density Optimization for all absolute-layout diagrams.

## [1.6.38] - 2025-12-08 (Title Gap Restoration)
### Fixed
- **TikZ Title Gap Explosion**: Adaptive Y-Scaling (v1.6.31) universally applied `y=1.5cm` (or calculated value) to LARGE intent, including Relative Layouts. This caused absolute title offsets (e.g., `+(0,2)`) to scale physically to `3cm`, creating a massive gap between title and content.
  - **Correction**: Restored **Title Gap Compression** (v1.6.12 Logic).
  - **Logic**: If `verticalSpan === 0` (Relative Layout), we force `y=0.5cm`.
  - **Impact**: Titles anchored with absolute offsets (e.g., `+(0,2)`) now sit tightly (`1cm`) above the diagram, while the nodes themselves use the spacious `node distance=8.4cm` (from v1.6.37).

## [1.6.37] - 2025-12-08 (Bifurcated Safety Net)
### Fixed
- **TikZ Cycle Diagram Regression (Threshold Bias)**: The v1.6.36 fix used a 2.5cm threshold, but many Text-Heavy diagrams use `node distance=3cm`, which slipped through and rendered as squashed.
  - **Correction**: Implemented **Bifurcated Logic** in the Safety Net.
  - **Logic**:
    -   **Text-Heavy (Cycle)**: Aggressive Protection. Override ANY distance < 8.4cm. (Fixes Squashing).
    -   **Text-Light (Pipeline)**: Permissive Respect. Override ONLY distance < 0.5cm. (Preserves Compactness).
  - **Impact**: Solves the "Goldilocks" problem by acknowledging that text-heavy diagrams operate on a fundamentally different physical scale than text-light ones.

## [1.6.36] - 2025-12-08 (Text-Heavy Safety Net) [PARTIAL]
### Fixed
- **TikZ Cycle Diagram Regression ("Squashed again")**: The "Strict Respect" rule (v1.6.35) allowed text-heavy diagrams (Cycles) to use tiny node distances.
  - **Status**: Partially effective (Pipeline vs 0.8cm), but failed for "Medium" distance cycles (3cm). Superseded by v1.6.37.
  - **Correction**: Re-introduced the **Text-Heavy Safety Net** with conditional logic.
  - **Logic**:
    -   **IF** `isTextHeavy` (avg label > 30 chars) **AND** `node distance < 2.5cm`: **OVERRIDE** (Force 8.4cm).
    -   **ELSE**: **RESPECT** user intent (allows tight Pipelines).
  - **Impact**: Universally solves both "Explosion" (for Pipelines) and "Squash" (for Cycles) by detecting content density.

## [1.6.35] - 2025-12-08 (Strict Node Distance Protocol) [PARTIAL]
### Fixed
- **TikZ Relative Layout Explosion**: The system was overriding explicit `node distance=0.8cm` with `8.4cm` (10x expansion).
  - **Status**: Fixed explosion but caused regression for text-heavy diagrams. Superseded by v1.6.36.
  - **Correction**: Implemented **Strict Respect** for user-defined node distances.
  - **Logic**: If the user sets a distance >= 0.5cm, we **TRUST IT** and do not override. We only inject defaults for missing or near-zero distances.
  - **Impact**: Flowcharts with `node distance` retain their intended compactness while still benefiting from Adaptive Y-Scaling.

## [1.6.31] - 2025-12-08 (Adaptive Y-Axis Scaling)
### Fixed
- **TikZ "Fix One, Ruin Others" Regression**: The "Vertical Boost" (v1.6.28, y=2.2cm) fixed "Squashed" diagrams but exploded tall/sparse diagrams.
  - **Correction**: Implemented **Adaptive Y-Scaling**.
    - **Logic**: `y = 12cm / VerticalSpan`.
    - **Clamps**: Min 1.3cm (for tall diagrams), Max 2.2cm (for squashed diagrams).
    - **Impact**: Provides "Goldilocks" spacing. Short diagrams get maximum boost; tall diagrams get constrained spacing.

## [1.6.29] - 2025-12-08 (Unified Intent Architecture)
### Fixed
- **TikZ Classification Logic Trap**: Wide diagrams (>14cm) were triggering `WIDE` intent (Legacy Scaling) instead of `LARGE` intent (Density Optimized), bypassing fixes.
  - **Correction**: All Absolute Layouts (`Span > 0`) now strictly enter `LARGE/FLAT` intent.
  - **Impact**: Ensures modern density logic applies to all diagrams, preventing "Blind Shrinking".

## [1.6.28] - 2025-12-08 (Vertical Boost Strategy) [PARTIAL]
### Fixed
- **TikZ Vertical Compression ("Squashed" Look)**: Acknowledged failure of symmetrical density.
  - **Status**: Partially effective but caused regression (Explosion). Superseded by v1.6.31.

## [Abandoned] Node Inflation (v1.6.30-34)
- **Attempt**: To increase node size (`inner sep`) when boosting Y-axis.
- **Outcome**: **FAILED**. Render engine completely ignored explicit padding instructions despite multiple strategies (Injection, Decoupling, Scorched Earth).
- **Resolution**: Feature abandoned to preserve system integrity. Code reverted.
### Fixed
- **TikZ High-Definition Density (The Universal Overlap Fix)**: Previous fixes (1.3cm/1.5cm) were insufficient for wide text content in absolute layouts.
  - **Correction**: Implemented **Adaptive Density Logic**:
    - **Small Diagrams (Span <= 7)**: Force **Tight Grid (1.3cm)** to prevent "Huge Empty Gaps".
    - **Large Diagrams (Span > 7)**: Force **Loose Grid (1.8cm)** and **25cm Width Budget**.
  - **Impact**: Large diagrams now render with ~1.8cm unit spacing (70% expansion vs 1.0). The `katex-autoscale` engine then shrinks the visual view to fit the container. This effectively reduces font size relative to geometry by ~40%, clearing even the most stubborn text overlaps (like "Inputs (emails, docs)" vs braces).

## [1.6.24] - 2025-12-08 (Partial Fix)
### Fixed
- **TikZ Edge-Case Collision**: Symmetrical clamping (`x=1.3cm`) was slightly too tight for nodes with very long text (e.g., "(emails, docs, data)") placed adjacent to other elements.
  - **Correction**: Relaxed the **X-Axis Clamp** from 1.3cm to **1.5cm**.
  - **Impact**: Provides 15% more horizontal breathing room for text expansion without returning to the "loose" visuals of 1.6cm+. The default grid is now (`x=1.5cm, y=1.3cm`) for maximum safe density.

## [1.6.23] - 2025-12-08
### Fixed
- **TikZ Logic Trap**: Diagrams with explicit Absolute Coordinates were falling through to "COMPACT" intent if they had >8 nodes, causing blind `scale=0.75` shrinking and neutralizing our v1.6.22 fix.
  - **Correction**: Updated intent classification to prioritize `horizontalSpan > 0` (Absolute Layouts) as **LARGE** intent.
  - **Impact**: Ensures absolute layouts invoke the "Density Equation" logic (Width Budget 19cm + Auto-Zoom), rather than being crushed by generic node-count heuristics.

## [1.6.22] - 2025-12-08
### Fixed
- **TikZ High-Density Cramping**: Dense diagrams (Span ~14cm) were being rendered at 1:1 scale (`x=1cm`), causing massive text overlap.
  - **Correction**: Increased calculation "Width Budget" from 14cm to **19cm**.
  - **Reasoning**: This allows `xUnit` to expand to **1.35cm** (clamped to 1.3), increasing physical spacing by 30%. The Zoom-to-Fit engine then shrinks the entire view to fit the container, effectively shrinking the font relative to the geometry. Resolves "Density Equation".

## [1.6.21] - 2025-12-08
### Fixed
- **TikZ Brace Parsing**: The regex for the "Manual Bezier Brace Polyfill" (`decoration={brace}`) was too strict, failing on spaces (e.g., `decorate, decoration`).
  - **Symptom**: Rendering crash (`! Package pgfkeys Error: I do not know the key '/pgf/decoration/.expanded'`).
  - **Fix**: Updated the regex in `LatexPreview.tsx` to be robust against whitespace (`\s*`) around keys and commas.

## [1.6.20] - 2025-12-08
### Fixed
- **TikZ Symmetrical Clamping**: Tuned horizontal protection to clamp `xUnit` at **1.3cm** (down from 1.6cm) to match the vertical `yUnit` clamp.
  - **Reasoning**: Creates a symmetrical "Max Grid" of 1.3cm for absolute diagrams, ensuring consistent compactness and preventing horizontal gaps from feeling "loose" compared to vertical ones.

## [1.6.19] - 2025-12-08
### Fixed
- **TikZ Horizontal Scaling**: The calculated optimal unit (up to 2.5cm) was too aggressive for diagrams with small coordinate spans (e.g., 3.5 units), creating large horizontal gaps.
  - **Correction**: Clamped `xUnit` to **1.6cm** for "Large Intent" diagrams with absolute positioning.
  - **Reasoning**: This provides a modest boost (1.6x) over standard 1cm units without creating "outrageous" loose space.

## [1.6.18] - 2025-12-08
### Fixed
- **TikZ Vertical Explosion (Levels)**: Hierarchical diagrams with "Large Intent" (Text Heavy) and explicit coordinates were checking X-width and expanding *both* X and Y to fill the page, leading to `y=2.5cm`.
  - **Correction**: Decoupled X and Y expansion logic for absolute layouts.
  - **Fix**: X expands to fill width (max 2.5cm), but **Y is clamped at 1.3cm**.
  - **Result**: Wide text fits, but vertical stacking remains compact (2.6cm gap vs 5cm gap).

## [1.6.17] - 2025-12-08
### Fixed
- **TikZ Coordinate Explosion**: Diagrams with explicit absolute coordinates (e.g., `at (0,4)`) were being inflated by the "Goldilocks" density boost (`y=1.5cm`).
  - **Symptom**: "Outrageously big" gaps between nodes.
  - **Root Cause**: The density check `horizontalSpan < 7` assumed that small-span diagrams needed expansion. However, diagrams with *any* explicit span (`> 0`) are by definition user-controlled and should not be distorted.
  - **Fix**: Restricted the Goldilocks boost to **Relative Positioning Only** (`horizontalSpan === 0`). Absolute coordinates are now respected (or scaled proportionally via Medium intent).

## [1.6.16] - 2025-12-08
### Fixed
- **Universal Math Repair**: `$\theta$_t` and `^2` (orphaned subscripts/superscripts) were crashing the renderer.
  - **Root Cause**: Invalid LaTeX syntax where subscripts exist outside math mode.
  - **Fix**: Implemented "Universal Regex" in `server/ai/utils.ts` that detects `MathEnd + Operator + Payload` and merges them back into the math block.
  - **Scope**: Handles subscripts, superscripts, single chars, and braced groups.
  - **Philosophy**: "Sanitize at Source" (Rule 9) - fix the data before it reaches the fragile client.

## [1.6.15] - 2025-12-08
### Refactored
- **Chunked Editor (Phase 6)**: Refactored the Editor to process the document **Section-by-Section** instead of as a monolith.
  - **Problem**: Large 70k+ char documents exceeded the output token limit (4k/8k), causing the AI to truncate the JSON response mid-file, deleting half the paper.
  - **Solution**: The Editor loop now iterates through sections, independently processing each one.
  - **Impact**: Eliminates truncation risk. Scales to infinite document length.
### Fixed
- **Diagram Corruption**: Phase 6 Editor is now **strictly prohibited** from modifying the `content` of enhancements. It can only edit `title` and `description`.
- **Editor Duplication**: Fixed a bug where `phase6_Editor` was called twice in `service.ts`.

## [1.6.14] - 2025-12-08
### Added
- **Feedback-Loop Retry (Self-Healing)**: Implemented an intelligent retry mechanism for Phase 6.
  - **Logic**: If `validateLatexSyntax` fails, the error message is captured and injected back into the prompt: *"PREVIOUS ATTEMPT FAILED: [Error]. FIX THIS."*
  - **Result**: The AI self-corrects syntax errors (e.g., closing missing braces) instead of blindly retrying.

## [1.6.13] - 2025-12-08
### Added
- **Deep Review Mode**: Added user toggle to switch between "Quick Review" (Single Pass) and "Deep Review" (6-Phase rigorous analysis).
- **Backend Flow**: Connected `advancedOptions.reviewDepth` from UI to `service.ts`.

## [1.6.12] - 2025-12-08
### Fixed
- **TikZ Title Gap**: Diagrams with title nodes at `+(0,2)` had excessive whitespace between the title and the content boxes.
  - **Root Cause**: For LARGE intent relative positioning diagrams, TikZ's default y-unit (1cm) made `+(0,2)` = 2cm gap.
  - **Discovery**: `node distance` controls relative positioning (`below of=`, `right of=`) but NOT coordinate offsets like `+(0,2)`. These are independent systems.
  - **Fix**: Inject `y=0.5cm` for LARGE relative diagrams, compressing `+(0,2)` to 1cm while `node distance=8.4cm` remains unaffected.
  - **Goldilocks Exclusion**: LARGE intent is now excluded from Goldilocks Protocol's x/y injection to prevent conflicts.

## [1.6.11] - 2025-12-08
### Added
- **TikZ Loading Placeholder**: Added visual feedback while TikZ diagrams render.
  - **Display**: Shows `[ Generating diagram... ]` with subtle pulsing animation.
  - **Architecture**: Fully contained inside the TikZ iframe (preserves isolation philosophy).
  - **Auto-Hide**: The existing `MutationObserver` (used for height resizing) now hides the placeholder when the SVG appears.
  - **Design Decision**: ASCII-only text for maximum compatibility; avoids emoji rendering issues across systems.
  - **Layout**: Uses `flex-direction: column` on body to stack loading state above diagram container.

## [1.5.16] - 2025-12-08
### Fixed
- **Table Thousand Separators**: Numbers like `105{,}000` were rendering with literal `{,}` instead of `105,000`.
  - **Root Cause**: Missing handler for LaTeX thousand separator pattern.
  - **Fix**: Added `{,}` → `,` replacement in `parseLatexFormatting()`.
- **Table `\&` Corruption**: Cells containing escaped ampersands (e.g., "Fear \& Greed") were being split incorrectly across rows and columns.
  - **Root Cause Chain**: AI generates `\&` → JSON escaping doubles it → `fixAIJsonEscaping` doubles again → Result is `\\&` (row break + column sep).
  - **Fix**: Added pre-normalization in `splitCells()` to convert `\\&` → `\&` before parsing. This is **robust** because it handles any AI that produces double-escaped ampersands.
  - **Universal**: Applies to all future tables regardless of AI model or escaping behavior.

## [1.5.15] - 2025-12-08
### Fixed
- **IEEE Citation Grouping**: Citations were rendering as `[1][2]` instead of `[1, 2]`.
  - **Root Cause**: The client-side citation renderer was joining individual bracket labels with an empty string.
  - **Fix**: Rewrote the `\cite{}` handler in `LatexPreview.tsx` to group all valid citation numbers into a single bracket pair.
  - **Result**: `\cite{ref_1,ref_2}` now correctly renders as `[1, 2]` (IEEE/Nature style).

## [1.5.14] - 2025-12-07
### Fixed
- **List Numbering (Enumerate)**: `latex.js` was rendering `enumerate` lists as "1Text" without dots or spacing.
  - **Fix**: Implemented **Manual Leaf-First Recursive Parser** in `LatexPreview.tsx`.
  - **Strategy**: Extracts `\begin{enumerate}` blocks, converts them to HTML `<ol>`, and bypasses `latex.js` entirely.
  - **Styling**: Added aggressive `!important` overrides in `latex-article.css` to defeat Tailwind's global property resets.
- **Algorithm Styling**: Algorithms were rendering as unstyled text because the CSS class was missing.
  - **Fix**: Added `.algorithm-wrapper` styles to `latex-article.css`.
  - **Logic**: Updated parser to rely on this class for grey background framing.

## [1.5.13] - 2025-12-07
### Fixed
- **Citation Robustness (The Auditor Fix)**: "Universal Citation Processor" updated to a **Robust Tokenizer**.
  - **Logic**: No longer assumes comma separators. Now splits content by `/[,\s;]+/` (Commans, Semicolons, Spaces, Newlines).
  - **Impact**: Correctly parses `(ref_1; ref_2)` or `(ref_1 ref_2)` which previously failed and rendered as raw text.
  - **Logging**: Added deep transparency logs for every citation match and merge operation.

## [1.5.12] - 2025-12-07
### Refactored
- **Phase 4: The Peer Reviewer**: Rebranded "The Critic" to "The Peer Reviewer".
  - **New Role**: Acts as a Senior PI conducting a "Nature/Science" caliber review.
  - **Capabilities**: Now uses the **Librarian Agent** (Web/Search capable) instead of the Strategist.
  - **New Criteria**: Assesses **Novelty** (Originality), **Rigor** (Logic), and **Validity** (Claim Verification).
  - **Data Flow**: Outputs a structured `ReviewReport` consuming `ctx.references` to prevent blind guessing.

## [1.5.11] - 2025-12-07
### Refactored
- **Citation System Overhaul**: Replaced ad-hoc regex with a two-pass **Universal Citation Processor**.
  1. **Tokenization**: Converts ANY parenthesized reference block `(ref_X...)` to `\cite{X}`.
  2. **Normalization**: Recursively merges adjacent citations `\cite{A} \cite{B}` into `\cite{A,B}`.
  - **Result**: Guarantees Standard Academic Formatting (e.g., `[2, 7]`) regardless of AI output variations.

## [1.5.10] - 2025-12-07
### Fixed
- **Citation Grouping**: Compiler now correctly groups multiple citations like `(ref_1, ref_2)` into `\cite{ref_1,ref_2}`, enabling `natbib` to render them as compressed groups `[1, 2]`. Previously they were left as raw text.

## [1.5.9] - 2025-12-07
### Fixed
- **TikZ Scaling Explosion**: "Goldilocks Protocol" (Text Heavy boost) was incorrectly expanding absolute-coordinate diagrams.
  - **Fix**: Restricted boost to only apply if `horizontalSpan < 7` (Index-based layouts) or unknown. Physical layouts (Span >= 7) are now exempt.
- **TikZ Font Shrinkage**: MEDIUM intent was arbitrarily scaling diagrams to 0.8x based on node count.
  - **Fix**: "Smart Scaling": If `horizontalSpan <= 14cm` (fits A4), use `scale=1.0` to preserve readability.

## [1.5.8] - 2025-12-07
### Fixed
- **Tiny Equation Bug**: Equations using verbose commands (`\mathrm`, `\text`) were being incorrectly shrunk by auto-scaling.
  - **Fix**: Auto-scaling heuristic now strips `\mathrm`, `\text`, `\left`, `\right`, etc. before counting characters.
- **Environment Inflation**: `\begin{equation}` wrapper tags were inflating character count, triggering unwanted scaling.
  - **Fix**: Explicitly skipped auto-scaling for all structured math environments (`equation`, `align`, `gather`).
- **Equation Scrollbars**: Removed unwanted scrollbars from display math.
  - **Fix**: Changed `overflow-x: auto` to `hidden` in CSS; rely on auto-scaling for long equations.

## [1.5.7] - 2025-12-07
### Added
- **FLAT Intent (TikZ)**: New intent classification for timeline-style diagrams with extreme aspect ratios (> 3:1).
  - **Detection**: Extracts ALL `(x,y)` coordinate pairs (not just `at` patterns) to calculate true vertical extent.
  - **Root Cause Fix**: Previous regex only matched `at (x,y)` patterns, missing `\draw (x,y)` coordinates that define vertical extent.
  - **Trigger**: Aspect ratio (horizontal/vertical) > 3.0 activates FLAT intent.
  - **Correction**: Multiplier-based expansion: `y × (ratio/2)`, `x × 1.5`.
  - **Override Behavior**: Strips existing `x=`/`y=` values before injecting calculated ones (TikZ uses first value).

### Changed
- **Coordinate Extraction**: Now captures ALL `(x,y)` patterns in TikZ code, not just `at (x,y)`, for accurate span/aspect calculations.
- **Priority Order**: Updated to `WIDE > FLAT > node distance > text density > node count > MEDIUM`.
- **Documentation**: Updated `TIKZ_HANDLING.md` and `LATEX_PREVIEW_SYSTEM.md` with FLAT intent specifications.

## [1.5.6] - 2025-12-07
### Added
- **WIDE Intent (TikZ)**: New intent classification for diagrams using absolute positioning (`\node at (x,y)`) that exceed A4 safe width.
  - **Detection**: Extracts X coordinates from `at (x,y)` patterns, calculates horizontal span.
  - **Trigger**: Horizontal span > 14cm activates WIDE intent (takes priority over all other intents).
  - **Scaling**: Dynamic `scale = min(1.0, 14/span) × 0.9` with floor at 0.5.
  - **Requirement**: `transform shape` is mandatory for proportional shrinking.
- **Explicit Coordinate Exemption**: MEDIUM and LARGE intents now skip automatic scaling if `x=` or `y=` are explicitly set in TikZ options.

### Changed
- **Documentation**: Updated `TIKZ_HANDLING.md` and `LATEX_PREVIEW_SYSTEM.md` with WIDE intent specifications.

## [1.5.5] - 2025-12-06
### Added
- **Hybrid Intent Logic**: Refactored TikZ classification (Phase 7) to use a "Hybrid" approach.
  - **Text Density Override**: Explicitly detects text-heavy diagrams (`>30` chars/node) and forces `LARGE` intent globally.
  - **Goldilocks Hoist**: "Coordinate Boost" (`x=2.2cm, y=1.5cm`) now applies to ALL dense diagrams, preventing label overlap regardless of original node distance.

## [1.5.4] - 2025-12-06
### Fixed
- **Math Rendering**: Resolved critical bug where `align*` environments rendered as red text.
  - **Fix**: Updated regex to pass the *entire* environment match (including `\begin{align*}`) to KaTeX, rather than just the body.
- **Table Math**: Resolved `LATEXPREVIEWMATH` placeholders appearing in table cells.
  - **Fix**: Implemented `resolvePlaceholders()` helper to recursively resolve placeholders inside manually parsed table cells.

## [1.5.3] - 2025-12-06
### Fixed
- **TikZ Standardization (Polyfill)**:
  - **Geometric Polyfill**: Replaced incompatible `decoration={brace}` commands with manual Bezier curve drawing logic. This bypasses the `PGFkeys` error in TikZJax.
  - **Mirror Support**: Polyfill now looks for `mirror` keyword and flips curvature accordingly.
  - **Iframe Resizing**: Tightened resize buffer from `20px` to `5px` (calculated via `getBoundingClientRect`) to eliminate whitespace.

## [1.5.2] - 2025-12-06
### Fixed
- **Root Cause Remediation**: Replaced fragile hacks with robust, native solutions.
  - **Headers**: Switched `\paragraph` replacer to inject valid LaTeX (`\vspace`, `\textbf`) instead of HTML tags, removing artifacts.
  - **Math Scaling**: Reverted to `transform` (calculated width) for stable layout, but removed all interactive CSS (hover/icons) for a clean print look.

## [1.5.1] - 2025-12-06
### Fixed
- **Audit Remediation (Stability Hardening)**: Addressed 3 critical rendering risks identified by external audit.
  - **TikZ Nested Brackets**: Replaced brittle regex extraction with `extractTikzBlocks` manual parser. Safely handles nested options like `[label={[0,1]}]`.
  - **Table Row Integrity**: Replaced naive row splitting with `smartSplitRows`. Prevents `\\` inside `\parbox` or braces from corrupting the table structure.
  - **Placeholder Safety**: Added `DOM.normalize()` before injection to prevent browser text-node splitting from breaking placeholder replacement.

## [1.5.0] - 2025-12-06
### Added
- **Responsive TikZ Architecture (v1.4.0 Re-architecture)**: Abandoned manual "intent-based" scaling hacks in favor of professional web standards.
  - **CSS-Driven Layout**: Enforced `width: auto`, `max-width: 100%`, and `margin: 0 auto` on SVG elements to ensure perfect responsiveness.
  - **Height-Only Observation**: Updated iframe resize observers to only manage height, relying on the browser's layout engine for width.
  - **Centering**: Added Flexbox centering to TikZ containers, resolving left-alignment issues.
- **Native TabularX Parsing**:
  - **Parser Upgrade**: Updated manual parser to natively handle `\begin{tabularx}` environments (previously skipped/nuked) by ignoring the width argument.
  - **Whitespace Robustness**: Fixed "Table Body - Parse Failed" errors caused by whitespace in command arguments (e.g., `\begin{tabular} {cols}`).
- **Parsing Order Fix**: Moved standard table parsing *before* `tabularx` replacement to ensure nested tables are correctly extracted.

## [1.4.0] - 2025-12-06
### Added
- **Strict Containment Protocol**: Enforced "Code is Law" rules for `latex.js`.
  - **Dangerous Macros**: `\eqref`, `\ref`, `\label`, `\url`, `\footnote` are now strictly intercepted and sanitized to safe HTML/text before reaching the renderer.
  - **Parent Node Surgery**: Implemented deep DOM surgery in `LatexPreview.tsx` to prevent invalid HTML nesting (e.g., `<div>` inside `<p>`) for block-level placeholders.
  - **Parbox Support**: Added support for `\columnwidth` in the manual parbox parser.
- **Documentation**: Updated `ARCHITECTURE.md` and `LATEX_PREVIEW_SYSTEM.md` to fully align with the strict implementation.

## [1.3.0] - 2025-12-06
### Added
- **Recall Last Generation**: Added Persistence/Recall feature. Users can now restore their last generated paper (including LaTeX source) from the database across page reloads and browser sessions.
- **Import LaTeX**: Added "Import LaTeX" feature on the landing page, allowing users to upload local `.tex` files for immediate preview and debugging.
- **Intent-Based TikZ Scaling**: Implemented "True Dynamic Scaling" architecture for diagrams:
  - **Compact Strategy**: Automatically detects tight diagrams (e.g., entity flow) and scales them down (`scale=0.75` + `transform shape`) to fit A4 pages.
  - **Large Strategy**: Automatically detects text-heavy diagrams (e.g., cycle processes) and expands spacing (`node distance=8.4cm`) without shrinking text to ensure readability.

## [1.2.0] - 2025-12-06
### Added
- **6-Phase AI Pipeline**: Refactored "Research-First" architecture:
  - Phase 1: Strategist (analyze input → research queries)
  - Phase 2: Librarian (find papers BEFORE writing)
  - Phase 3: Thinker (draft with evidence awareness)
  - Phase 4: Critic (identify weak claims)
  - Phase 5: Rewriter (strengthen text with evidence)
  - Phase 6: Editor (insert citation markers)
- **PipelineContext Pattern**: Shared state object for data flow between phases.
- **Compiler Logic**: Added `compileCitations()` to `latexGenerator.ts` to convert `(ref_X)` → `\cite{ref_X}`.

### Fixed
- **Standalone Tabular**: Added handler for `\begin{tabular}...\end{tabular}` outside table wrappers (was causing "unknown environment: tabular" crash).
- **TikZ Math Placeholders**: Moved TikZ extraction BEFORE math extraction so TikZJax receives raw math (not LATEXPREVIEWMATH placeholders).
- **TikZ Sizing**: Removed forced spacing overrides that inflated diagrams. Diagrams now render at natural size.
- **TikZ Centering**: Wrapped TikZ iframes in centered flex container.
- **Math Display Rhythm**: Added consistent 1.5em spacing above/below display equations.
- **Math Font Size**: Increased display equation font size to 1.1em.

## [1.1.4] - 2025-12-05
### Fixed
- **TikZ Diagram Density**: Implemented "Pure Density Reduction" strategy to eliminate cramped/overlapping diagrams.
  - Removed proportional `scale=X` option (which zooms everything equally, preserving density).
  - Implemented coordinate expansion: `x=5cm, y=5cm` (5x grid expansion).
  - Added relative spacing: `node distance=7cm`.
  - Added text compaction: `font=\small`.
  - Fixed iframe resize logic using `scrollWidth`/`scrollHeight` for accurate sizing.
  - Balanced internal padding (20px + 5px buffer).

## [1.1.3] - 2025-12-05
### Fixed
- **TikZ Coordinate Error**: Removed aggressive typography normalization (`--` to `–`) which was corrupting TikZ path syntax.
- **TikZ Context**: Explicitly wrapped extracted TikZ code in `\begin{tikzpicture}` environment to prevent "Undefined control sequence" errors.
- **TikZ Encoding**: Added ASCII sanitization to prevent `btoa` crashes on unicode characters.
- **Browser Compatibility**: Removed `amsmath` and `graphicx` from the client-side safe preamble to eliminate `require is not defined` errors.
- **Build Stability**: Fixed duplicate variable declarations in `LatexPreview.tsx` via code cleanup.

## [1.1.2] - 2025-12-04
### Changed
- **UI Simplification**: Removed "Split View" mode. The interface now defaults to the "LaTeX Preview" for a cleaner, focused experience.
- **Preview Stability**: Added support for `\hfill` and Q.E.D. symbols (`\hfill$\square$`) in the LaTeX previewer, preventing crashes in mathematical proofs.

## [1.1.1] - 2025-12-04
### Added
- **Formal Academic Citations**: Enforced standard `\cite{ref_X}` syntax and automatic `\begin{thebibliography}` generation.
- **Robust Previewer**: Implemented "Fragment Rendering" strategy in `LatexPreview.tsx` to bypass `latex.js` limitations with complex document structures.
- **Blockquote Support**: Added automatic conversion of text-only equations to styled HTML blockquotes to prevent rendering issues.

### Fixed
- **Database Migration**: Added missing `progress` column to `conversion_jobs` table.
- **Preview Crash**: Resolved `SyntaxError: 2 levels of balancing remaining` by stripping `\documentclass` and `\begin{document}` wrappers.
- **Underscore Crash**: Fixed `SyntaxError: "_" found` by automatically escaping underscores in citation keys (`ref_1` -> `ref\_1`).
- **Cut-off Text**: Fixed issue where long sentences wrapped in `\begin{equation*}` were rendered as single non-breaking lines.

## [1.1.0] - 2025-12-04
### Added
- **Latest AI Models (Dec 2025)**: Updated default configurations to support the latest models:
    - **Poe**: Claude-Sonnet-4.5 (Writer/Strategist), Gemini-2.5-Pro (Librarian).
    - **OpenAI**: GPT-5.1, o3-pro.
    - **Anthropic**: Claude-Opus-4.5.
    - **xAI**: Grok 4.1.
- **Markdown Support**: Added full support for uploading and processing `.md` files.
- **Upload Folder Access**: Added a "Folder" icon button to the header to instantly open the local uploads directory in the system file explorer.
- **Database Logging**: Enabled Drizzle ORM query logging for deeper debugging visibility.

### Changed
- **Logging System**: Removed 80-character truncation limit on API logs to ensure full error transparency.
- **Cleanup**: Removed obsolete test scripts and debug files (`test_poe_whitelist.ts`, `debug_preview_*.html`, etc.) to maintain a clean codebase.

## [0.2.0] - 2025-12-02 (Stable Release)

### Added
- **Sanitization Layer (Server-Side)**: Implemented `sanitizeLatexOutput` in `server/ai/utils.ts` to automatically strip invalid characters (e.g., unicode math symbols) and dangerous commands before JSON parsing.
- **Sanitization Layer (Client-Side)**: Added robust handling in `LatexPreview.tsx` to prevent browser crashes. Unsupported features (like `tabularx`) are now displayed as raw code blocks instead of breaking the renderer.
- **5-Phase Pipeline Documentation**: Updated `ARCHITECTURE.md` and `5_phase_pipeline_mapping.md` to accurately reflect the "Thinker -> Critic -> Librarian -> Editor -> Compiler" workflow.

### Changed
- **Rebranding**: Renamed application from "Auto-Academic Formatter" to **"Auto Academic Paper"** across all documentation, UI, and configuration files.
- **Reference Manager System**: Implemented a deterministic "Compiler" (`compileBibliography`) to handle citation numbering and bibliography generation, replacing the hallucination-prone AI generation.
- **Key-Based Citations**: Updated AI prompts to use stable keys (e.g., `(ref_1)`) instead of numerical citations, ensuring 100% accuracy in mapping.
- **Strict Content Integrity**: Removed "Roleplaying" personas. Implemented strict task-based prompts forbidding fabrication, hallucination, and fake data.
- **"Digital Typesetter" Console**: Replaced the opaque spinner on the Processing Page with a live, granular activity log.
- **Direct Append Bibliography**: Refactored `LatexPreview.tsx` to append the bibliography HTML directly to the DOM, bypassing `latex.js` rendering logic entirely to prevent duplication.

### Fixed
- **Server Crash (EADDRINUSE)**: Fixed a critical server crash caused by a zombie process on port 5000.
- **File Corruption**: Resolved massive data loss in `server/ai/service.ts` caused by `replace_file_content` failure.
- **LaTeX Preview Crash**: Fixed `Invalid UTF-8 byte sequence` and `unreachable` errors in the browser renderer by removing invalid unicode replacements.
- **Ghost Bibliography**: Fixed duplicate bibliography rendering by implementing "Direct Append" strategy.
- **Citation Key Mismatch**: Fixed a bug where `ref.id` was used instead of `ref.key`.

## [0.1.0] - 2025-11-29
### Added
- **Initial migration to Railway and Poe API**.
- **Basic LaTeX rendering with `latex.js`**.
- **"Draft Mode" for handling cases with no research data**.
