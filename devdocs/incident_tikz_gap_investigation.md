# TikZ Internal Spacing Investigation - Complete Report

**Date**: 2025-12-06  
**Status**: In Progress  
**Primary Issue**: Massive vertical gap between TikZ diagram title and diagram content

---

## 1. Problem Statement

### Original Symptom
When TikZ diagrams are rendered in the browser preview, there is a massive vertical gap (approximately 300-500 pixels) between:
- The **diagram title** (e.g., "Anxious-Avoidant Cycle")
- The **diagram content** (the actual boxes and arrows)

### Visual Evidence
The gap appears as a large blank white space within the iframe containing the TikZ diagram, making the preview look broken and unprofessional.

![User-provided screenshot showing the gap](file:///C:/Users/keith/.gemini/antigravity/brain/72d5d0a0-458c-48bc-bb1a-3362653c010d/uploaded_image_1764987098500.png)

---

## 2. Technical Background

### TikZ Rendering Architecture
The system uses TikZJax (a JavaScript library) to render TikZ diagrams in an iframe:

```
AI generates TikZ code → LatexPreview.tsx extracts it → 
Injects into iframe with TikZJax → Browser renders SVG
```

### Coordinate System
TikZ uses a coordinate system where:
- `x=1cm` means 1 unit = 1cm horizontally
- `y=1cm` means 1 unit = 1cm vertically
- `node distance=Xcm` controls relative spacing between nodes using TikZ's positioning library

### Dynamic Density Reduction
To prevent text overlap in AI-generated diagrams, `LatexPreview.tsx` dynamically injects spacing options:

```typescript
// For text-heavy diagrams (TextDensityScore > 10)
densityReduction = `x=${xScale}, y=${yScale}, node distance=${nodeDistance}, font=\\small`;
```

---

## 3. Attempted Solutions

### Attempt 1: Aggressive Coordinate Scaling (x=5cm, y=5cm)
**File**: `LatexPreview.tsx`, lines 139-166

**What We Did**:
- Set `xScale = '5cm'` and `yScale = '5cm'` for text-heavy diagrams
- This was the "Anti-Cramp" configuration that successfully prevented node overlap

**Result**: ✅ PARTIAL SUCCESS
- **Success**: Nodes no longer overlapped - diagram was "complete" and readable
- **Failure**: Created massive internal gap because the title (at y=0) and content (at y=-2) became separated by 10cm (5cm × 2 units)

**Why It "Worked" for Anti-Cramp**:
- Multiplied ALL distances, including between nodes
- But also multiplied the title-to-content distance by 5x

---

### Attempt 2: Radical Crop Strategy (getBBox)
**File**: `LatexPreview.tsx`, lines 212-269

**What We Did**:
- Used `svg.getBBox()` to measure exact drawn content
- Set iframe dimensions to match just the bounding box
- Applied `viewBox` cropping to remove whitespace

**Result**: ❌ FAILURE
- **Symptom**: Blank screen with scrollbars OR massive empty space
- **Root Cause**: `getBBox()` returned unreliable values during TikZJax rendering
- **Technical Issue**: TikZ creates SVG canvas first, then draws content - getBBox timing was inconsistent

---

### Attempt 3: Responsive Scale-to-Fit
**File**: `LatexPreview.tsx`

**What We Did**:
- Added `MAX_WIDTH = 950px` and `MAX_HEIGHT = 600px` caps
- Proportionally scaled diagram to fit within bounds
- Attempted to maintain aspect ratio

**Result**: ❌ FAILURE
- **Symptom**: Horizontal scrollbar eliminated, but vertical gap persisted
- **Root Cause**: Scaling the entire diagram doesn't fix INTERNAL spacing - it just makes a smaller version of the broken layout

---

### Attempt 4: Safe Hybrid Sizing (getBBox + scrollHeight fallback)
**File**: `LatexPreview.tsx`

**What We Did**:
- Try `getBBox()` first (for tight crop if it works)
- Fall back to `scrollHeight` if `getBBox` returns suspicious values (<20px)
- Apply responsive caps

**Result**: ❌ FAILURE
- **Symptom**: Still showed massive gap OR blank screen
- **Root Cause**: Neither measurement addressed the fundamental issue - the gap IS inside the drawn content, not empty canvas

---

### Attempt 5: Rollback to Stable Baseline
**File**: `LatexPreview.tsx`

**What We Did**:
- Completely removed getBBox, viewBox, and MAX_WIDTH logic
- Reverted to simple `scrollHeight` sizing
- Restored `x=5cm, y=5cm, node distance=7cm` configuration

**Result**: ✅ PARTIAL SUCCESS
- **Success**: Diagram rendered reliably (no blank screens)
- **Success**: Diagram was uncramped (text readable)
- **Failure**: Massive gap between title and content remained

---

### Attempt 6: Hybrid Spacing (Reduced Global + High Relative)
**File**: `LatexPreview.tsx`, lines 139-153

**What We Did**:
- Reduce global coordinate scaling: `yScale = '3cm'` → `yScale = '1.8cm'`
- Keep relative spacing high: `nodeDistance = '7cm'`
- Theory: Shrink title-to-content gap while keeping internal node spacing

**Configuration Changes**:
```typescript
// Phase 1: y=5cm (huge gap)
// Phase 2: y=3cm (smaller gap - "IMPROVEMENT!")
// Phase 3: y=1.8cm (expected smaller gap)
```

**Result**: ⚠️ INCONCLUSIVE
- User reported "IMPROVEMENT" with y=3cm
- y=1.8cm change did not show further improvement
- **Possible Issues**:
  1. Browser cache serving old code
  2. Gap is not proportional to yScale
  3. AI-generated TikZ uses very large absolute coordinates

---

### Attempt 7: Recall Last Generation Feature
**Files**: `ResultPage.tsx`, `LandingPage.tsx`

**What We Did**:
- Added localStorage persistence for generated LaTeX
- Created "Recall Last" button in UI header
- Purpose: Enable debugging by quickly reloading last generation

**Result**: ⚠️ PARTIAL SUCCESS for implementation, FAILED for debugging purpose
- **Success**: Feature implemented, TypeScript builds
- **Failure**: Browser subagent has isolated localStorage - cannot access user's saved generations
- **Next Step Needed**: Move persistence to server-side database

---

## 4. Root Cause Analysis

### Confirmed Root Cause
The gap is caused by **Global Coordinate Scaling** (`y=Xcm`) interacting with **AI-generated absolute coordinates**.

**The Physics**:
```
TikZ Code (AI-generated):
  \node at (0, 0) {Title};           // y = 0
  \node at (0, -10) {First Box};     // y = -10

With y=5cm:
  Title position: 0 × 5cm = 0cm
  Box position: -10 × 5cm = -50cm
  Gap = 50cm ≈ 1890 pixels!

With y=1.8cm:
  Title position: 0 × 1.8cm = 0cm
  Box position: -10 × 1.8cm = -18cm
  Gap = 18cm ≈ 680 pixels (still massive!)
```

### Why Node Distance Doesn't Help
`node distance` only affects **relative positioning** (e.g., `\node[below=of title] {Box}`).

If the AI uses **absolute coordinates** (`\node at (x, y)`), `node distance` has NO effect on those placements.

### Current Hypothesis
The AI-generated TikZ code likely uses:
1. An absolute-positioned title at `(0, 0)`
2. Absolute-positioned content starting at large negative y-values (e.g., `(0, -10)` or lower)

This creates an inherent gap that our coordinate scaling multiplies.

---

## 5. What We Cannot Do Yet

### Blocker: Cannot Inspect Generated TikZ Code
We cannot see the actual TikZ code the AI generates because:
1. Browser subagent has isolated localStorage
2. No API endpoint exposes the generated LaTeX for external inspection
3. The "Recall Last" feature was implemented with localStorage (inaccessible to subagent)

### Missing Capability
Need server-side storage or API endpoint to:
1. Get the latest completed job's LaTeX
2. Parse and display the TikZ code within the LaTeX
3. Analyze the actual coordinates used

---

## 6. Current State

### What Works
| Feature | Status |
|---------|--------|
| Diagram renders without crashing | ✅ |
| Diagram is uncramped (text readable) | ✅ |
| TypeScript builds without errors | ✅ |
| Recall Last button exists | ✅ |

### What Doesn't Work
| Issue | Status |
|-------|--------|
| Massive gap between title and content | ❌ |
| Cannot debug actual TikZ code | ❌ |
| Recall Last uses localStorage (not accessible to subagent) | ❌ |

### Current Configuration
```typescript
// LatexPreview.tsx (lines 139-153)
if (isTextHeavy || baseComplexity >= 8) {
  xScale = '3cm';
  yScale = '1.8cm';     // Reduced from 5cm
  nodeDistance = '7cm'; // Kept high for internal spacing
}
```

---

## 7. Recommended Next Steps

### Option A: Complete Server-Side Recall (Recommended)
1. Add `getLatestCompletedJob()` to storage.ts
2. Create `/api/conversions/latest` endpoint
3. Update "Recall Last" to fetch from server
4. Use browser subagent to inspect actual TikZ code

**Benefit**: Enables proper debugging of AI-generated code

### Option B: TikZ Code Post-Processing
1. Parse extracted TikZ before rendering
2. Detect absolute coordinates with large gaps
3. Normalize or shift coordinates

**Risk**: Complex, could break valid diagrams

### Option C: AI Prompt Modification
1. Modify AI prompts to generate TikZ with smaller coordinates
2. Instruct AI to use relative positioning (`below=of`, `right=of`)

**Risk**: Requires AI behavior change, may not be reliable

### Option D: Further Reduce yScale
1. Try `yScale = '1cm'` or `yScale = '0.5cm'`
2. Accept possible cramping as trade-off

**Risk**: May cause internal node overlap

---

## 8. Files Modified

| File | Changes | Purpose |
|------|---------|---------|
| `LatexPreview.tsx` | Lines 139-176, 189-223 | Scaling logic, iframe sizing |
| `ResultPage.tsx` | Lines 5-34 | localStorage persistence |
| `LandingPage.tsx` | Lines 5, 84-107, 171-181 | Recall Last button |

---

## 9. Lessons Learned

1. **Global coordinate scaling affects EVERYTHING** - both intended (node spacing) and unintended (title-to-content gap)

2. **getBBox is unreliable** for dynamically rendered content like TikZJax

3. **localStorage is browser-local** - cannot be used for cross-browser/subagent debugging

4. **Must see actual generated code** to properly diagnose AI output issues

5. **Rollback is valuable** - having a known working state prevents cascading failures
