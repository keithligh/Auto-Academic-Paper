# TikZ Handling Strategy: The "Sandbox & Silence" Protocol

This document details the specific engineering strategies used to render compiled TikZ diagrams in the browser within the Auto Academic Paper application.

Rendering TikZ in the browser is notoriously difficult because TikZ is a Turing-complete language that requires a full TeX engine. We use an **Iframe Isolation Strategy** (part of the **Strict Isolation Architecture** detailed in `LATEX_PREVIEW_SYSTEM.md`) to achieve this without crashing the main application.

---

## Phase -1: The Prompt-Level Defense (v1.9.125 "Fix at Source")

> **Philosophy**: Before TikZ code even reaches the browser, we harden the AI **System Prompt** to prevent invalid or browser-incompatible code from being generated.

This aligns with the "Correctness" pivot: We do not try to heal broken TikZ in the renderer. We demand valid output from the generator.

**Rules Enforced in System Prompt (`server/ai/service.ts`):**

| Rule | Reason |
| :--- | :--- |
| Use `right=of X`, NOT `right of=X` | Deprecated syntax causes overlap. |
| NO `\begin{axis}` or `\addplot` | pgfplots is too heavy for TikZJax. |
| Only whitelisted libraries | TikZJax doesn't support all TikZ libraries. |
| Use `node distance=2.5cm` default | Prevents cramped/exploded layouts. |
| Wrap text with `text width=2.5cm` | Prevents node overflow. |

**If the AI violates these rules, the TikZ will break.** This is intentional. It exposes broken generation for prompt tuning, rather than silently hiding it with resilient parsing.

---

## 1. The Core Problem
Client-side text parsers (like our Custom Parser or the now-defunct `latex.js`) **cannot** render TikZ. They lack the logic engine required to calculate coordinates, paths, and nodes.

The only viable browser-based solution is **TikZJax**, a WebAssembly port of the TeX engine. However, TikZJax is heavy, fragile, and prone to crashing the main thread if mishandled.

## 2. The Solution: "Extraction, Isolation, Sanitation"

We treat TikZ code not as text, but as a **Hazardous Material** that must be handled in a controlled environment.

### Phase 0: The Filter (Detection & Rejection)
Not all TikZ code is safe for the browser. Specifically, `pgfplots` (plots based on datasets) are too computationally expensive and font-dependent for TikZJax.

-   **Trigger**: We check the captured TikZ code for `\begin{axis}` or `\addplot`.
-   **Action**: If found, we **ABORT** the rendering process for that specific block.
-   **Output**: We inject a warning placeholder: `⚠️ Complex diagram (pgfplots) - not supported in browser preview`.

### Phase 1: The Heist (Extraction)
Before the main document is processed by our Custom Parser (`processor.ts`), we steal the TikZ code.

-   **Manual Parser**: We do NOT use robust regex alone. We use a character-level parser to handle nested brackets `[...]` inside optional arguments (e.g., `label={[0,1]}`).
-   **Proprietary extraction**: See `tikz-engine.ts` (specifically `processTikz`) for the loop safety logic.
-   **Placeholder**: We replace the entire block with a safe ID: `LATEXPREVIEWTIKZBLOCK1`.

### Phase 2: The Detox (Sanitization)
Raw LaTeX cannot be fed directly to TikZJax strings because of JavaScript encoding issues.

1.  **ASCII Enforcement (The `btoa` Fix)**
    -   **Problem**: TikZJax uses `btoa()` internally. Unicode crashes it.
    -   **Solution**: We run `.replace(/[^\x00-\x7F]/g, '')` to strip non-ASCII chars.

2.  **Typography Denormalization**: We preserve double-hyphens `--` for paths.

### Phase 3: The Sandbox (Iframe Isolation)
We inject TikZ code into a dedicated `<iframe>`.
-   **CSS Isolation**: Prevents Tailwind conflicts.
-   **Error Containment**: Crashes stay in the iframe.
-   **Centering**: Iframes are wrapped in flexbox containers for horizontal centering.
-   **Font Strategy (China-Friendly - v1.6.42)**:
  -   **Problem**: `tikzjax.com` is often blocked or slow in China, leading to 404s on fonts and "nullfont" errors.
  -   **Solution**: We load CSS from **jsDelivr** using the `node-tikzjax` package, which has the correct file structure.
  -   **URL**: `https://cdn.jsdelivr.net/npm/node-tikzjax@latest/css/fonts.css`
