# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
