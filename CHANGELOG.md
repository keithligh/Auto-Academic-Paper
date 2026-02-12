# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).





## [1.0.14] - 2026-02-12T21:18:00+08:00

### Fixed
- **System Integrity: Nested Block Prevention**
  - **Problem**: The `processBibliography` fix (v1.0.12) wrapped bibliography items in a `LATEXPREVIEWBLOCK`. If a citation contained Math or TikZ (which are processed earlier and already wrapped in blocks), this created a "Block inside a Block". The renderer often fails to resolve nested blocks, leaving raw placeholder strings in the output.
  - **Fix**: Modified `processBibliography` to return raw HTML string instead of a placeholder block. This ensures inner placeholders remain exposed for substitution.

## [1.0.13] - 2026-02-12T21:15:00+08:00

### Fixed
- **Regression: Newline Rendering**
  - **Problem**: Newlines (`\\`) rendered as literal double backslashes or failed to break lines.
  - **Root Cause**: A typo in the Phase 8 fix introduced a regex that matched *triple* backslashes (`\\\\\\`) instead of *double* backslashes (`\\\\`).
  - **Fix**: Corrected the regex to `/\\\\/g`.

## [1.0.12] - 2026-02-12T21:12:00+08:00

### Fixed
- **Bibliography Rendering: Partial Backslash Fix**
  - **Problem**: Previous fix (v1.0.11) failed because the Bibliography was rendered as raw text, bypassing the processor entirely.
  - **Fix**: Implemented a dedicated `processBibliography` parser in `processor.ts` that manually parses `\bibitem` entries and applies full LaTeX formatting (newlines, URLs, italics).
  - **Result**: References now render with full visual fidelity, matching the main document style.

## [1.0.11] - 2026-02-12T21:05:00+08:00

### Fixed
- **Bibliography Rendering: Visible Backslash in URLs**
  - **Problem**: References rendered as `2025.\ https://...` instead of `2025. <br/> https://...`.
  - **Root Cause**: Regex collision in `processor.ts`. The Control Space handler (`\ `) consumed the second backslash of the Newline command (`\\ `), breaking the newline replacement.
  - **Fix**: Reordered regex replacements. `\\` (newline) is now processed *before* `\ ` (control space).

## [1.0.10] - 2026-02-12T20:58:00+08:00

### Fixed
- **TikZ Rendering: CJK Crash Fix**
  - **Problem**: Diagrams containing `\begin{CJK}` environments (often injected by the document-level exporter) crashed the TikZ engine with `! LaTeX Error: Environment CJK undefined`.
  - **Fix**: Added a dedicated stripper to `tikz-engine.ts` that removes CJK wrappers *before* the ASCII sanitization filter runs.
  - **Result**: ASCII content survives, CJK characters are filtered out (preventing encoding crashes), and the engine runs without error.

## [1.0.9] - 2026-02-12T20:55:00+08:00

### Fixed
- **LaTeX Rendering: Literal Backslash Control Space**
  - Before: `vs.\ Traditional` rendered as `vs.\ Traditional` (literal backslash visible).
  - After: `\ ` (backslash space) is correctly parsed as a standard space, rendering `vs. Traditional`.
  - **Details**: Added handler for TeX control space command.

## [1.0.8] - 2026-02-12T20:45:00+08:00

### Fixed
- **LaTeX Rendering: Ghost Text "addlinespace"**
  - Before: `\addlinespace` command rendered as literal text "addlinespace" in table cells.
  - After: `\addlinespace` is correctly recognized as a vertical spacer command and stripped (preserving table structure).
  - **Details**: Updated strict table parser to treat `booktabs` spacing commands as valid non-content tokens.

## [1.0.7] - 2026-02-12T20:35:00+08:00

### Fixed
- **LaTeX Rendering: Parbox inside Tables**
  - `\parbox` inside `\multirow` (and other table cells) now renders correctly instead of appearing as literal text.
  - **Details**: Updated the table processing engine to handle parboxes within cell content using a wrapped callback approach.
  - **Impact**: Complex tables (like the Taxonomy of GenAI Adoption Barriers) now display correctly wrapped text in the preview.

## [1.0.6] - 2026-02-12T20:21:00+08:00

### Fixed
- **Error Transparency: Swallowed Exception in 6 AI Adapters**
  - `extractJson()` throws rich diagnostic errors (e.g., "No JSON object or array found", "AI_OUTPUT_TRUNCATED: Try reducing Enhancement Level"), but 6 of 7 adapters caught these and replaced them with a generic `"AI response was not valid JSON"` — destroying all context.
  - **Fix**: All adapters now append the inner exception message: `"AI response was not valid JSON: <original error>"`.
  - **Impact**: Users now see actionable error messages (e.g., truncation guidance) instead of opaque failures.
  - **Affected**: `ollama.ts`, `openai.ts`, `grok.ts`, `gemini.ts`, `anthropic.ts`, `poe.ts` (×2 code paths).

## [1.0.5] - 2026-02-12T20:11:00+08:00