-   **Log Silencing (v1.6.42)**:
  -   **Problem**: TikZJax emits thousands of distinct `jsTeX` logs ("Missing character", "This is jsTeX").
  -   **Solution**: We inject a script into the iframe that intercepts `console.log/warn/error` and suppresses any message containing `jsTeX` keywords.

### Phase 4: The Context Injection (The Wrapping Fix)
We explicitly re-wrap extracted content in `\begin{tikzpicture}` inside the iframe.

### Phase 5: The Silencer (Error Suppression)
We suppress `message channel closed` errors caused by TikZJax/Iframe interaction issues.

### Phase 5.5: The Loading Placeholder (v1.6.11)
TikZJax compilation (CDN load + WASM execution) can take 500-2000ms. To provide visual feedback:

- **Display**: ASCII placeholder `[ Generating diagram... ]` centered in the iframe
- **Animation**: Subtle CSS `pulse` animation for perceived responsiveness
- **Implementation**: Fully contained inside the iframe (no parent-child communication)
- **Architecture Rationale**: Keeping UI inside the iframe preserves the strict isolation philosophy. Using React state would require cross-frame `postMessage` patterns, adding complexity without benefit.

### Phase 6: The Auto-Resize (MutationObserver)
A `MutationObserver` inside the iframe watches for `<svg>` creation and:
1. **Hides the loading placeholder** (adds `.hidden` class) (v1.6.11)
2. **Resizes the iframe height** to match the rendered diagram

### Phase 7: The "Hybrid Intent" Scaling (v1.5.5)

We generate diagrams using AI, which means we don't always know the size. "One size fits all" failed. We now use a **Hybrid Intent** system that combines explicit AI signals with implicit content analysis.

#### A. The Heuristics
1.  **Explicit Intent**: Does the code include `node distance=Xcm`?
    *   `< 2.0cm` -> **COMPACT** (Pipeline)
    *   `>= 2.5cm` -> **LARGE** (Cycle/Flowchart)
2.  **Implicit Fallback (Density)**: If no distance is set:
    *   **Text Heavy** (>30 chars/node) -> **LARGE**
    *   **Node Heavy** (>=8 nodes) -> **COMPACT**
3.  **NEW (v1.5.6) - Absolute Positioning Override**: If using `at (x,y)` syntax:
    *   **Horizontal Span > 14cm** -> **WIDE** (takes priority over all other intents)

#### B. The WIDE Intent (v1.5.6)

> **Problem Case**: Diagrams that use **absolute positioning** (`\node at (0,0)`, `\node at (4,0)`, etc.) instead of `node distance` are not detected by the node-distance heuristics. If these diagrams span too wide (e.g., 5 nodes at 4cm intervals = 16cm total), they overflow the A4 content width (~14cm) and get responsively shrunk by CSS, causing node overlap.

**Detection Logic:**
```
1. Extract ALL (x,y) coordinate pairs from TikZ code (not just "at" patterns)
2. Calculate horizontal span: maxX - minX
3. If span > 14cm → WIDE intent
```

**The Math:**
-   A4 paper width: 210mm
-   Standard margins: 25mm each side
-   **Safe content width**: 160mm ≈ 16cm, but we use **14cm** as target for safety buffer

**Scaling Formula:**
```
scaleFactor = min(1.0, 14 / horizontalSpan) × 0.9
finalScale = max(0.5, scaleFactor)  // Floor at 50%
```

**Why `transform shape` is REQUIRED for WIDE:**
Unlike LARGE (text readability), WIDE diagrams need **proportional shrinking**. If we scale coordinates without scaling nodes, nodes will overlap. `transform shape` ensures text shrinks with the geometry.

#### BB. The FLAT Intent (v1.5.7)

> **Problem Case**: Timeline-style diagrams have extreme **aspect ratios** (e.g., 10cm wide × 2.5cm tall = 4:1). These diagrams look "squashed" and unprofessional. Labels on the timeline become cramped because horizontal space is limited relative to text size.

