# Content Generation Pipeline Documentation

## 1. Overview

The **Auto Academic Paper** system employs a deterministic, 6-phase "**Research-First**" pipeline to transform raw input documents into rigorous academic papers. This pipeline is orchestrated by `server/ai/service.ts` and uses a "Bring Your Own Key" (BYOK) architecture with three distinct agent roles: **Strategist**, **Librarian**, and **Writer**.

## 2. Architecture & Data Flow

The pipeline operates sequentially, passing a shared `PipelineContext` object between phases.

```mermaid
graph TD
    Input["Raw Text / Upload"] --> Phase1
    
    subgraph "Phase 1: The Strategist (Analysis)"
        Phase1["Strategist Agent"] -->|Research Queries| Queries
        Note1["Logic: Analyzes input, identifies key claims needing evidence."]
    end
    
    Queries --> Phase2
    
    subgraph "Phase 2: The Librarian (Research)"
        Phase2["Librarian Agent"] -->|Verified Citations| References
        Note2["Logic: Searches online BEFORE writing to prevent hallucinations."]
    end
    
    References --> Phase3
    Input --> Phase3
    
    subgraph "Phase 3: The Thinker (Drafting)"
        Phase3["Writer Agent"] -->|Draft JSON| Draft
        Note3["Logic: Drafts with awareness of evidence, but NO in-text citations yet."]
    end
    
    Draft --> Phase4
    
    subgraph "Phase 4: The Peer Reviewer (Verification)"
        Phase4["Librarian Agent"] -->|Review Report| Report
        Note4["Logic: Verifies draft, checks Novelty, Rigor, and Significance."]
    end
    
    Report --> Phase5
    References --> Phase5
    
    subgraph "Phase 5: The Rewriter (Synthesis)"
        Phase5["Writer Agent"] -->|Improved Draft| ImprovedDraft
        Note5["Logic: Rewrites text to naturally integrate research findings."]
    end
    
    ImprovedDraft --> Phase6
    
    subgraph "Phase 6: The Editor (Formatting)"
        Phase6["Writer Agent"] -->|Final JSON| FinalDraft
        Note6["Logic: Inserts (ref_X) markers. No content changes."]
    end
    
    FinalDraft --> Output["LaTeX Compiler"]
```

---

## 3. Detailed Phase Logic & Prompts

### Phase 1: The Strategist (Analysis)
**Agent:** Strategist
**Input:** Raw content.
**Output:** `ExecutionPlan` (sections, search_queries).
**Logic:**
1.  **Identify Academic Angle (v1.9.127):** Determines the core insight, field/discipline, and which academic discourse the source contributes to.
2.  **Explore Research Opportunities:** Identifies theoretical frameworks, literature, and gaps the paper could address.
3.  **Plan the Paper:** Designs structure and generates search queries (5/10/20 based on `enhancementLevel`).
4.  **Anti-Fabrication:** If source has NO data → plan THEORETICAL sections only. Never fabricate.

> **v1.9.127 Update**: Reframed prompt from "long-form, exhaustive coverage" to "academic transformation". Removed word count constraints (`approximate_words`). LLM decides depth; only search query count is constrained for API cost control.

#### System Prompt (v1.9.127)
```text
You are a World-Class Academic Strategist.
YOUR MISSION: Receive source input and plan its transformation into a journal-ready academic paper.

STEP 1 - IDENTIFY THE ACADEMIC ANGLE
STEP 2 - EXPLORE RESEARCH OPPORTUNITIES
STEP 3 - PLAN THE PAPER

CRITICAL ANTI-FABRICATION RULE: If source has NO data → Plan THEORETICAL sections only.
```

### Phase 2: The Librarian (Research)
**Agent:** Librarian
**Input:** Research Queries.
**Output:** List of `References` (Author, Title, Year, Venue, **URL**).
**Logic:**
1.  **Iterative Search:** Executes each query individually.
2.  **Verification:** Verifies the paper exists and is peer-reviewed.
3.  **Extraction:** Extracts the Source URL (`http://...`) if available, for the Bibliography only.
4.  **Cataloging:** Adds valid papers to the `PipelineContext.references` array.

#### Key Decision: Research-First
By researching *before* drafting, we avoid the "hallucinated citation" problem. The Writer Agent (Phase 3) is given the list of real papers and told "Here is the evidence that exists. Write your paper based on this."

### Phase 3: The Thinker (Drafting)
**Agent:** Writer
**Input:** Raw content + **Available References** (from Phase 2).
**Output:** `AiResponse` (Sections, Enhancements).
**Logic:**
1.  **Contextual Drafting:** The agent is shown the list of found papers (`AVAILABLE EVIDENCE`) and instructed to structure arguments knowing this evidence exists.
2.  **Constraint:** It must **NOT** insert citations yet. This separates the "creative flow" from the "technical referencing".
3.  **Enhancements:** Generates diagrams/tables in a separate array.
    *   **Limits**: 20 Enhancements (Standard) vs Unlimited (Advanced).
4.  **Zero Tolerance (v1.9.70):** Explicit "ABSOLUTE NO FABRICATION" rule. Banned from inventing experiments, statistics, sample sizes, p-values, or stories. Must use source data AS-IS.
4.  **Streaming Feedback:** Pushes real-time, concise word counts (`~500 w`) to the UI so the user sees immediate progress.

