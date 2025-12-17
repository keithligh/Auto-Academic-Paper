# System Architecture

## The 6-Phase Pipeline

Our "Research-First" approach ensures high-quality, hallucination-free academic papers.

### Phase 1: THE STRATEGIST (Analysis)
**Purpose:** Identify the academic angle and plan the paper.
**Action:** The AI analyzes your input to find a unique research gap. It then creates a detailed plan, outlining the paper's structure and generating specific search queries to find evidence.

### Phase 2: THE LIBRARIAN (Research)
**Purpose:** Gather verified empirical evidence.
**Action:** Using the Strategist's queries, this agent searches online databases for real, peer-reviewed papers. It verifies that every source exists and extracts the URL, ensuring the bibliography is 100% real.

### Phase 3: THE THINKER (Drafting)
**Purpose:** Draft the paper based on evidence.
**Action:** The Writer drafts the content, strictly basing arguments on the evidence found in Phase 2. It also generates data visualizations (charts, tables) to support the text, but does not yet add formal citations.

### Phase 4: THE PEER REVIEWER (Critique)
**Purpose:** Conduct a rigorous academic review.
**Action:** A senior AI agent reviews the draft against the evidence. It checks for logical consistency, verifies that claims are supported by the gathered data, and challenges weak arguments, simulating a harsh peer review.

### Phase 5: THE REWRITER (Synthesis)
**Purpose:** Integrate research naturally into the prose.
**Action:** The Writer revises the draft based on the Reviewer's feedback. It weaves the research findings directly into the narrative (e.g., "As Smith (2023) demonstrates...") to create a cohesive argument.

### Phase 6: THE EDITOR (Citation)
**Purpose:** Format citations for the final paper.
**Action:** The final pass inserts formal citation markers into the text that map precisely to the verified bibliography, ensuring every reference is accurate and properly formatted for LaTeX.

---

## Agent Roles (BYOK)

The system uses a "Bring Your Own Key" model with three specialized roles:

1. **Writer Agent (The WORDSMITH)**
   * **Role:** Drafting, Rewriting, Editing.
   * **Best For:** Writing style, long context, reasoning.
   * **Recommended:** `Claude-Opus-4.5`, `GPT-5.2`, or `Gemini-3-Pro`.

2. **Strategist Agent (The PLANNER)**
   * **Role:** Analysis and Critique.
   * **Best For:** Logic, planning, finding gaps in arguments.
   * **Recommended:** `Claude-Opus-4.5` or `GPT-5.2` (2025 Standard).

3. **Librarian Agent (The RESEARCHER)**
   * **Role:** Research and Fact-Checking.
   * **Best For:** Online search and fact verification.
   * **Recommended:** `Gemini25Pro-AAP` (Strict requirement for web search capability).

---

## Key Principles

### 1. Research Before Writing
We never ask the AI to "write and cite" at the same time. We find the evidence *first*, and then write the paper *about* that evidence. This prevents the AI from inventing fake studies to support its points.

### 2. Real Bibliographies Only
The bibliography is built programmatically from the search results, not typed by the ID. This guarantees that every listed paper exists and has a valid URL.

### 3. Custom Preview Engine
We built our own rendering engine instead of using off-the-shelf libraries. This gives us total control over how the paper looks and prevents the preview from crashing on complex academic formatting.

### 4. Smart Diagrams
The system understands the *intent* behind a diagram. If a chart is complex, it automatically scales it up; if it's simple, it keeps it compact. This ensures diagrams always look professional.

### 5. Transparency
We show you the work. You see the logs as the AI researches, drafts, and reviews. If we can't find evidence for a claim, we tell you—we don't fake it.

### 6. Reliable Rendering
The previewer is designed to never crash. Even if the AI generates slightly messy code, our "Show Something" rule ensures you always see a result, allowing you to fix it rather than staring at a blank error screen.

### 7. Local-First Privacy
This app runs 100% on your machine. Your documents and API keys never touch our servers. Use Ollama for a completely offline, air-gapped experience.