**The Root Cause Discovery:**
Initial detection only looked for `at (x,y)` patterns. Timeline diagrams often have:
- Nodes at y=0: `\node at (1,0)`, `\node at (3,0)` → verticalSpan = 0
- Draw commands with vertical extent: `\draw (0,0.5) -- (9.5,2.5)` → NOT captured by `at` regex

**The Fix:** Extract **ALL** `(x,y)` coordinate pairs, not just `at (x,y)`:
```javascript
const allCoordMatches = safeTikz.match(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g);
```

**Detection Logic:**
```
1. Extract ALL (x,y) from TikZ body (nodes, draws, fills, paths)
2. Calculate: horizontalSpan = maxX - minX, verticalSpan = maxY - minY
3. Calculate: aspectRatio = horizontalSpan / verticalSpan
4. If aspectRatio > 3.0 → FLAT intent
```

**Correction Formula (Multiplier-Based):**
Unlike WIDE (which shrinks), FLAT **expands** the coordinate system:
```
targetRatio = 2.0  // Balanced appearance
yMultiplier = min(3.0, max(1.5, aspectRatio / targetRatio))
xMultiplier = 1.6  // 1.6x base (v1.9.18)
newY = existingY × yMultiplier  // e.g., 1cm × 2.5 = 2.5cm
newX = existingX × xMultiplier  // e.g., 1cm × 1.6 = 1.6cm

**Crowded Timeline Exception (v1.9.18)**:
If `nodes > 7`, we apply an **Aggressive Expansion**:
- `xMultiplier = 2.3` (Boosts 3.5cm → 8.05cm)
- **Goal**: Accommodate long text labels in dense diagrams without node collisions.
- **Philosophy**: "Best Estimate" based on node count proxy.
```

**Why Stripping Old Values is Required:**
The diagram may have explicit `[x=1cm, y=1cm]`. Simply appending new values doesn't work (TikZ uses first value). We must:
```javascript
// Strip old x/y from options before merging
options = options.replace(/x\s*=\s*[\d.]+\s*(cm)?/g, '');
options = options.replace(/y\s*=\s*[\d.]+\s*(cm)?/g, '');
```


**Additional Injection:** None. (Space expansion handles labels sufficiently).

#### C. The Execution Rules

| Type | Goal | Scaling Logic | Extra Style Injection |
| :--- | :--- | :--- | :--- |
| **WIDE** | Fit to A4 | Dynamic: `14/span × 0.9` (floor 0.5) | **`transform shape`** (REQUIRED) |
| **FLAT** | Balance Ratio | Multiplier: `y × (ratio/2)`, `x × 1.5` | Strip old x/y |
| **COMPACT** | Fit to A4 | `scale=0.75` (>=8 nodes) / `0.85` | `node distance=1.5cm`, `transform shape` |
| **LARGE** | Readability | `scale=0.85` (>=6 nodes) / `1.0` | `align=center`*, `node distance=8.4cm` (Text) / `5.0cm` (Node) |
| **MEDIUM** | Balance | **Smart Scale**: `1.0` (Fits A4) or `0.8/0.9` | `node distance=2.5cm` |

*Note: `transform shape` is strictly exempt from LARGE to keep text readable.*
*Note*: `align=center` is injected if `text width` is missing, ensuring multi-line labels render correctly.
*Note*: WIDE, COMPACT, and MEDIUM all use `transform shape`. Only LARGE exempts text scaling.

#### D. Priority Order (v1.5.7)
```
WIDE > FLAT > node distance > text density > node count > MEDIUM (default)
```

- **WIDE** takes highest priority (hard overflow constraint)
- **FLAT** takes second priority (aspect ratio distortion is visually severe)

