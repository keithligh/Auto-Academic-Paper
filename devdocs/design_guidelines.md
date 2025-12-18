
# Design Guidelines: Auto Academic Paper

## Design Approach

**Core Aesthetic**: "The Digital Typesetter" / "Paper & Ink"
-   **Vibe**: Professional, precise, academic, trustworthy.
-   **Headings / Content**: `Merriweather` (Serif) - Evokes the feel of a printed journal.
-   **UI / Controls**: `Inter` (Sans-serif) - Clean, modern, legible at small sizes.
-   **Data / Logs**: `JetBrains Mono` or `Consolas` - Technical, precise.

### Colors
-   **Background**: White (`#ffffff`) or subtle off-white (`#fafafa`).
-   **Foreground**: Ink Black (`#111111`) or Dark Gray (`#333333`).
-   **Accents**:
    -   **Processing**: Green (`#22c55e`) for success, Amber (`#f59e0b`) for warnings.
    -   **Error**: Editorial Red (`#ef4444`).
    -   **Borders**: Light Gray (`#e5e7eb`).

---

## Page Layouts

### 1. Landing Page ("The Desk")
-   **Goal**: minimal friction upload.
-   **Elements**:
    -   **Hero**: "Auto Academic Paper" (Serif, Large).
    -   **Upload Zone**: Central, prominent, dashed border.
    -   **Features**: 3-column grid (Analysis, Enhancements, LaTeX).
-   **Layout Strategy**:
    -   **Vertical Centering**: Content centered in viewport using Flexbox.
    -   **Pattern**: `h-screen flex flex-col` on main, inner container uses `flex-1 justify-center`.
    -   **Fixed Header Offset**: `pt-16` (64px) accounts for the sticky header.
    -   **No Scrollbar**: All spacing tuned to fit 1920×1080 viewport without overflow.
-   **Mobile Responsiveness**:
    -   Header logo: "AAP" on mobile (`sm:hidden`), full name on desktop (`hidden sm:inline`).

### 2. Configuration Page ("The Settings")
-   **Goal**: Mobile-first AI provider configuration.
-   **Philosophy**: Modals are bad for complex forms on mobile. Use dedicated pages.
-   **Layout**:
    -   **Mobile**: Stacked accordion sections (expandable cards).
    -   **Desktop**: Same accordion layout in centered container.
-   **Features**:
    -   **"Same as Writer" Toggle**: Copies Writer config to Strategist to reduce redundant input.
    -   **Verification Status**: Summary badge showing "X/3 Verified".
    -   **Privacy Note**: Prominent blue banner in header.

### 3. Processing Page ("The Console")
-   **Primary**: Black background, White text, sharp corners or slightly rounded (`rounded-md`).
-   **Secondary**: White background, Black border, Black text.
-   **Destructive**: Red text, Red border/background.

### 4. Preview Page ("The Proof")
-   **Goal**: Transparency and Verification.
-   **Principle: Preview Transparency**:
    -   **Unsupported Features**: If a LaTeX feature (e.g., `tabularx`) cannot be rendered in the browser, **show the raw code** in a styled block.
    -   **Do Not Hide**: Never hide content just because it can't be rendered. The user must see that the data exists.
    -   **Do Not Fake**: Do not use "approximate" HTML tables if they might be misleading.

---

## Responsive Design Principles

### Font Scaling
-   **Base Size**: `html { font-size: 115%; }` provides 15% larger UI globally.
-   **Mechanism**: Tailwind's `rem` units scale from the root element.
-   **Portal Fix**: Radix UI portals must inherit: `[data-radix-portal] { font-size: inherit; }`.

### Spacing Philosophy (Anti-Bandaid)
-   **Do**: Reduce actual content spacing to fit viewport.
-   **Don't**: Hide scrollbars with CSS (`overflow: hidden`).
-   **Techniques**:
    -   Reduce margins (`mb-12` → `mb-6`).
    -   Reduce min-heights (`min-h-[220px]` → `min-h-[180px]`).
    -   Reduce gaps (`gap-6` → `gap-4`).
    -   Remove decorative separators when space is tight.

### Vertical Centering Pattern
```css
/* Fixed header + centered content */
main {
  padding-top: 4rem;    /* header height */
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
```

---

### Status Indicators
-   **Processing**: Pulsing green dot.
-   **Stalled**: Pulsing amber indicator.
-   **Failed**: Static red icon.

### Animations
-   **Style**: "Snap" or "Fade". No bouncy, springy motion.
-   **Duration**: Fast (200ms).