### Added
- **CJK (Chinese/Japanese/Korean) LaTeX Support**
  - Auto-detects CJK characters (Unicode ranges `\u4e00-\u9fff`, `\u3040-\u309f`, `\u30a0-\u30ff`) in document content and abstract.
  - **Export**: Injects `\usepackage{CJKutf8}` into preamble and wraps document body with `\begin{CJK*}{UTF8}{min}...\end{CJK*}` for correct PDF rendering.
  - **Preview**: Two-site CJK stripping in `processor.ts`:
    1. **Inline** (in `parseLatexFormatting`): Regex strips `\begin{CJK*}{enc}{font}content\end{CJK*}` → `content`.
    2. **Document-level** (in command stripping section): Strips orphaned `\begin{CJK*}` open/close tags that survive outside inline contexts.
  - **Design Decision**: Browsers render Unicode (including CJK) natively—the CJK wrapper is purely a LaTeX font selection mechanism. Stripping it for preview while preserving it for export ensures both paths work correctly.

## [1.0.4] - 2025-12-22T00:00:00+08:00

### Fixed
- **LaTeX Export: Preamble-Safe Ampersand Sanitization**
  - The context-aware `&` sanitizer now **skips the preamble** (everything before `\begin{document}`).
  - **Root Cause**: `\usepackage[sort&compress]{natbib}` was being corrupted to `sort\&compress`, causing "Unknown option" errors.
  - **Fix**: Split document at `\begin{document}`, sanitize only the body, leave preamble untouched.
- **LaTeX Export: Removed "Cascade Stopper" Regex**
  - Removed the regex that force-closed `\texttt{`, `\textbf{}` etc. at paragraph breaks.
  - **Root Cause**: The regex created **orphan closing braces** that broke document structure. Example: `\texttt{code\n\nmore}` became `\texttt{code}\n\nmore}` — the trailing `}` closed parent structures prematurely.
  - **Lesson**: Rely on `fixLatexBalance()` at EOF instead of aggressive mid-document closure.
- **LaTeX Export: Line-Limited Backtick Regex**
  - Changed paired backtick matching from `/`([^`]+)`/g` to `/`([^`\n]+)`/g`.
  - **Root Cause**: An orphan backtick (e.g., `` `moving target'' ``) would match the NEXT backtick anywhere in the document (even 100+ lines later), corrupting all `\cite{}`, `\subsection{}` commands in between by escaping their backslashes.
  - **Fix**: Backtick pairs now cannot span newlines, limiting damage to a single line.
- **LaTeX Export: URL/Verbatim Protection**
  - The ampersand sanitizer now skips `\url{}`, `\href{}` command arguments.
  - **Reason**: URLs like `example.com?a=1&b=2` should not have their `&` escaped.

## [1.0.3] - 2025-12-19T00:00:00+08:00

### Added
- **Ollama BYOK Support**
  - Added ability to configure a custom **Base URL** for the Ollama provider.
  - Users can now connect to remote Ollama servers (e.g., local network GPU box) instead of being locked to `localhost`.
  - Renamed "Ollama (Local)" to "Ollama" in the UI.

### Fixed
- **Windows Startup Crash (`ENOTSUP`)**
  - Removed `reusePort: true` from server configuration.
  - This option is Linux-only and caused the server to crash immediately on Windows.
- **Custom Provider Crash**
  - Fixed a critical bug where selecting the "Custom" provider would crash the backend.
  - Wired "Custom" to the standard OpenAI-compatible adapter.
  - Renamed UI label to **"Custom (OpenAI Compatible)"** for clarity.

## [1.0.2] - 2025-12-18T00:00:00+08:00

### Added
- **Librarian: Gemini 3 Flash Support**
  - Added native support for `Gemini3Flash-AAP` custom bot in the Librarian agent configuration.
- **README: Pre-Release Warning**
  - Added "Beta Preview" disclaimer to setting expectations for LLM reliability.

### Changed
- **Librarian: Enforced Custom Bot Search**
  - Removed standard Poe models (e.g., `Gemini-2.5-Pro`) from the Librarian whitelist.
  - **Reasoning**: Only Custom Bots (AAP series) are guaranteed to have Web Search enabled correctly. Standard models caused "Search not supported" confusion.

## [1.0.1] - 2025-12-18T00:00:00+08:00

### Fixed
- **LaTeX Preview: Orphaned Backslashes**
  - Commands like `\textbf`, `\emph` rendered with leading backslashes due to triple-escape artifacts.
  - **Fix**: Updated regexes in `processor.ts` to use `\\+` (one or more backslashes).
- **LaTeX Preview: Algorithm Rendering**
  - Added support for `\ForAll` (→ "for all") and `\hfill` (→ `float: right`).
- **LaTeX Export: Backtick Escape**
  - Markdown-style `` `code` `` caused "Missing { inserted" errors.
  - **Fix**: Convert `` `code` `` to `\texttt{code}` with backslashes escaped inside.
- **LaTeX Export: Orphan Backticks**
  - Unmatched backticks now escaped to `\textasciigrave{}`.

### Added
- **Footer Disclaimer**: AI-generated content warning added to exported LaTeX.
- **README: Human in the Loop Section**: Warns users to verify AI output.
- **README: AI Agents & LLMs Keywords**: SEO-optimized intro with prominent keywords.
- **README: Screenshots**: Interface and preview images embedded.

## [1.0.0] - 2025-12-17T00:00:00+08:00

### Added
- Initial Release: Auto-Academic-Paper V1
- Core AI Pipeline (Strategist, Librarian, Thinker, Reviewer, Rewriter, Editor)
- Robust LaTeX rendering engine
- Anti-Hallucination verification protocols
- BYOK (Bring Your Own Keys) architecture
