/**
 * TikZ Engine for LaTeX Preview
 * 
 * EXTRACTED FROM: LatexPreview.tsx
 * SCOPE: TikZ extraction, sanitization, and iframe generation (Hybrid Intent Engine).
 * RULE: EXACT COPY of logic. Do not modernize.
 */

export interface TikzResult {
    sanitized: string;
    blocks: Record<string, string>;
}

export function processTikz(latex: string): TikzResult {
    let content = latex;
    const blocks: Record<string, string> = {};
    let blockCount = 0;

    // === HELPER: Create TikZ iframe block (FULL INTENT ENGINE) ===
    const createTikzBlock = (tikzCode: string, options: string = ''): string => {
        const id = `LATEXPREVIEWTIKZ${blockCount++}:`;
        if (tikzCode.includes('\\begin{axis}') || tikzCode.includes('\\addplot')) {
            blocks[id] = `<div class="latex-placeholder-box warning">⚠️ Complex diagram (pgfplots) - not supported in browser preview</div>`;
            return `\n\n${id}\n\n`;
        }

        // --- ACADEMIC COLOR PALETTE POLYFILL (v1.9.87) ---
        // 1. Fixes crashes (undefined 'darkgreen')
        // 2. Enforces professional aesthetics (replaces bright RGB primaries with "Prestige" shades)
        const colorPolyfill = `
\\definecolor{red}{rgb}{0.6,0,0}      % Maroon
\\definecolor{blue}{rgb}{0,0,0.6}     % Navy Blue
\\definecolor{green}{rgb}{0,0.4,0}    % Forest Green
\\definecolor{darkgreen}{rgb}{0,0.4,0} % Fix for commonly hallucinated color
\\definecolor{navy}{rgb}{0,0,0.5}
\\definecolor{purple}{rgb}{0.5,0,0.5}
\\definecolor{orange}{rgb}{0.8,0.4,0}

% --- Aliases for Capitalized Names (Common Confusion) ---
\\definecolor{Navy}{rgb}{0,0,0.5}
\\definecolor{NavyBlue}{rgb}{0,0,0.5}
\\definecolor{Maroon}{rgb}{0.6,0,0}
\\definecolor{ForestGreen}{rgb}{0,0.4,0}
\\definecolor{Teal}{rgb}{0,0.5,0.5}
\\definecolor{DarkGreen}{rgb}{0,0.4,0}
`;

        // Inject right after \begin{tikzpicture}[options] or at the start if bare
        // We simply prepend it to the code body because TikZ environments usually allow definitions at the start
        let processedCode = tikzCode;
        if (processedCode.includes('\\begin{tikzpicture}')) {
            processedCode = processedCode.replace(/(\\begin\{tikzpicture\}(?:\[.*?\])?)/, `$1\n${colorPolyfill}`);
        } else {
            // Fallback for bare code fragments (unlikely but safe)
            processedCode = colorPolyfill + processedCode;
        }

        // SANITIZATION: TikZJax (btoa) crashes on Unicode. Force ASCII.
        let safeTikz = processedCode.replace(/[^\x00-\x7F]/g, '');

        // Robust Fix for Fonts inside Nodes
        safeTikz = safeTikz
            .replace(/\\%/g, 'LATEXPREVIEWPERCENT') // Protect escaped percents
            .replace(/%.*$/gm, '') // CRITICAL: Strip comments before flattening newlines
            .replace(/LATEXPREVIEWPERCENT/g, '\\%') // Restore escaped percents
            .replace(/\\textbf\s*\{/g, '{\\bfseries ')
            .replace(/\\textit\s*\{/g, '{\\itshape ')
            .replace(/\\sffamily/g, '') // Crash prevention
            .replace(/\\rmfamily/g, '')
            .replace(/\\ttfamily/g, '')
            // FIX (v1.9.127): Whitelist approach for \\n handling
            // OLD: /\\n(?![a-zA-Z])/g - This failed for "Value\nproposition" because 'p' is a letter
            // NEW: Only protect KNOWN commands: \node, \newline, \newcommand, \newenvironment, \noindent
            .replace(/\\n(?!ode|ewline|ewcommand|ewenvironment|oindent|umber|olimits)/g, ' ')
            .replace(/\n/g, ' ');

        // SANITIZATION: Remove enumitem/itemize which crashes TikZJax in nodes
        // 1. Remove [leftmargin=*] or similar params
        safeTikz = safeTikz.replace(/\\begin\{itemize\}\[[^\]]*\]/g, '\\begin{itemize}');

        // 2. Replace itemize with manual bullets (Fake List) because TikZJax interaction with Lists inside Nodes is flaky
        if (safeTikz.includes('\\begin{itemize}')) {
            safeTikz = safeTikz
                .replace(/\\begin\{itemize\}/g, '')
                .replace(/\\end\{itemize\}/g, '')
                .replace(/\\item\s+/g, '\\par $\\bullet$ ');
        }

        // DEBUG LOGGING (To confirm fix runs in browser)
        console.log("[LatexPreview TikZ Fix] Original:", tikzCode.substring(0, 50));
        console.log("[LatexPreview TikZ Fix] Safe:", safeTikz.substring(0, 50));

        // FIX (v1.6.10): Escape ampersands in TikZ code using simpler direct approach
        // LaTeX interprets & as alignment tab in tables. In TikZ node text, we need \&
        // Direct pattern replacements (order matters!)
        safeTikz = safeTikz.replace(/\\\\&/g, '\\\\ \\&'); // \\& → \\ \& (linebreak + space + escaped ampersand)
        safeTikz = safeTikz.replace(/([^\\])&/g, '$1\\&'); // raw & → \& (but not already escaped)

        // FIX (v1.9.37): Modernize Deprecated Positioning Syntax (The "Overlap" Fix)
        // AI often writes `right of=node` (center-to-center) instead of `right=of node` (edge-to-edge).
        // With large nodes and small distances, this causes severe overlap.
        // We auto-correct this if the 'positioning' library is used (implied by our standard env).

        // FIX (v1.9.47): Modernization Compensation Flag
        // If we modernize, we change semantics from Center-to-Center to Edge-to-Edge.
        // This effectively ADDS a node width/height to the gap.
        // We must detect this to compensate the `node distance` later.
        // NOTE: Use .search() or .match() without global flag to avoid statefulness issues.
        const modernizedMatch = safeTikz.match(/right\s+of\s*=|left\s+of\s*=|above\s+of\s*=|below\s+of\s*=/);
        const isModernized = !!modernizedMatch;

        if (isModernized) console.warn('[IntentEngine Debug] Modernization Detected! Match:', modernizedMatch ? modernizedMatch[0] : 'null');

        safeTikz = safeTikz
            .replace(/right\s+of\s*=/g, 'right=of ')
            .replace(/left\s+of\s*=/g, 'left=of ')
            .replace(/above\s+of\s*=/g, 'above=of ')
            .replace(/below\s+of\s*=/g, 'below=of ');

        // FIX (v1.9.44): Auto-Math Mode for Arrows using \ensuremath
        // AI often writes "\rightarrow" in text mode inside nodes, causing "! Missing $ inserted".
        // \ensuremath{\rightarrow} renders correctly in both text mode ($...$) and math mode.
        safeTikz = safeTikz
            .replace(/\\rightarrow/g, '\\ensuremath{\\rightarrow}')
            .replace(/\\leftarrow/g, '\\ensuremath{\\leftarrow}')
            .replace(/\\Rightarrow/g, '\\ensuremath{\\Rightarrow}')
            .replace(/\\Leftarrow/g, '\\ensuremath{\\Leftarrow}')
            .replace(/\\leftrightarrow/g, '\\ensuremath{\\leftrightarrow}')
            .replace(/\\Leftrightarrow/g, '\\ensuremath{\\Leftrightarrow}');



        // GEOMETRIC POLYFILL: Manual Bezier Braces for TikZJax
        // TikZJax cannot handle decoration={brace}, so we draw it manually.
        // FIX (v1.6.21): Made regex robust against whitespace (e.g., "decorate, decoration")
        // FIX (v1.9.136): Made regex robust against trailing options (e.g. "}, thick]")
        // Also captures and preserves these options (tailOpts).
        safeTikz = safeTikz.replace(
            /\\draw\[\s*decorate\s*,\s*decoration\s*=\s*\{\s*brace([^}]*)\}([^\]]*?)\]\s*\(([^)]+)\)\s*--\s*\(([^)]+)\)\s*node\[([^\]]*)\]\s*\{([\s\S]*?)\};/g,
            (match, decoOpts, tailOpts, start, end, nodeOpts, label) => {
                const isMirror = decoOpts && decoOpts.includes('mirror');
                const parseCoord = (s: string) => {
                    const parts = s.split(',').map(p => parseFloat(p.trim()));
                    return { x: parts[0] || 0, y: parts[1] || 0 };
                };
                const p1 = parseCoord(start); const p2 = parseCoord(end);

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const isVertical = Math.abs(dy) > Math.abs(dx);

                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;

                // Curvature calculation
                // Horizontal: +Y is "Up" (Standard), -Y is "Down" (Mirror?) - TikZ default is Up? Actually default brace is usually "top".
                // Vertical: -X is "Left", +X is "Right".
                // Heuristic: We use a default amplitude factor.

                let c1x, c1y, c2x, c2y, c3x, c3y, tipX, tipY;
                const mag = 0.15; // amplitude base
                const tipMag = 0.35; // tip height

                // Direction multiplier
                const dir = isMirror ? -1 : 1;

                if (isVertical) {
                    // Vertical Brace (offsets on X)
                    const sign = -1 * dir; // Default -1 (Left)

                    c1x = p1.x + (sign * mag); c1y = p1.y;
                    c2x = midX + (sign * mag); c2y = midY;
                    tipX = midX + (sign * tipMag); tipY = midY;
                    c3x = p2.x + (sign * mag); c3y = p2.y;

                    // Label position: Further out in X
                    const labelX = midX + (sign * (tipMag + 0.6)); // v1.6.28 Boosted Offset
                    const labelY = midY;

                    return `\\draw[thick${tailOpts}] (${p1.x},${p1.y}) .. controls (${c1x},${c1y}) and (${c2x},${c2y}) .. (${tipX},${tipY}) .. controls (${c2x},${c2y}) and (${c3x},${c3y}) .. (${p2.x},${p2.y}); \\node[${nodeOpts}] at (${labelX},${labelY}) {${label}};`;
                } else {
                    // Horizontal Brace (offsets on Y)
                    const sign = 1 * dir; // Default +1 (Up)

                    c1x = p1.x; c1y = p1.y + (sign * mag);
                    c2x = midX; c2y = midY + (sign * mag);
                    tipX = midX; tipY = midY + (sign * tipMag);
                    c3x = p2.x; c3y = p2.y + (sign * mag);

                    const labelX = midX;
                    const labelY = midY + (sign * (tipMag + 0.6)); // v1.6.28 Boosted Offset

                    return `\\draw[thick${tailOpts}] (${p1.x},${p1.y}) .. controls (${c1x},${c1y}) and (${c2x},${c2y}) .. (${tipX},${tipY}) .. controls (${c2x},${c2y}) and (${c3x},${c3y}) .. (${p2.x},${p2.y}); \\node[${nodeOpts}] at (${labelX},${labelY}) {${label}};`;
                }
            }
        );

        const nodeMatches = safeTikz.match(/\\node/g) || [];
        const drawMatches = safeTikz.match(/\\draw/g) || [];
        const arrowMatches = safeTikz.match(/->/g) || [];

        // HEURISTIC: Extract ACTUAL node label text (not TikZ options)
        // FIX (v1.9.108): Improved Regex to capture edge 'nodes' and nested braces
        // Matches \node or ' node', allows attributes until brace, handles 1 level of nesting.
        const nodeLabelMatches = safeTikz.match(/(?:\\node|\snode)[^;{]*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g) || [];
        let totalLabelText = 0;
        nodeLabelMatches.forEach(match => {
            const labelMatch = match.match(/\{([^}]*)\}$/);
            if (labelMatch) {
                // Remove LaTeX formatting commands from label
                const label = labelMatch[1].replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '');
                totalLabelText += label.length;
            }
        });
        const avgLabelTextPerNode = nodeMatches.length > 0 ? totalLabelText / nodeMatches.length : 0;

        // Legacy metrics for compatibility
        const rawText = safeTikz.replace(/\\[a-zA-Z]+/g, '').replace(/[{}()\[\]]/g, '');
        const textDensityScore = nodeMatches.length > 0 ? (rawText.length / nodeMatches.length) : 0;
        const isTextHeavy = avgLabelTextPerNode > 20; // v1.9.107: Lowered from 30 to catch verbose labels
        const baseComplexity = nodeMatches.length + drawMatches.length + (arrowMatches.length / 2);

        // NEW (v1.5.6): Detect WIDE and FLAT diagrams using absolute positioning
        // Extract ALL (x,y) coordinate pairs from the TikZ code (not just "at" patterns)
        // This captures: \node at (x,y), \draw (x,y) -- (x,y), \fill (x,y), etc.
        const allCoordMatches = safeTikz.match(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g) || [];
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        allCoordMatches.forEach(m => {
            const coords = m.match(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
            if (coords) {
                const x = parseFloat(coords[1]);
                const y = parseFloat(coords[2]);
                if (!isNaN(x)) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                }
                if (!isNaN(y)) {
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
            }
        });
        // NEW (v1.9.80): Scope Shift Heuristic
        // Regex misses "xshift=6cm" and treats scopes as overlapping (0,0).
        // We accumulate max shifts to adjust the bounding box estimation.
        const xShifts = (safeTikz.match(/xshift\s*=\s*(-?[\d.]+)\s*(?:cm)?/g) || [])
            .map(s => parseFloat(s.match(/xshift\s*=\s*(-?[\d.]+)/)![1]));
        const yShifts = (safeTikz.match(/yshift\s*=\s*(-?[\d.]+)\s*(?:cm)?/g) || [])
            .map(s => parseFloat(s.match(/yshift\s*=\s*(-?[\d.]+)/)![1]));

        if (xShifts.length > 0) {
            const maxShift = Math.max(0, ...xShifts);
            const minShift = Math.min(0, ...xShifts);
            if (isFinite(maxX)) maxX += maxShift;
            if (isFinite(minX)) minX += minShift;
        }
        if (yShifts.length > 0) {
            const maxShift = Math.max(0, ...yShifts);
            const minShift = Math.min(0, ...yShifts);
            if (isFinite(maxY)) maxY += maxShift;
            if (isFinite(minY)) minY += minShift;
        }

        const horizontalSpan = (maxX !== -Infinity && minX !== Infinity) ? (maxX - minX) : 0;
        const verticalSpan = (maxY !== -Infinity && minY !== Infinity) ? (maxY - minY) : 0;
        const isWideHorizontal = horizontalSpan > 14; // > 14cm exceeds A4 safe width
        // NEW (v1.5.7): Detect FLAT diagrams (timeline-style) with extreme aspect ratio
        const aspectRatio = verticalSpan > 0 ? horizontalSpan / verticalSpan : 0;
        const isFlat = horizontalSpan > 0 && verticalSpan > 0 && aspectRatio > 3.0;

        // REFACTOR (v1.5.5): HYBRID INTENT (Phase 7 + Density Override)
        // We analyze the AI's *intent* based on 'node distance', BUT we fallback to 
        // text density if the distance is missing (to catch implicit "Large" layout).
        // See TIKZ_HANDLING.md for the "8.4cm" magic number.

        let intent = 'MEDIUM'; // Default
        let nodeDist = 2.0; // Default assumption if missing

        // 1. EXTRACT INTENT
        const distMatch = options.match(/node distance\s*=\s*([\d\.]+)/);
        if (distMatch) {
            nodeDist = parseFloat(distMatch[1]);

            // FIX (v1.9.47): Modernization Compensation
            // If we detected legacy syntax (`below of=`), we changed semantics to Edge-to-Edge (`below=of`).
            // This makes gaps HUGE. We must reduce the user's distance to approximate the original Center-to-Center intent.
            // Heuristic: reduce by 50% (assuming node size ~= distance).
            if (isModernized) {
                console.log(`[IntentEngine] Modernization Compensation Active: Reducing node distance ${nodeDist}cm -> ${nodeDist * 0.5}cm`);
                nodeDist = nodeDist * 0.5;
            }
        }

        // 2. CLASSIFY
        // Priority: FLAT > LARGE (Absolute) > node distance > text density > node count
        // UNIFICATION (v1.6.29): All Absolute Layouts (Span > 0) use LARGE (Density Engine) logic.
        // This allows the "Vertical Boost" (v1.6.28) to apply to "Wide" diagrams too, fixing the squashed look.

        if (horizontalSpan > 0) {
            // FIX (v1.9.15): Harmonized FLAT Intent
            // "Auditor Protocol": If it's a Timeline (Aspect Ratio > 3.0), we MUST override coordinates
            // to scale it up (x=1.5x) and balance the height (y=2.0x).
            // Preserving user coordinates (4:1 ratio) caused "Massive Whitespace". 
            // We force a friendlier aspect ratio (approx 2:1) to fill the visual slot.
            if (isFlat) intent = 'FLAT'; // Timeline-style (Extreme aspect ratio)
            else intent = 'LARGE';       // Absolute Layout (includes WIDE) -> Uses Adaptive Density + Vertical Boost
            console.log(`[IntentEngine] Span: (${horizontalSpan}x${verticalSpan}), Ratio: ${aspectRatio.toFixed(2)}, isFlat: ${isFlat}, Intent: ${intent}`);
        } else if (distMatch) {
            // Explicit intent wins (Relative Layouts)
            // FIX (v1.9.107): Text-Heavy Diagrams Must Breathe
            // If explicit distance is provided but "text heavy" (avg len > 30),
            // and the distance is suspiciously small (< 3.0), implicit upgrade to LARGE
            // to activate the "Bifurcated Safety Net" override.
            if (isTextHeavy && nodeDist < 3.0) intent = 'LARGE';
            else if (nodeDist < 2.0) intent = 'COMPACT';
            else if (nodeDist >= 2.5) intent = 'LARGE';

        } else {
            // Implicit intent (Inference for Relative Layouts)
            if (isTextHeavy) intent = 'LARGE'; // Text-heavy = Cycle = Large
            else if (nodeMatches.length >= 8) intent = 'COMPACT'; // Many nodes = Pipeline = Compact
        }

        // FIX (v1.9.127): Detect bend paths early - needed for node distance capping
        const hasBendPath = safeTikz.includes('bend ') || safeTikz.includes('bend=');

        // 3. EXECUTE RULES (The Table)
        let extraOpts = '';

        if (intent === 'COMPACT') {
            // GOAL: Fit to A4
            const scale = nodeMatches.length >= 8 ? 0.75 : 0.85;
            if (!options.includes('scale=')) extraOpts += `, scale=${scale}`;
            // EXEMPTION REMOVED (v1.6): Explicit coordinates should still scale text proportionally in Compact mode
            if (!options.includes('transform shape')) extraOpts += ', transform shape';
            if (!options.includes('node distance')) extraOpts += ', node distance=1.5cm';

        } else if (intent === 'LARGE') {
            // GOAL: Readability & Maximize Spacing
            // PROBLEM: AI often sets tiny grids (x=0.8cm) which cause text overlap.
            // SOLUTION (v1.6.22): Ignore AI's grid. Force expansion to fill available space (25cm budget - v1.6.25/27).

            // Width Budget: 25cm (allows expansion for Zoom Engine)
            const optimalUnit = Math.min(2.5, 25 / (horizontalSpan || 1));

            // FIX (v1.6.25): Adaptive Clamp
            // OLD: const dynamicClamp = horizontalSpan > 7 ? 1.8 : 1.3;
            // FIX (v1.9.83): Continuous Adaptive Scaling (The "Analog Slope")
            // The step function created a "Cliff": Span 6 -> 1.3 (7.8cm), Span 8 -> 1.8 (14.4cm).
            // We now target a "Sweet Spot" visual width (e.g., 12cm) to ensure consistent readability.
            // Formula: scale = TargetWidth / Span.
            // Clamp: [1.3, 2.2] to ensure small diagrams get boosted but we don't explode.
            const targetWidth = 12; // cm
            const continuousScale = horizontalSpan > 0 ? (targetWidth / horizontalSpan) : 1.8;
            const dynamicClamp = Math.min(2.5, Math.max(1.3, continuousScale));

            // FIX (v1.6.31/v1.6.38): Adaptive Y-Axis Scaling (The "Goldilocks" Vertical)
            // Problem: "Universal Boost" (y=2.2) exploded tall diagrams. "Symmetry" squashed short ones.
            // Solution: Calculate yUnit based on Vertical Span to target a specific physical height.
            // v1.6.38: If verticalSpan == 0 (Relative Layout), force y=0.5 for title compression.
            // v1.6.40: Reduced targetHeight from 12cm to 8cm to reduce excessive empty space.
            // FIX (v1.9.45): If user provided explicit `node distance` (distMatch), use y=1.0 (standard units)
            // instead of y=0.5 (squashing).
            // UPDATE (v1.9.47): Reverted v1.9.46 (Blind Compression). 
            // We now handle compression via "Modernization Compensation" (see below), so we can trust standard y=1.0.
            const targetHeight = 8; // cm 
            const hasExplicitDist = !!options.match(/node distance\s*=\s*[\d\.]+/);
            const rawY = verticalSpan > 0
                ? (targetHeight / verticalSpan)
                : (hasExplicitDist ? 1.0 : 0.5);

            // Clamp Y: Min 1.0cm (v1.6.40: lowered from 1.3 for tighter packing), Max 1.8cm (lowered from 2.2)
            // Note: If rawY is exactly 0.5 or 1.0 from our branching above, we preserve it.
            let yUnit = (rawY <= 1.0 && verticalSpan === 0) ? rawY : Math.min(1.8, Math.max(1.0, rawY));

            // FIX (v1.9.80): Plot Safety Protocol
            // If the diagram contains a `plot` command, the "Goldilocks" vertical scaling is DANGEROUS.
            // Additionally, mixing x=1.8 (fill width) with y=1.0 (safety) distorts the geometry (elliptical circles).
            // Mathematical plots require Square Scaling (Aspect Ratio 1:1).
            const hasPlot = safeTikz.includes('\\plot') || safeTikz.includes('plot ') || safeTikz.includes('plot(');

            let xUnit = Math.min(dynamicClamp, optimalUnit); // Default width expansion

            if (hasPlot) {
                console.log('[IntentEngine] Plot Detected: Enforcing 1:1 Scale (x=1, y=1) to prevent blowout & distortion.');
                yUnit = 1.0;
                xUnit = 1.0;


                // FIX (v1.9.81 - v1.9.82): Auto-Clip Unbounded Plots (THE LOCAL FIX)
                // Global clipping cuts off axis labels (e.g. "Speed S") that extend beyond explicit coords.
                // We must ONLY clip the `plot` command itself, leaving other nodes/axes untouched.
                if (minX !== Infinity && maxX !== -Infinity && minY !== Infinity && maxY !== -Infinity) {
                    const pad = 0.5; // Small padding just for line thickness
                    const clipCmd = `\\clip (${minX - pad},${minY - pad}) rectangle (${maxX + pad},${maxY + pad});`;

                    console.log(`[IntentEngine] Injecting Local Safety Clip around plots.`);

                    // Regex to find \draw ... plot ... ; commands
                    // Note: We use [\s\S] to match across newlines
                    // We wrap the matches in a scope with the clip
                    safeTikz = safeTikz.replace(
                        /(\\draw[^;]+plot[\s\S]+?;)/g,
                        (match) => `\\begin{scope}\n${clipCmd}\n${match}\n\\end{scope}`
                    );
                }
            }

            // FIX (v1.6.39): RESTORED - This line was accidentally removed in v1.6.38!
            extraOpts += `, x=${xUnit.toFixed(2)}cm, y=${yUnit.toFixed(2)}cm`;

            // Restore missing font setting (likely lost in v1.6.29 refactor)
            if (!options.includes('font=')) extraOpts += ', font=\\small';

            // For diagrams using 'node distance' (not absolute coords), we must inject spacious defaults.
            // FIX (v1.6.5): Use consistent targetDist calculation for both branches
            // NOTE (v1.6.12): Title gap is now fixed via y=0.5cm injection, so node distance can remain at 8.4cm
            // FIX (v1.9.127): Bend Path Safety - Cap distance to prevent TikZjax "Dimension too large" overflow
            const targetDist = hasBendPath ? 5.0 : (isTextHeavy ? 8.4 : 5.0);

            if (hasBendPath) {
                console.log(`[IntentEngine] Bend Path Detected: Capping node distance at ${targetDist}cm to prevent dimension overflow.`);
            }

            if (!options.includes('node distance')) {
                // If we forced LARGE due to text density, we use the proven magic number
                extraOpts += `, node distance=${targetDist}cm`;
            } else {
                // FIX (v1.6.37): The Bifurcated Safety Net.
                // Problem: v1.6.36 used a 2.5cm threshold, but Cycle diagrams with `node distance=3cm` were still squashed.
                // Solution: We split the logic completely based on `isTextHeavy`.

                if (isTextHeavy) {
                    // STRATEGY: Aggressive Protection (Restore v1.6.5 behavior)
                    // Text-heavy nodes need massive space. 3cm is NOT enough.
                    // If the provided distance is less than our target (8.4cm), we FORCE the boost.
                    // FIX (v1.9.45): Relaxed threshold to 2.8cm to respect user's explicit 3cm choice.
                    // 3cm is a common choice for vertical flowcharts.
                    if (nodeDist < 2.8) {
                        extraOpts += `, node distance=${targetDist}cm`;
                    }
                } else {
                    // STRATEGY: Permissive Respect (Preserve v1.6.35 behavior)
                    // Light nodes (Pipelines) look good packed tight (e.g. 0.8cm).
                    // We only interfere if it's absurdly small (< 0.5cm).
                    if (nodeDist < 0.5) {
                        extraOpts += `, node distance=${targetDist}cm`;
                    }
                }
            }

            // Mandatory for Large
            // FIX (v1.6.32): Adaptive Node Inflation. Link Padding to Vertical Boost.
            // Mandatory for Large: Alignment
            if (!options.includes('text width')) extraOpts += ', every node/.append style={align=center}';

            // Remove explicit scale if we are handling it via x/y
            // But keep transform shape if checking for safety? 
            // Actually, with expanded grid, we usually DON'T want transform shape (keep text standard size)
            // So we do nothing else.

        }

        // Prepare for stripping (Lifted Scope)
        let processedOptions = options.trim();

        if (intent === 'WIDE') {
            // GOAL: Fit wide horizontal pipeline to A4 width
            // Calculate scale factor: target 14cm max width for A4 content area
            const targetWidth = 14; // cm - safe A4 content width
            const scaleFactor = Math.min(1.0, targetWidth / horizontalSpan);
            const scale = Math.max(0.5, scaleFactor * 0.9); // Floor at 0.5x, apply 0.9 buffer

            if (!options.includes('scale=')) extraOpts += `, scale=${scale.toFixed(2)}`;
            // MUST use transform shape to shrink nodes proportionally
            if (!options.includes('transform shape')) extraOpts += ', transform shape';

        } else if (intent === 'FLAT') {
            // GOAL: Balance extreme aspect ratio (timeline diagrams)
            // A 5:1 ratio looks compressed; target ~2:1 for visual balance
            const targetRatio = 2.0;
            const yBoost = aspectRatio / targetRatio; // e.g., 5:1 / 2:1 = 2.5x boost
            const yMultiplier = Math.min(3.0, Math.max(1.5, yBoost)); // Clamp between 1.5x and 3x
            const xMultiplier = 1.5; // 50% horizontal expansion for label spacing

            // Extract existing x/y values from options (if present) and multiply them
            const existingX = options.match(/x\s*=\s*([\d.]+)/);
            const existingY = options.match(/y\s*=\s*([\d.]+)/);
            const baseX = existingX ? parseFloat(existingX[1]) : 1.0;
            const baseY = existingY ? parseFloat(existingY[1]) : 1.0;

            const newX = (baseX * xMultiplier).toFixed(1);
            const newY = (baseY * yMultiplier).toFixed(1);

            // STRIP OLD VALS FIRST
            processedOptions = processedOptions.replace(/,?\s*x\s*=\s*[\d.]+\s*(cm)?/gi, '');
            processedOptions = processedOptions.replace(/,?\s*y\s*=\s*[\d.]+\s*(cm)?/gi, '');

            // Clean up commas
            processedOptions = processedOptions.replace(/,\s*,/g, ',').replace(/\[\s*,/g, '[').replace(/,\s*\]/g, ']');

            console.log(`[IntentEngine] FLAT: x=${newX}cm, y=${newY}cm (baseX=${baseX}, baseY=${baseY}, xMult=${xMultiplier}, yMult=${yMultiplier.toFixed(2)})`);

            // Add new vals
            extraOpts += `, x=${newX}cm, y=${newY}cm, scale=1.0`;

            // FIX (v1.6.41): Add font reduction
            if (nodeMatches.length >= 5 && !options.includes('font=')) {
                extraOpts += ', font=\\small';
            }

        } else {
            // MEDIUM

            // SMART SCALING (v1.5.8): Trust the user's layout if it fits in A4
            let scale = 0.9;
            if (horizontalSpan > 0 && horizontalSpan <= 14) {
                scale = 1.0; // Fits perfectly, don't shrink
            } else {
                // Fallback or too wide
                scale = nodeMatches.length >= 6 ? 0.8 : 0.9;
            }

            // EXEMPTION: Don't scale if diagram has explicit x= or y= coordinates (already sized)
            if (!options.includes('scale=') && !options.includes('x=') && !options.includes('y=')) extraOpts += `, scale=${scale}`;

            // NEW (v1.6): Intelligent Explicit Scaling covering Un-encountered Situations
            // If user provides explicit coordinates (x=, y=), we must enforce proportional scaling 
            // (transform shape) to prevent "Huge Text / Tiny Grid" overlap.
            const hasExplicitScale = options.includes('x=') || options.includes('y=');
            if (hasExplicitScale && !options.includes('transform shape')) {
                extraOpts += ', transform shape';
            }

            // Only inject default distance if not provided
            if (!options.includes('node distance')) extraOpts += ', node distance=2.5cm';
        }

        // GOLDILOCKS PROTOCOL: Coordinate Boost for text-heavy diagrams (Global Scope)
        // RECOVERED from Artifacts: x=2.2cm (Resolve Label Overlap), y=1.5cm (Increase Height)
        // UNIVERSAL FIX (v1.5.8): Only boost if span is unknown OR small (Index-Based < 7)
        // FIX (v1.6.12): EXCLUDE LARGE intent - it uses node distance, not coordinate scaling
        // FIX (v1.6.17): EXCLUDE ABSOLUTE POSITIONING (`horizontalSpan > 0`). If user provides explicit coords,
        // we must not distort the grid. Only boost "Relative/Index" layouts (span === 0).
        const isRelativeOrIndex = horizontalSpan === 0;

        // FIX (v1.9.45): HYPER BOOST TAMING
        // User reported "Hyper Boost" on Y-axis for vertical flowcharts.
        // If user provides explicit `node distance`, we MUST NOT override `y=` scale,
        // because `below of=` uses node distance, but `y=` changes the unit vector.
        // We only boost X to ensure text width accommodation.
        const hasNodeDistance = options.includes('node distance');

        if (isTextHeavy && !options.includes('x=') && isRelativeOrIndex && intent !== 'LARGE') {
            // If node distance is set, only boost X. Trust Y to the user.
            if (hasNodeDistance) {
                extraOpts += ', x=2.2cm';
            } else {
                extraOpts += ', x=2.2cm, y=1.2cm'; // Reduced from 1.5cm
            }
        }

        // LARGE INTENT: Strip node distance if we're overriding it (v1.6.5, v1.6.12 adaptive)
        if (intent === 'LARGE') {
            // Use same adaptive formula as above (v1.9.127: Cap for bend paths)
            const targetDist = hasBendPath ? 5.0 : (isTextHeavy ? 8.4 : 5.0);
            const distMatch = options.match(/node distance\s*=\s*([\d\.]+)/);
            if (distMatch) {
                const existingDist = parseFloat(distMatch[1]);

                // FIX (v1.9.38): Align Stripping with Bifurcated Safety Net (v1.6.37)
                // Previously, we stripped simply if existing < target (e.g. 3.5 < 5.0).
                // But we only INJECT if existing < 0.5 (for Light).
                // This caused "Permissive Respect" ranges (0.5 - 5.0) to lose their distance entirely.
                // FIX (v1.9.45): Aligned with new relaxed threshold (2.8cm).

                const shouldOverride = isTextHeavy
                    ? (existingDist < 2.8) // Relaxed Aggressive (Safe)
                    : (existingDist < 0.5);       // Permissive (Tight)

                if (shouldOverride) {
                    // Remove old node distance value (it'll be replaced with targetDist via extraOpts)
                    processedOptions = processedOptions.replace(/,?\s*node distance\s*=\s*[\d.]+\s*(cm)?/gi, '');
                    // Clean up any double commas or leading/trailing commas
                    processedOptions = processedOptions.replace(/,\s*,/g, ',').replace(/\[\s*,/g, '[').replace(/,\s*\]/g, ']');
                }
            }
        }

        // Merge logic (Refactored v1.9.15)
        // `processedOptions` is UNWRAPPED content (brackets stripped by extractor)
        // `extraOpts` contains our overrides (starting with comma)

        let combined = extraOpts.trim();
        if (processedOptions) {
            combined += (combined ? ',' : '') + processedOptions;
        }

        // Clean up commas/spaces
        combined = combined
            .replace(/^,/, '')      // Remove leading comma
            .replace(/,\s*,/g, ',') // Remove empty slots
            .replace(/,$/, '');     // Remove trailing comma

        let finalOptions = `[${combined}]`;

        console.log(`[IntentEngine] Final Options: ${finalOptions}`);
        const iframeHtml = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://tikzjax.com/v1/fonts.css">
  <script src="https://tikzjax.com/v1/tikzjax.js"></script>
  <style>
    /* RESPONSIVE SVG: The Holy Grail */
    body { 
      margin: 0; 
      padding: 0; 
      display: flex;
      flex-direction: column; /* Stack loading + diagram vertically */
      align-items: center;
      overflow: hidden; /* Hide scrollbars, let height grow */
      width: 100%;
    }
    svg { 
      width: auto !important; 
      height: auto !important; 
      max-width: 100% !important; 
      display: block;
      margin: 0 auto;
    }
    .tikzjax-container {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    /* Loading Placeholder Styles (v1.6.11) */
    .tikz-loading {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      box-sizing: border-box;
      color: #666;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      white-space: nowrap; /* Prevent text wrapping */
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
    .tikz-loading.hidden { display: none; }
  </style>
  <script>
    window.addEventListener('error', e => { if (e.message?.includes('message channel closed')) e.preventDefault(); });
    window.addEventListener('unhandledrejection', e => { if (e.reason?.message?.includes('message channel closed')) e.preventDefault(); });
  </script>
</head>
<body>
  <!-- Loading Placeholder (v1.6.11) -->
  <div id="tikz-loading" class="tikz-loading">
    <div>[ Generating diagram... ]</div>
  </div>
  <div class="tikzjax-container">
    <script type="text/tikz">
      \\usetikzlibrary{arrows,shapes,calc,positioning,decorations.pathreplacing}
      \\begin{tikzpicture}${finalOptions}
      ${safeTikz}
      \\end{tikzpicture}
    </script>
  </div>
  <script>
    // Iframe resize logic - HEIGHT ONLY
    // We let the width be 100% (controlled by parent), we only adapt height to fit content.
    const observer = new MutationObserver(() => {
      const svg = document.querySelector('svg');
      if (svg && window.frameElement) {
         // Hide loading placeholder once SVG appears (v1.6.11)
         const loading = document.getElementById('tikz-loading');
         if (loading) loading.classList.add('hidden');
         // Add a small buffer for tooltips/shadows, and Enforce Min-Height (100px)
         const rect = svg.getBoundingClientRect();
         const h = Math.max(rect.height + 25, 100); 
         window.frameElement.style.height = h + 'px';
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  </script>
</body>
</html>`;
        const srcdoc = iframeHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        // Wrapper must be 100% width to allow iframe to fill it
        blocks[id] = `<div style="display: flex; justify-content: center; width: 100%; margin: 1em 0;"><iframe srcdoc="${srcdoc}" style="border: none; width: 100%; overflow: hidden;"></iframe></div>`;
        return `\n\n${id}\n\n`;
    };

    // Extract TikZ (Loop Logic)
    let loopSafety = 0;
    while (content.includes('\\begin{tikzpicture}')) {
        if (loopSafety++ > 100) break;
        const startIdx = content.indexOf('\\begin{tikzpicture}');
        const endIdx = content.indexOf('\\end{tikzpicture}', startIdx);
        if (endIdx === -1) break;

        // Extract options
        let options = '';
        // (Simplification: assuming basic option parsing for brevity, or reuse complex one if needed)
        // For now, let's grab the body and basic options match
        const tagLen = '\\begin{tikzpicture}'.length;
        let bodyStart = startIdx + tagLen;
        // Check for [options]
        if (content[bodyStart] === '[') {
            const closeOpt = content.indexOf(']', bodyStart);
            if (closeOpt !== -1) {
                options = content.substring(bodyStart + 1, closeOpt);
                bodyStart = closeOpt + 1;
            }
        }

        const body = content.substring(bodyStart, endIdx);
        const placeholder = createTikzBlock(body, options);
        content = content.substring(0, startIdx) + placeholder + content.substring(endIdx + '\\end{tikzpicture}'.length);
    }

    return { sanitized: content, blocks };
}