#### E. The Safety Nets (Hidden Logic)
1.  **The Text-Heavy Safety Net (v1.6.5)**: In LARGE mode, if an explicit distance is less than the target distance (8.4cm for text-heavy diagrams, 5.0cm for normal), it is **stripped and replaced** with the target distance to prevent cramping. This ensures text-heavy cycle diagrams get adequate spacing (8.4cm) rather than the generic fallback (5.0cm).
2.  **The Goldilocks Protocol (Universal v1.5.8)**: For diagrams that are **Text Heavy**, we apply a **Global Coordinate Boost** (`x=2.2cm`) ONLY if:
    -   Average text/node > 30 chars
    -   **AND** `horizontalSpan < 7` (Index-based/Small)
    -   **Reason**: Prevents "Explosion" of physical layouts (e.g., width 10) while saving dense index layouts (width 1-2).
3.  **Maximize Space Override (v1.6.4 upgrade)**: For **LARGE** diagrams (Text Heavy), we prioritize physical space over user intent. If the AI provides restrictive coordinates (e.g., `x=0.8cm`), we **STRIP** them and inject calculated values (`optimalUnit = 14cm / horizontalSpan`) to force the diagram to expand to the full width of the view. We also enforce `font=\small` to reduce content density. This solves the "Density Equation" by expanding Space while shrinking Content.
4.  **FLAT Coordinate Override**: For FLAT intent, existing `x=` and `y=` values are **stripped and replaced** with calculated multiplied values (cannot skip, must fix ratio).
5.  **Title Gap Compression (v1.6.12)**: For **LARGE** intent with relative positioning (`horizontalSpan=0`), inject `y=0.5cm` to compress title offsets like `+(0,2)` from 2cm to 1cm. Key insight: `node distance` (in cm) is **NOT affected** by coordinate scaling - they are independent systems.
6.  **Goldilocks LARGE Exclusion (v1.6.12)**: **LARGE** intent is now **excluded** from the Goldilocks Protocol's x/y injection (`x=2.2cm, y=1.5cm`). LARGE uses `node distance` for spacing rather than coordinate scaling, so injecting x/y causes title offset explosions.

#### 8. The Absolute Protection Protocol (v1.6.17-20)
#### 8. The Absolute Protection Protocol (v1.6.17-31)
> **Problem**: Diagrams with explicit absolute coordinates (`\node at (0,4)`) suffered from "Squashed" vs "Exploded" dichotomy.
> **The Fix**: We introduced a specific `horizontalSpan > 0` check (Unified Intent v1.6.29) and Adaptive Y-Scaling (v1.6.31).
> 1.  **Width Budget**: We assume the diagram can fill up to **25cm** (v1.6.25).
> 2.  **Adaptive Y-Axis Scaling (v1.6.31 - "The Goldilocks Vertical")**:
    -   **Concept**: Height is cheap, but not *infinitely* cheap. We must balance squashed diagrams vs exploded ones.
    -   **Formula**: `yUnit = TargetHeight (12cm) / VerticalSpan`.
    -   **Clamping**:
        -   **Max 2.2cm**: For short diagrams (e.g., Span < 5), giving them massive vertical boost to fix "Squashed" look.
        -   **Min 1.3cm**: For tall diagrams (e.g., Span > 10), constraining them to prevent "Explosion".
    -   **Result**: A responsive vertical grid that feels proportional regardless of the input coordinate scale.
> 3.  **Unified Intent (v1.6.29)**:
    -   We abolished the `WIDE` intent for absolute layouts. If `Span > 0`, it enters the `LARGE` physics engine, ensuring the Adaptive Y logic applies universally.
> 4.  **Failed Experiment: Node Inflation**: We attempted to dynamically inflate `inner sep` based on Y-boost. This failed due to rendering engine limitations and was abandoned to preserve integrity.

#### 9. The Logic Trap (v1.6.23)
> **Problem Case**: Diagrams with explicit coordinates (Span > 0) but many nodes (>8) were falling through to `COMPACT` intent, triggering blind `scale=0.75` shrinking. This neutralized the density fixes.
> **The Fix**: We updated the intent classification priority. **Explicit Coordinates (`horizontalSpan > 0`) now strictly imply `LARGE` (Optimized Density) intent**, overriding generic node counts.
> **Rule**: Explicit Layout Signals > Implicit Complexity Heuristics.

