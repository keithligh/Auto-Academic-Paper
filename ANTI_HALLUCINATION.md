# Anti-Hallucination Protocols

"Zero Tolerance for Fabrication."

This system implements a multi-layered defense strategy to prevent AI hallucinations (fabrication of facts, citations, or data). Unlike standard chat-based LLMs which favor fluency over accuracy, this pipeline prioritizes **verification** above all else.

## 1. The "Research-First" Architecture

We do not allow the AI to write from memory. The pipeline is strictly ordered:
1.  **Strategist (Phase 1)**: Plans *what* to research.
2.  **Librarian (Phase 2)**: Gathers evidence *before* a single sentence of the paper is drafted.
3.  **Thinker (Phase 3)**: Writies the paper *using* the evidence found in Phase 2.

**Why this works:** The Writer (Thinker) is never asked to "invent" citations. It is given a "Card Catalog" of verified papers and instructed to synthesize them.

## 2. Phase-Specific Safeguards

### Phase 1: The Strategist (Planning)
**Mechanism:** `CRITICAL ANTI-FABRICATION RULE`
- **Rule:** If the source input contains data, it must be used roughly. If the source is theoretical, the plan *must* be theoretical.
- **Prevention:** Prevents the "Empirical Hallucination" where AI invents fake experiments for a theoretical essay.

### Phase 2: The Librarian (Verification)
**Mechanism:** `ZERO HALLUCINATION POLICY`
- **Prompt:** *"If NO relevant paper appears... return { found: false }. DO NOT invent titles."*
- **Action:** This agent performs live web searches. It extracts *real* URLs and DOIs. If it can't find a paper, it reports failure rather than making one up.
- **Output:** A structural `references[]` array (The "Card Catalog").

### Phase 3: The Thinker (Drafting)
**Mechanism:** `CONTEXT INJECTION` & `ABSOLUTE NO FABRICATION`
- **Context:** The `references` array from Phase 2 is injected into the prompt as `AVAILABLE EVIDENCE`.
- **Constraint:** *"ABSOLUTE NO FABRICATION. ZERO TOLERANCE. Never invent experiments... If source has no data, use theoretical arguments only."*
- **Result:** The AI treats the prompt as a "Synthesis Task" (high accuracy) rather than a "Creative Writing Task" (high hallucination risk).

### Phase 4: The Peer Reviewer (Audit)
**Mechanism:** `INDEPENDENT AUDIT`
- **Action:** A separate AI agent acts as a "Senior Principal Investigator".
- **Task:** It reads the draft and performs *new* web searches to verify claims.
- **Output:** It explicitly categorizes claims into `supported_claims` (verified) and `unverified_claims` (hallucination candidates), preventing them from reaching the final draft unchecked.

## 3. Technical Constraints (Schema)

- **Separated References:** Bibliography is not just a text block; it is a structured array of objects (`{ author, title, year, url }`). This prevents "citation blending."
- **Review Report:** The system schema requires the Peer Reviewer to produce a JSON report flagging unverified claims, which forces the model to evaluate truthfulness rather than just style.

## Summary

| Layer | Defense Mechanism |
| :--- | :--- |
| **P1: Strategy** | **Scope Limiting**: Ensures plan matches data availability. |
| **P2: Research** | **Card Catalog**: Fetches real DOIs/URLs before writing starts. |
| **P3: Drafting** | **Context Injection**: Forces synthesis of provided evidence only. |
| **P4: Review** | **Adversarial Audit**: Independent agent checks claims against the web. |
