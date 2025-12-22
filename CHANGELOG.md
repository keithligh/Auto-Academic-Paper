# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] - 2025-12-22

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

## [1.0.3] - 2025-12-19

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

## [1.0.2] - 2025-12-18

### Added
- **Librarian: Gemini 3 Flash Support**
  - Added native support for `Gemini3Flash-AAP` custom bot in the Librarian agent configuration.
- **README: Pre-Release Warning**
  - Added "Beta Preview" disclaimer to setting expectations for LLM reliability.

### Changed
- **Librarian: Enforced Custom Bot Search**
  - Removed standard Poe models (e.g., `Gemini-2.5-Pro`) from the Librarian whitelist.
  - **Reasoning**: Only Custom Bots (AAP series) are guaranteed to have Web Search enabled correctly. Standard models caused "Search not supported" confusion.

## [1.0.1] - 2025-12-18

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

## [1.0.0] - 2025-12-17

### Added
- Initial Release: Auto-Academic-Paper V1
- Core AI Pipeline (Strategist, Librarian, Thinker, Reviewer, Rewriter, Editor)
- Robust LaTeX rendering engine
- Anti-Hallucination verification protocols
- BYOK (Bring Your Own Keys) architecture
