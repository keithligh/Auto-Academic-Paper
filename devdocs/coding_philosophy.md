<!-- 1.  **AVOID `replace_file_content` for multi-line blocks**: When editing code, do NOT try to match large blocks of text. The `TargetContent` matching is fragile.
2.  **Prefer `write_to_file` (Overwrite)**: If you need to change more than 3 lines of code, rewrite the entire file or function rather than trying to splice it.
3.  **Use Single-Line Anchors**: If you must use `replace_file_content`, use a SINGLE line of unique code as the `TargetContent` anchor, rather than a block.
4.  **Verify Context**: Before applying an edit, verify the indentation matches exactly.
5.  **Git Confirmation**: ALWAYS ask for user confirmation before running `git commit`.
 THIS RULE MUST NEVER BE REMOVED. -->
# Coding Philosophy & Standards

This document outlines the core coding philosophy and standards for the **Auto Academic Paper** project. All development must strictly adhere to these principles.

## Core Principles

### 1. NO FALLBACK RULE (CRITICAL)
**If There Is an Error, Display an Error and Don't Pretend It Works.**
- **NO SILENT FALLBACKS**: Never swallow errors or fail silently.
- **NO FAKE DATA**: Do not use mockup, dummy, or fabricated data to mask failures.
- **Integrity**: The system must report its actual state, even if that state is "broken".

### 2. ERROR TRANSPARENCY
**Be transparent to the user about errors.**
- **What & Why**: Clearly explain what went wrong and, if possible, why.
- **UX**: Transparency is good User Experience. Users trust systems that tell the truth.

### 3. PROPER ARCHITECTURE
**Think as a System.**
- **Holistic Design**: When implementing features or fixes, consider the impact on the entire system (frontend, backend, deployment).
- **Regression Prevention**: Ensure new changes do not break existing functionality.

### 4. SINGLE SOURCE OF TRUTH (SSOT)
**Maintain consistency through authoritative sources.**
- **Centralized Data**: Use centralized stores (DB, config files, env vars) for core data.
- **Dedicated Utilities**: Access data through specific utility functions to prevent duplication or drift.

### 5. SAFE CODE SHARING
**Write modular, reusable, and decoupled code.**
- **No Global State**: Avoid mutable global state.
- **Loose Coupling**: Components should be independent and interact through clear interfaces.
- **Centralized Utilities**: Use shared utilities for common tasks (validation, file handling) to ensure consistency.

### 6. AVOID OVER-ENGINEERING
**Build simple, fit-for-purpose solutions.**
- **Simplicity**: Do not add unnecessary complexity or premature optimizations.
- **Exceptions**: Complexity is permitted ONLY for:
    - Security purposes.
    - Critical User Experience quality.
    - Absolute technical necessity.

### 7. NO BANDAID RULE
**Never Apply Quick and Dirty Fixes.**
- **Root Cause Analysis**: Always investigate and fix the *root cause*, not just the symptom.
- **No Patching Patches**: Do not layer workarounds on top of workarounds.
- **Systemic Solutions**: Address problems at a macro level.

### 8. LOCAL-FIRST ARCHITECTURE
**Ensure all data persistence is local and self-contained.**
- **SQLite**: Use `better-sqlite3` with WAL mode for robust local data storage.

### 9. THE "CODE IS LAW" RULE (LATEX.JS CONTAINMENT)
**Never Trust Latex.js with Complex Logic.**
- **Strict Containment:** `latex.js` is a dumb text formatter. It must NEVER parse Math, TikZ, Tables, Algorithms, or Citations.
- **The Hybrid Encapsulation:** Complex elements must be extracted, sanitized, and re-injected.
- **Why**: `latex.js` is fragile. Trusting it with complex macros leads to crashes. We verify; we do not trust.

### 10. INTENTIONAL DESIGN (NO GUESSWORK)
**Precision over Force.**
- **Don't Guess**: Never "try things" blindly. Understand the tokens (CSS, API, Logic) before applying changes.
- **Language of Control**: Use precise terms ("Refactor", "Resize", "Recalibrate") instead of vague descriptors.
- **Trust the Engineer**: The user expects a surgeon, not a butcher. Cut exactly where needed.