#### 10. The Bifurcated Safety Net (v1.6.37)
> **Problem**: A conflict existed between "Pipelines" (Small labels, tight packing) and "Cycles" (Large paragraphs, loose packing). Both often come with `node distance=0.8cm` or `3cm` from the AI.
> - **v1.6.5**: Forced 8.4cm everywhere. Result: Pipelines exploded.
> - **v1.6.35**: Respected user setting. Result: Cycles squashed.
> - **v1.6.36**: Used 2.5cm threshold. Result: Pipelines Safe, but `3cm` Cycles still squashed.
>
> **The Solution (v1.6.37)**: We use the **Intent Engine** (`isTextHeavy`) to bifurcate the physics.
> 1.  **Metric**: `isTextHeavy` = Average Label Length > 30 characters.
> 2.  **Logic**:
>     -   **IF** `isTextHeavy` (Cycle): **Aggressive Protection**. Override ANY distance < **8.4cm**. (Forces proper spacing for paragraphs).
>     -   **ELSE** (Pipeline): **Permissive Respect**. Override ONLY distance < **0.5cm**. (Preserves compact layout).
> 3.  **Result**: Universal stability. Text-heavy diagrams get the space they need; Light diagrams keep the layout they have.

---

#### 11. Title Gap Restoration (v1.6.38)
> **Problem**: The "Adaptive Y-Scaling" (v1.6.31) set `y=1.5cm` (default) for relative layouts. This physically scaled absolute title offsets (like `+(0,2)`) to `3cm`, creating a huge disconnected gap.
> **The Fix**: We restored the "Title Gap Compression" logic from v1.6.12.
> - **Rule**: If `verticalSpan === 0` (Relative Layout, no absolute coordinates), we Force `y=0.5cm`.
> - **Effect**: A title at `(0,2)` renders at `1cm` physical height.
> - **Synergy**: This works perfectly with v1.6.37 because `node distance` (8.4cm) handles the *layout* spacing independently of `y` unit. The diagram stays large; the title stays close.

#### 12. X/Y Injection Restoration (v1.6.39)
> **Problem**: The v1.6.38 edit accidentally removed the line that injects `x=...cm, y=...cm` into the TikZ options.
> **Symptom**: LARGE intent diagrams rendered at native TikZ scale (1cm per unit), then Zoom-to-Fit shrunk them to appear "tiny".
> **The Fix**: Restored the critical `extraOpts += \`, x=\${xUnit}cm, y=\${yUnit}cm\`` line.
> **Lesson**: Exercise extreme care when editing complex functions. Verify before committing.

#### 10. The Continuous Adaptive Scaling (v1.9.83)
> **Problem**: The "Step Function" clamp (v1.6.25) created an artificial "Cliff".
> - Span 6 -> `scale=1.3` (Width 7.8cm). Too Small.
> - Span 8 -> `scale=1.8` (Width 14.4cm). Huge.
> **The Fix**: We replaced the cliff with a **Continuous Function** targeting a "Sweet Spot" width of **12cm** (75% A4 Width).
> **Formula**: `targetScale = 12 / Span`.
> **Clamping**: Bounded between `[1.3, 2.5]` to ensure small diagrams get at least 30% boost, and we don't exceed the max safe scale (2.5x).
> **Result**:
> - Span 6 -> `scale=2.0` (Width 12cm). Perfect.
> - Span 10 -> `scale=1.2` (Width 12cm). Consistent.

#### 11. Title Gap Restoration (v1.6.38)
- **Detection**: `aspectRatio >= 3.0` (Inclusive threshold v1.9.19).
- **Logic**:
  - **Standard**: `xMultiplier = 1.6`, `yMultiplier` adaptive (1.5x - 3.0x). with many nodes had overlapping text labels even after x/y multiplier expansion.
> **Root Cause**: Nodes with `minimum width=2.5cm` don't resize when coordinates scale. The text "AI research, personas, journeys" (~6cm) overflows the 2.5cm box.
> **Key Insight**: x/y multipliers expand spacing between node *centers*, but they don't shrink text that overflows fixed-width boxes.
> **The Fix**: For FLAT intent diagrams with ≥5 nodes, inject `font=\small`.
> ```typescript
> if (nodeMatches.length >= 5 && !options.includes('font=')) {
>   extraOpts += ', font=\\small';
> }
> ```
> **Why 5 nodes?**: Fewer nodes rarely cause overlap. The threshold prevents unnecessary font reduction for simple diagrams.
> **Alternative Considered**: Adding `text width` to force wrapping. Rejected because it changes the visual appearance more drastically.

