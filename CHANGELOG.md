# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2025-12-19

### Added
- **Ollama BYOK Support**
  - Added ability to configure a custom **Base URL** for the Ollama provider.
  - Users can now connect to remote Ollama servers (e.g., local network GPU box) instead of being locked to `localhost`.
  - Renamed "Ollama (Local)" to "Ollama" in the UI.

### Fixed
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