#### System Prompt
```text
YOUR MISSION: Take the raw INPUT TEXT and elevate it into a rigorous academic paper.

AVAILABLE EVIDENCE:
- Author (Year): "Title"
...

You may structure your arguments knowing this evidence exists, but do NOT insert citations yet.
```

> **v1.9.66 Update**: Added **Anti-Fabrication Rule** (Rule 7): *"NO FABRICATED RESEARCH. Never invent experiments, statistics, sample sizes, p-values, or case studies. For empirical claims, cite from AVAILABLE EVIDENCE. Theoretical arguments and logical frameworks are encouraged."* This prevents the AI from generating fake experiments, fabricated data, or invented case studies while still allowing theoretical contributions.

> **v1.9.64 Update**: Added **LaTeX Purity Rules**: *"PURE LATEX ONLY. No Markdown (# Headers, **bold**)."* and *"NO MARKDOWN HEADERS"* in abstract prompt. This prevents AI from mixing Markdown syntax into LaTeX output.


### Phase 4: The Peer Reviewer (Verification)
**Agent:** Librarian (Role: Senior PI)
**Input:** Draft + **Available References** (The Card Catalog).
**Output:** `Review Report` (Supported Claims, Unverified Claims, Novelty, Critique, Methodology, Structure).

> **v1.9.62 Update**: The Peer Reviewer now has **Web Search Access** via the custom Poe bot (`Gemini25Pro-AAP`). The prompt explicitly instructs: *"USE WEB SEARCH to verify claims against current literature."* This transforms the reviewer from a passive "Reference Checker" into an active "Fact Checker" that can verify claims against the current state of research.

**Modes:**

The Peer Reviewer operates in two distinct modes, selectable via the frontend (`advancedOptions.reviewDepth`):

#### Mode A: Quick Review (Single-Pass)
**Logic:** A fast, consolidated review suitable for rapid iteration.
1.  **Consolidated Prompt:** Asks for Verification, Novelty, and Critique in one AI call.
2.  **Focus:** Speed and distinct, obvious errors.

#### Mode B: Deep Review (Multi-Pass v1.6.13)
**Logic:** A rigorous, 6-phase "Nature/Science" caliber review. Each sub-phase uses a dedicated AI call to maximize context usage and reasoning depth.

| Sub-Phase | Action | Purpose |
| :--- | :--- | :--- |
| **4.1 Extract Claims** | **Extraction** | Identifies every substantive factual claim in the draft. |
| **4.2 Map Evidence** | **Mapping** | maps extracted claims to specific references in the "Card Catalog". |
| **4.3 Verify** | **Auditing** | Rigorously judges whether the mapped evidence *actually* supports the claim (vs. hallucination). |
| **4.4 Methodology** | **Critique** | Evaluates study design, sampling bias, validity, and limitations. |
| **4.5 Structure** | **Analysis** | Assesses logical flow, coherence, redundancies, and missing sections. |
| **4.6 Novelty** | **Assessment** | Determines originality, derivative nature, and contribution to the field. |

**Key Benefit:** By splitting the review, the AI is not forced to "cram" all reasoning into one context window. It can focus strictly on "Is this methodology sound?" without being distracted by citation checking.

#### Shared Logic (Both Modes)
1.  **No Hallucinations:** The Reviewer is strictly bound to the provided `references` array.
2.  **Output:** A structured `ReviewReport` used by the Rewriter (Phase 5) to fix the paper.

### Phase 5: The Rewriter (Evidence Integration)
**Agent:** Writer
**Input:** Draft + Claims + References.
**Output:** `Improved Draft`.
**Logic:**
1.  **Deterministic Synthesis:** Rewrites the text based on the `Review Report`.
2.  **Verified Integration:** "The Peer Reviewer confirmed Ref_X supports this claim -> Integrate Ref_X."
3.  **Correction:** "The Peer Reviewer flagged this as Unverified -> Soften the language."
4.  **Preservation:** Preserves all LaTeX structure and diagrams.

#### System Prompt
```text
TRANSFORM:
"It is known that X is true."
INTO:
"As shown by [Author] in [Title], X is true."

Do NOT add citation markers ((ref_X)) yet. Just integrate the ideas.
```

### Phase 6: The Editor (Citation)
**Agent:** Writer
**Input:** Improved Draft + References.
**Output:** Final `AiResponse` with `(ref_X)` markers.
**Logic:**
1.  **Insertion:** The ONLY task is to insert `(ref_X)` markers at valid locations.
2.  **Compiler Logic:** The System later converts `(ref_X)` to `\cite{ref_X}` using a **Two-Pass Universal Processor** (Tokenize + Merge).

---

## 4. The Compiler & Hybrid Encapsulation
**Agent:** System (No AI)
**Logic:**
1.  **Bibliography:** Deterministically generated from the `references` list.
    *   **URLs:** Injected as `\\ \url{http://...}`. Rendered as **Plain Text** (Monospace) to prevent link rot and maintain aesthetic.
2.  **Sanitization:** The `LatexPreview.tsx` component uses the **Strict Containment Protocol**:
    *   **The Shield:** Strips dangerous macros.
    *   **The Heist:** Extracts TikZ and Math.
    *   **The Injection:** Renders them safely in isolation (Iframe for TikZ, KaTeX for Math).