---

## Summary of Critical Rules

1.  **NEVER** let the text parser see `\begin{tikzpicture}`.
3.  **ALWAYS** use the manual bracket parser for extraction (Regex is insufficient).
4.  **ALWAYS** use `transform shape` for **COMPACT** and **WIDE** diagrams (scales text).
5.  **NEVER** use `transform shape` for **LARGE** diagrams (keeps text readable).
6.  **ALWAYS** extract **ALL** `(x,y)` coordinate pairs (not just `at (x,y)`) for span/aspect calculations.
7.  **ALWAYS** strip and replace existing `x=`/`y=` values for **FLAT** intent (cannot skip, must fix ratio).
8.  **ALWAYS** wrap combined options in `[...]` during merging. **NEVER** pass raw option strings (e.g., `x=1cm`) to the iframe. (v1.9.16)

### 15. The Browser Engine Protection Suite (v1.9.12)

While the TikZ engine handles the rendering inside the iframe, the **Integration** into the main document relies on the "Hybrid Encapsulation" strategy.

- **The "Missing Link" Fix**: We discovered that TikZ placeholders (`LATEXPREVIEWTIKZBLOCK17`) were sometimes lost when nested inside complex lists or table cells because the `TreeWalker` (DOM post-processing) failed to find them.
- **The Solution (String Injection)**: We now replace the TikZ placeholder with the iframe HTML **at the string level** before the DOM is built.
- **Why it matters**: This guarantees that your diagram appears even if you nest it 5 levels deep in an `itemize` list inside a `tabular` cell. It moves the integration point from "Fragile DOM" to "Robust String".

### 15. The Browser Engine Protection Suite (v1.9.12)

While the TikZ engine handles the rendering inside the iframe, the **Integration** into the main document relies on the "Hybrid Encapsulation" strategy.

- **The "Missing Link" Fix**: We discovered that TikZ placeholders (`LATEXPREVIEWTIKZBLOCK17`) were sometimes lost when nested inside complex lists or table cells because the `TreeWalker` (DOM post-processing) failed to find them.
- **The Solution (String Injection)**: We now replace the TikZ placeholder with the iframe HTML **at the string level** before the DOM is built.
- **Why it matters**: This guarantees that your diagram appears even if you nest it 5 levels deep in an `itemize` list inside a `tabular` cell. It moves the integration point from "Fragile DOM" to "Robust String".

#### 15. The Browser Engine Protection Suite (v1.9.5)
The TikZ engine was prone to "Blank" renders due to browser limitations. We implemented a protection suite:

1.  **Comment Stripping V2 (Token Replacement Strategy - v1.9.25)**:
    *   **Old Way**: Regex `/(?<!\\)%.*$/gm` (Negative Lookbehind). **Failed** because lookbehinds are flaky in some environments and risk false negatives.
    *   **New Way**:
        1.  `safeTikz.replace(/\\%/g, '__PCT__')` (Save escaped percents)
        2.  `safeTikz.replace(/%.*$/gm, '')` (Nuke comments)
        3.  `safeTikz.replace(/__PCT__/g, '\\%')` (Restore escaped percents)
    *   **Why**: It guarantees that `100\%` is never mistaken for a comment start, without needing advanced regex features.
    *   **Why**: It guarantees that `100\%` is never mistaken for a comment start, without needing advanced regex features.
3.  **Deprecated Syntax Normalization (v1.9.37)**:
    *   **Problem**: AI models often generate deprecated positioning syntax like `right of=node`. When combined with `node distance`, this is interpreted as center-to-center distance, strictly ignoring node width. This causes massive overlap.
    *   **Fix**: We apply a pre-render regex replacement:
        *   `right of=` -> `right=of `
        *   `left of=` -> `left=of `
        *   `above of=` -> `above=of `
        *   `below of=` -> `below=of `
    *   **Result**: This forces the `positioning` library (which we inject) to use edge-to-edge spacing, respecting node widths and distance settings.
4.  **Library Injection**: We inject `\usetikzlibrary{arrows,shapes,calc,positioning,decorations.pathreplacing}`.
    *   **Why**: The browser doesn't autoload libraries. Missing `arrows` causes a silent crash.
3.  **Unsupported Feature Strip**:
    *   **Fonts**: `\sffamily`, `\ttfamily`. (Reason: Missing WASM font metrics).
    *   **Environments**: `itemize` or `enumitem`. (Reason: Incompatible with WASM nodes).
        *   **Fix**: Auto-convert `\item` to `$\bullet$`.
    *   **Why**: If `MutationObserver` fails to detect height (0px), the diagram vanishes. This forces visibility.
5.  **Small Minimum Height (v1.9.16)**: Reduced `min-height` to `100px`.
    *   **Why**: 200px was too tall for horizontal timeline diagrams, creating massive whitespace gaps.

#### B. Plot Safety Protocol (The "Asymptote" Fix)
> **Problem**: The "Goldilocks" Vertical Scaling (trying to stretch small diagrams to ~8cm height) is catastrophic for Mathematical Plots.
> **Scenario**: A user plots `y = 3/x` from `domain=0.3:3`. At x=0.3, y=10. This point is often outside the drawn axes (clipped visually by the author, but present in the bbox).
> **The Failure**: The Engine sees a small axis (3.5cm) and applies a boost `y=1.8cm` to hit the 8cm target. This boosts the invisible asymptote (y=10) to `18cm`, creating a massive tower of whitespace.
> **The Distortion**: If we only fixed Y (e.g. `y=1`), but left X expanding (e.g. `x=1.8` for LARGE intent), the plot becomes severely flattened (1.8:1 ratio), turning circles into ellipses and distorting the function shape.
> **The Fix (v1.9.81 / v1.9.82)**:
> 1.  **Square Scaling**: We enforce `xUnit = 1.0` and `yUnit = 1.0` to preserve geometric truth (circles stay circular).
> 2.  **Safety Clip (Local Scope)**: Instead of a global clip (which might cut off axis labels like "Speed S" extending beyond the grid), we wrap **only the plot command** in a local scope with a clip.
>      ```latex
>      \begin{scope}
>      \clip (minX-0.5, minY-0.5) rectangle (maxX+0.5, maxY+0.5);
>      \draw ... plot ...;
>      \end{scope}
>      ```
>      This surgically trims the asymptotic curve to the visible axes (plus line-width padding) while leaving all labels, arrows, and other diagram elements strictly untouched.
### 16. The Double Bracket Protocol (v1.9.16)
> **Problem**: The TikZ Option Extractor strips outer brackets (`[x=1cm]` -> `x=1cm`). The Merger then adds new options (`x=1.5cm`).
> **The Bug**: We were injecting the result as `x=1.5cm, x=1cm`. This is **invalid TikZ syntax**. TikZ expects options to be wrapped in square brackets `[...]` or passed as a command argument. Loose text inside the environment is treated as... text? Or just ignored as garbage.
> **The Fix**: The Merger must explicitly **re-wrap** the combined string.
> ```typescript
> const finalOptions = `[${combined}]`; // MANDATORY
> ```
> **Rule**: **Any transformation that unwraps a container must re-wrap it before final injection.**
>
> ### 17. The Wrapper Preservation Protocol (v1.9.99)
> > **Problem**: TikZ diagrams wrapped in `\begin{figure}` were being deleted by the "Flattening" logic (which aggressively stripped float environments).
> > **The Fix**: We upgraded the flattening logic to be **Non-Destructive**.
> > - `\begin{figure}` -> `<div class="latex-figure-wrapper">`
> > - `\caption{...}` -> `<div class="caption">...</div>`
> > - **Result**: The diagram remains visible, and its caption is rendered correctly below it. We never delete semantic wrappers, only translate them.

### 17. The Vertical Layout Crisis (v1.9.45 - v1.9.48)

A complex saga of scaling issues involving "Hyper Boost", "Modernization", and "Compression".

#### Phase A: Hyper Boost Taming (v1.9.45)
> **Problem**: The "Goldilocks Protocol" (Section 10) was aggressively boosting `y=` coordinates for Text-Heavy diagrams (`x=2.2cm`) to prevent horizontal explosion. However, it *also* boosted `y` to `1.5cm` by default, causing vertical flowcharts to look like skyscrapers.
> **The Fix**:
> 1.  **Exclusion**: If the user (or AI) provides an **Explicit** `node distance`, the Goldilocks Y-Boost is **SKIPPED**. We trust the explicit distance.
> 2.  **Relaxation**: The `y` default fallback was reduced from `1.5cm` to `1.2cm`.

#### Phase A.5: The Semantic Shift (The "Modernization" Trap)
> **Problem**: To fix overlapping nodes, we "Modernized" syntax: `below of=node` (Center-to-Center) became `below=of node` (Edge-to-Edge).
> **Side Effect**: A `node distance=3cm` implies 3cm between *centers* in the old syntax (tight). In the new syntax, it means 3cm between *edges* (huge gaps). This caused diagrams to expand vertically by 2-3x, creating the illusion of a scaling bug.

#### Phase B: The Failed "Modernization Compensation" (v1.9.47)
> **Attempt**: We tried to detect "Modernization" and surgically halve the `node distance` (e.g., 3cm -> 1.5cm) to restore original density.
> **Failure**: The regex-based injection was flaky and caused regression risks. It was reverted.

#### Phase C: Global Compression (v1.9.46 - The Final Solution)
> **The Fix**: Instead of surgical micro-management, we re-introduced a simple **Global Compression** rule for Relative Layouts.
> **Logic**:
> - If `verticalSpan == 0` (Relative Positioning) AND `node distance` is Explicit:
> - **Force `y=0.5cm`**.
> **Why**: Relative positioning relies on `node distance` for the macro layout. The `y` unit only affects `+(0, y)` shifts (like separate title nodes). Compressing `y` ensures titles don't float away, while the `node distance` (kept at 2.8cm-3cm) handles the main flow.

### 19. The Academic Color Polyfill (v1.9.87)

**Problem**: The minimal TikZJax environment crashes if undefined colors (like `darkgreen`) are used. Furthermore, standard RGB red/green/blue look unprofessional.

**The Solution**: We inject a **"Color Polyfill"** block into every `\begin{tikzpicture}` environment that:
1.  **Redefines** standard primaries to "Prestige Shades" (`red` -> `Maroon`, `blue` -> `Navy`).
2.  **Defines** commonly hallucinated colors (`darkgreen`, `orange`, `purple`) to prevent crashes.

```latex
\definecolor{red}{rgb}{0.6,0,0}      % Maroon
\definecolor{blue}{rgb}{0,0,0.6}     % Navy Blue
\definecolor{green}{rgb}{0,0.4,0}    % Forest Green
\definecolor{darkgreen}{rgb}{0,0.4,0} % Defined!
```

**Result**: We no longer trust the AI to validly pick colors. We guarantee rigor at the engine level.

### 20. The Library Sanitization Protocol (v1.9.128)

**Problem**: AI models, when asked to generate a TikZ diagram, often include `\usetikzlibrary{...}` inside the enhancement content.
- **Issue**: Converting this directly to LaTeX puts `\usetikzlibrary` inside the `\section` body (after `\begin{document}`).
- **Consequence**: LaTeX throws an error or warning ("Can only be used in preamble").

**The Solution**: We implemented a **Pre-Generation Sanitizer** (`sanitizeTikzLibraries`) in `latexGenerator.ts`.
1.  **Scan**: Before generating ANY LaTeX, we iterate through all enabled enhancements.
2.  **Extract**: We find all `\usetikzlibrary{...}` calls in the content.
3.  **Collect**: We add the found libraries to a global `Set<string>` (deduplicated).
4.  **Strip**: We remove the `\usetikzlibrary` lines from the enhancement content.
5.  **Inject**: We inject the collected libraries into the **Preamble** (`\usetikzlibrary{...}`) before `\begin{document}`.

**Result**: Libraries are loaded correctly in the preamble, and the diagram code in the body stays clean.
