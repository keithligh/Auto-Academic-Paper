/*
 * 6-PHASE AI RESEARCH PIPELINE
 * =============================
 * Phase 1: Strategist - Analyzes input, generates research queries
 * Phase 2: Librarian  - Searches for papers (BEFORE writing)
 * Phase 3: Thinker    - Drafts content (with awareness of evidence)
 * Phase 4: Peer Reviewer - Identifies claims needing evidence
 * Phase 5: Rewriter   - Strengthens text with evidence
 * Phase 6: Editor     - Inserts (ref_X) citation markers
 * 
 * The Compiler (in latexGenerator.ts) converts (ref_X) to \cite{ref_X}
 */
import {
    AIConfig,
    Enhancement,
    AiResponse,
    aiResponseSchema,
    defaultAIConfig,
    documentAnalysisSchema,
    ExecutionPlan,
    executionPlanSchema,
    ResearchedClaim,
    claimSchema,
    researchedClaimSchema,
    JobProgress
} from "@shared/schema";
import { AIProvider } from "./provider";
import { OpenAICompatibleProvider } from "./adapters/openai";
import { PoeProvider } from "./adapters/poe";
import { GrokProvider } from "./adapters/grok";
import { OpenRouterProvider } from "./adapters/openrouter";
import { AnthropicProvider } from "./adapters/anthropic";
import { GeminiProvider } from "./adapters/gemini";
import crypto from 'crypto';
import { OllamaProvider } from "./adapters/ollama";
import { extractJson, sanitizeLatexOutput, applyPatches } from "./utils";
import pRetry, { AbortError } from "p-retry";
import { validateLatexSyntax } from "../latexValidator";


// ====== PIPELINE CONTEXT (Shared State) ======
interface Reference {
    key: string;
    author: string;
    title: string;
    venue: string;
    year: number;
    url?: string;
}

// Review Report Item (Supported Claim)
interface SupportedClaim {
    sentence: string;
    reference_key: string;
    reasoning: string;
    confidence: string;
}

// Review Report Item (Unverified Claim)
interface UnverifiedClaim {
    sentence: string;
    issue: string; // "No evidence found" or "Contradicts evidence"
    suggestion: string; // "Soften language" or "Remove"
}

// Full Review Report
interface ReviewReport {
    supported_claims: SupportedClaim[];
    unverified_claims: UnverifiedClaim[];
    critique: string;
    novelty_check: string;
    methodology_critique?: string;
    structure_analysis?: string;
}

interface PipelineContext {
    // Input
    originalContent: string;
    paperType: string;
    enhancementLevel: string;
    advancedOptions: any;

    // Phase 1: Strategist (The General)
    plan: ExecutionPlan | null;

    // Phase 2: Librarian (The Scout) - Research Queries derived from Plan
    references: Reference[];

    // Phase 3: Thinker (The Writer)
    draft: AiResponse | null;

    // Phase 4: Peer Reviewer
    reviewReport: ReviewReport | null;

    // Phase 5: Rewriter
    improvedDraft: AiResponse | null;

    // Phase 6: Editor
    finalDraft: AiResponse | null;
}

// Factory for creating providers (Internal)
class AIProviderFactory {
    static create(config: any): AIProvider {
        switch (config.provider) {
            case "openai": return new OpenAICompatibleProvider(config);
            case "custom": return new OpenAICompatibleProvider(config);
            case "poe": return new PoeProvider(config);
            case "grok": return new GrokProvider(config);
            case "openrouter": return new OpenRouterProvider(config);
            case "anthropic": return new AnthropicProvider(config);
            case "gemini": return new GeminiProvider(config);
            case "ollama": return new OllamaProvider(config);
            default: throw new Error(`Unknown provider: ${config.provider}`);
        }
    }
}

export class AIService {
    private writer: AIProvider;
    private librarian: AIProvider;
    private strategist: AIProvider;
    private logger: (message: string, progress?: JobProgress) => Promise<void>;

    constructor(config: AIConfig, logger: (message: string, progress?: JobProgress) => Promise<void>) {
        this.logger = logger;
        this.writer = AIProviderFactory.create(config.writer);
        this.librarian = AIProviderFactory.create(config.librarian);
        this.strategist = AIProviderFactory.create(config.strategist);
    }

    private async log(message: string, progress?: JobProgress) {
        await this.logger(message, progress);
    }

    // Verify connections (REAL IMPLEMENTATION)
    async verifyConnections(scope?: string): Promise<{ success: boolean; error?: string }> {
        const providersToVerify: { name: string; provider: AIProvider }[] = [];

        if (scope) {
            if (scope === 'writer') providersToVerify.push({ name: 'Writer', provider: this.writer });
            else if (scope === 'librarian') providersToVerify.push({ name: 'Librarian', provider: this.librarian });
            else if (scope === 'strategist') providersToVerify.push({ name: 'Strategist', provider: this.strategist });
            else return { success: false, error: `Invalid scope: ${scope}` };
        } else {
            providersToVerify.push({ name: 'Writer', provider: this.writer });
            providersToVerify.push({ name: 'Librarian', provider: this.librarian });
            providersToVerify.push({ name: 'Strategist', provider: this.strategist });
        }

        for (const { name, provider } of providersToVerify) {
            try {
                // Retry verification once to identify transient network errors early
                await pRetry(async () => {
                    await provider.completion("Test connection. Reply with 'OK'.", "You are a connection tester.");
                }, { retries: 1 });
            } catch (error: any) {
                console.error(`[Verification] ${name} failed:`, error);
                return {
                    success: false,
                    error: `${name} Connection Failed: ${error.message || "Unknown error"}`
                };
            }
        }

        return { success: true };
    }

    // Wrapper for backward compatibility with routes.ts
    async processDocument(
        content: string,
        paperType: string,
        enhancementLevel: string,
        advancedOptions: any = {}
    ): Promise<AiResponse> {
        return this.generatePaper(content, paperType, enhancementLevel, advancedOptions);
    }

    // ====== MAIN ENTRY POINT: 6-PHASE PIPELINE ======
    async generatePaper(
        content: string,
        paperType: string,
        enhancementLevel: string,
        advancedOptions: any = {}
    ): Promise<AiResponse> {
        await this.log(`[AI Service] Starting 6-Phase Research Pipeline...`, { phase: "Initialization", step: "Pipeline Start", progress: 5 });
        await this.log(`[Config] Writer: ${this.writer.model}, Librarian: ${this.librarian.model}, Strategist: ${this.strategist.model}`);

        // Initialize PipelineContext
        const ctx: PipelineContext = {
            originalContent: content,
            paperType,
            enhancementLevel,
            advancedOptions,
            plan: null,
            references: [],
            draft: null,
            reviewReport: null,
            improvedDraft: null,
            finalDraft: null
        };

        try {
            // Phase 1: Strategist (Analyze input, generate research queries)
            await this.phase1_Strategist(ctx);

            // Phase 2: Librarian (Search for papers BEFORE writing)
            await this.phase2_Librarian(ctx);

            // Phase 3: Thinker (Draft with knowledge of evidence)
            await this.phase3_Thinker(ctx);

            // Phase 4: The Peer Reviewer (Verify claims against evidence)
            await this.phase4_PeerReviewer(ctx);

            // Phase 5: Rewriter (Strengthen text with evidence)
            await this.phase5_Rewriter(ctx);

            // Phase 6: Editor (Insert citation markers)
            await this.phase6_Editor(ctx);



            // Merge reviewReport into final response for persistence
            if (ctx.finalDraft && ctx.reviewReport) {
                (ctx.finalDraft as any).reviewReport = ctx.reviewReport;
            }

            return ctx.finalDraft!;

        } catch (error: any) {
            await this.log(`[AI Service] CRITICAL ERROR: ${error.message}`, { phase: "Error", step: "Failed", progress: 0, details: error.message });
            throw error;
        }
    }

    // ====== PHASE 1: THE STRATEGIST (THE GENERAL) ======
    private async phase1_Strategist(ctx: PipelineContext): Promise<void> {
        await this.log(`[Phase 1/6] The Strategist: Designing execution plan...`, { phase: "Phase 1: Strategy", step: "Designing Structure", progress: 8 });

        // Limit Logic (Optimization Sprint)
        // v1.9.5: Strict user-defined limits (5/10/20)
        let queryLimit = 10; // Default (Standard)
        if (ctx.enhancementLevel === 'advanced') queryLimit = 20;
        if (ctx.enhancementLevel === 'minimal') queryLimit = 5;

        const queryInstruction = `limit to a MAXIMUM of ${queryLimit} high-impact search queries.`;

        const systemPrompt = `You are a World-Class Academic Strategist.

YOUR MISSION: Receive source input and plan its transformation into a DEEP, RIGOROUS, and COMPREHENSIVE journal-ready academic paper.

STEP 1 - IDENTIFY THE ACADEMIC ANGLE:
- What is the core INSIGHT or CONTRIBUTION?
- What FIELD or DISCIPLINE does this belong to?
- What existing academic DISCOURSE does this contribute to?

STEP 2 - EXPLORE RESEARCH OPPORTUNITIES:
- What THEORETICAL FRAMEWORKS could strengthen this argument?
- What LITERATURE should be reviewed to contextualize this?
- What GAPS in existing research does this address?

STEP 3 - PLAN THE PAPER:
- Design a structure befitting a top-tier journal submission. Avoid superficiality.
- Identify what EVIDENCE we need to find (generate search queries)
- Define the ARGUMENT GOAL for each section

CRITICAL ANTI-FABRICATION RULE:
- If source has NO data → Plan THEORETICAL sections only
- If source HAS data → Use that EXACT data. Never fabricate.

CRITICAL RETENTION RULE:
Identify specific PROPER NOUNS, NAMES, UNIQUE TERMS, and DATA POINTS from the source.
List them in "key_terms". These must not be lost in translation.

PAPER TYPE: ${ctx.paperType}
QUERY LIMIT: ${queryInstruction}

OUTPUT FORMAT (JSON):
{
    "title_idea": "Proposed Title",
    "abstract_goal": "What the abstract should convey...",
    "sections": [
        {
            "name": "Section Name",
            "goal": "What this section must accomplish...",
            "required_evidence": ["What papers to find"]
        }
    ],
    "search_queries": ["query 1", "query 2"],
    "key_terms": ["Term 1", "Proper Noun 2", "Data Point 3"]
}
`;

        const userPrompt = `SOURCE INPUT:
<source_text>
${ctx.originalContent.substring(0, 15000)}
</source_text>

YOUR TASK:
1. Identify the ACADEMIC ANGLE (using the <source_text>)
2. Explore RESEARCH OPPORTUNITIES
3. Create an Execution Plan for a deep, scholarly, and rigorous paper
4. Return the JSON object as defined in the System Prompt.

CRITICAL CONSTRAINT:
Do NOT plan "Empirical Validation" or "Case Studies" unless the source explicitly contains raw data/metrics. If the input is theoretical, your plan MUST be theoretical.

The downstream phases will execute this plan. Make it DEEP, SCHOLARLY, and COMPREHENSIVE. Do not plan a shallow overview.`;

        return await pRetry(async () => {
            let lastLogTime = 0;
            const result: any = await this.strategist.jsonCompletion(
                userPrompt,
                systemPrompt,
                executionPlanSchema,
                async (text) => {
                    const now = Date.now();
                    if (now - lastLogTime > 2000) {
                        await this.log(`[Strategist] Designing Plan (${text.length} chars)...`, {
                            phase: "Phase 1: Strategy",
                            step: "Designing Structure",
                            progress: 10,
                            details: `Generating plan: ${text.length} chars`
                        });
                        lastLogTime = now;
                    }
                }
            );

            ctx.plan = result;

            // SCHEMA GUARD (v1.9.132): Fix "Cannot read properties of undefined (reading 'length')"
            // If AI hallucinates a partial schema, default to empty arrays to prevent crash.
            if (ctx.plan) {
                if (!ctx.plan.search_queries) {
                    console.warn("[Strategist] Schema Violation: Missing 'search_queries'. Defaulting to [].");
                    ctx.plan.search_queries = [];
                }
                if (!ctx.plan.sections) {
                    console.warn("[Strategist] Schema Violation: Missing 'sections'. Defaulting to [].");
                    ctx.plan.sections = [];
                }
                if (!ctx.plan.key_terms) {
                    ctx.plan.key_terms = [];
                }
            }

            // Enforce limit strictly if AI hallucinates more
            if (ctx.plan && ctx.plan.search_queries.length > queryLimit) {
                ctx.plan.search_queries = ctx.plan.search_queries.slice(0, queryLimit);
                await this.log(`[Strategist] Note: Truncated search queries to ${queryLimit}.`);
            }

            await this.log(`[Strategist] Plan designed: ${ctx.plan?.sections?.length || 0} sections, ${ctx.plan?.search_queries?.length || 0} queries.`, { phase: "Phase 1: Strategy", step: "Plan Complete", progress: 12 });
        }, { retries: 2 });
    }

    // ====== PHASE 2: THE LIBRARIAN (THE SCOUT) ======
    // v1.9.2: Improved prompt clarity, fixed ref key trailing space, added error tracking
    private async phase2_Librarian(ctx: PipelineContext): Promise<void> {
        const queryCount = ctx.plan?.search_queries?.length || 0;
        await this.log(`[Phase 2 / 6] The Librarian: Searching for ${queryCount} papers...`, { phase: "Phase 2: Research", step: "Starting Research", progress: 15 });

        if (!this.librarian.supportsResearch) {
            await this.log(`[Librarian] Warning: Provider does not support research. Skipping.`);
            return;
        }

        let refNumber = 1;
        let apiErrors = 0;  // Track API failures separately from "no results"
        let noResultsCount = 0;

        if (!ctx.plan?.search_queries) return;

        for (let i = 0; i < ctx.plan.search_queries.length; i++) {
            const query = ctx.plan.search_queries[i];
            const progressPercent = 15 + Math.floor((i / ctx.plan.search_queries.length) * 15); // 15% to 30%

            await this.log(`[Librarian] Searching query ${i + 1} /${ctx.plan.search_queries.length}...`, { phase: "Phase 2: Research", step: `Query ${i + 1}/${ctx.plan.search_queries.length} `, progress: progressPercent, details: query.substring(0, 50) + "..." });

            try {
                // Retry specific query search 3 times
                await pRetry(async () => {
                    // v1.9.2: Improved prompt - removed misleading "SEARCH TOOL" reference
                    const prompt = `Find ONE peer-reviewed academic paper for this query:

QUERY: ${query}

CONTEXT: Web search results have been provided to augment your knowledge. Use them to find a real, verifiable paper.

TASK:
1. From the web search context, identify a real, peer-reviewed academic paper.
2. Extract the author(s), title, venue, year, and URL (DOI or arXiv preferred).
3. Include a brief abstract snippet as proof of verification.

**ZERO HALLUCINATION POLICY**:
- If NO relevant paper appears in the search results, return { "found": false }.
- DO NOT invent titles, authors, or DOIs from memory.
- Only cite papers that appear in the provided search context.
- UNICODE ONLY: Output author names and titles in standard UTF-8 (e.g. "Müller"). Do NOT use LaTeX escape codes (e.g. "\\\"user" or "\\text...").

OUTPUT FORMAT (JSON only, no markdown fences):
{
    "found": true,
    "reference": {
        "author": "Author names",
        "title": "Paper title",
        "venue": "Journal/Conference",
        "year": 2024,
        "url": "https://doi.org/...",
        "abstract": "Brief abstract snippet..."
    }
}

If NO suitable paper found, return: { "found": false }`;

                    // TIMEOUT WRAPPER (Increased to 3m per user request, effectively 2m here for per-query safety)
                    const timeoutMs = 120000;
                    const searchPromise = this.librarian.completion(prompt, "You are a Research Librarian.", undefined, true);

                    const timeoutPromise = new Promise<string>((_, reject) =>
                        setTimeout(() => reject(new Error("Search timed out")), timeoutMs)
                    );

                    const resultStr = await Promise.race([searchPromise, timeoutPromise]);
                    const research = extractJson(resultStr);

                    if (research.found && research.reference) {
                        ctx.references.push({
                            key: `ref_${refNumber}`,  // v1.9.2: Fixed trailing space bug
                            author: research.reference.author,
                            title: research.reference.title,
                            venue: research.reference.venue,
                            year: research.reference.year,
                            url: research.reference.url
                        });
                        await this.log(`[Librarian] ✓ Found: ${research.reference.author}`, { phase: "Phase 2: Research", step: `Found Source`, progress: progressPercent, details: research.reference.title });
                        refNumber++;
                    } else {
                        noResultsCount++;
                        await this.log(`[Librarian] ✗ No paper found for query.`, { phase: "Phase 2: Research", step: `No Source`, progress: progressPercent });
                    }
                }, { retries: 2 }); // Total 3 attempts per query

            } catch (e: any) {
                apiErrors++;  // v1.9.2: Track API failures
                const isApiError = e.message.includes('API Error') || e.message.includes('403') || e.message.includes('401');
                const stepLabel = isApiError ? 'API Error' : 'Error';
                await this.log(`[Librarian] ✗ ${stepLabel} on query ${i + 1}: ${e.message.substring(0, 100)}`, { phase: "Phase 2: Research", step: stepLabel, progress: progressPercent, details: e.message.substring(0, 150) });
            }
        }

        // v1.9.2: Enhanced completion log with failure breakdown
        const totalQueries = ctx.plan.search_queries.length;
        const successRate = totalQueries > 0 ? Math.round((ctx.references.length / totalQueries) * 100) : 0;
        await this.log(`[Librarian] Research complete: ${ctx.references.length}/${totalQueries} papers found (${successRate}%). API errors: ${apiErrors}, No results: ${noResultsCount}`, { phase: "Phase 2: Research", step: "Complete", progress: 30, details: `${ctx.references.length} references` });
    }

    // ====== PHASE 3: THE THINKER (THE WRITER) ======
    // Deep Work Architecture: Section-by-Section Execution
    private async phase3_Thinker(ctx: PipelineContext): Promise<void> {
        if (!ctx.plan) throw new Error("Phase 3 started without Execution Plan");

        await this.log(`[Phase 3 / 6] The Thinker: Drafting ${ctx.plan.sections.length} sections in deep mode...`, { phase: "Phase 3: Drafting", step: "Deep Work Start", progress: 32 });

        const draftedSections: { name: string, content: string }[] = [];
        const totalSections = ctx.plan.sections.length;

        // Initialize draft object
        ctx.draft = {
            title: ctx.plan.title_idea,
            abstract: "Pending generation...",
            sections: [],
            references: [], // No references yet (Phase 6)
            enhancements: []
        };

        // Enhancement Limits (User Request)
        const isAdvanced = ctx.enhancementLevel === 'advanced';
        const totalEnhancementLimit = isAdvanced ? 999 : 20;
        let currentEnhancementCount = 0;

        // 1. Generate Abstract (Fast)
        await this.log(`[Thinker] Drafting Abstract...`, { phase: "Phase 3: Drafting", step: "Abstract", progress: 33 });
        const abstractPrompt = `Write the ABSTRACT for this paper.
GOAL: ${ctx.plan.abstract_goal}
TITLE: ${ctx.plan.title_idea}
PAPER TYPE: ${ctx.paperType}
NO CITATIONS. NO MARKDOWN HEADERS. 
START DIRECTLY WITH TEXT. Do not use "Abstract:" prefix or "Here is the abstract".`;
        const abstractResult = await this.writer.completion(abstractPrompt, "You are an academic abstract writer.");
        ctx.draft.abstract = sanitizeLatexOutput(abstractResult);


        // 2. Deep Sectional Loop
        for (let i = 0; i < totalSections; i++) {
            const sectionPlan = ctx.plan.sections[i];
            const progress = 35 + Math.floor((i / totalSections) * 15); // 35-50%
            const shortName = sectionPlan.name.length > 60 ? sectionPlan.name.substring(0, 57) + "..." : sectionPlan.name;

            await this.log(`[Thinker] Drafting Section ${i + 1}/${totalSections}: "${shortName}"...`, { phase: "Phase 3: Drafting", step: `Section: ${shortName}`, progress: progress });

            // Context Construction
            const evidenceContext = ctx.references.length > 0
                ? `AVAILABLE EVIDENCE:\n${ctx.references.map(r => `- ${r.author} (${r.year}): ${r.title}`).join("\n")}`
                : "No external evidence found. Rely on logical argumentation.";

            // Calculate remaining budget
            const remainingEnhancements = totalEnhancementLimit - currentEnhancementCount;
            const enhancementInstruction = isAdvanced
                ? "AGGRESSIVELY ENHANCE. Create as many academic tools (Formula, TikZ, etc.) as the content justifies."
                : (remainingEnhancements > 0
                    ? `You have a budget of ${remainingEnhancements} more enhancements for the whole paper. Use 1-2 here if critical.`
                    : "Enhancement Budget Exceeded. DO NOT generate new enhancements (Formulas, Figures, Tables). Stick to text only.");

            const isThesis = (ctx.paperType || "").toLowerCase() === "thesis";
            const symbolInstruction = isThesis
                ? "- **Symbol**: Definition list using \\begin{itemize}. NEVER use \\begin{equation}."
                : "";

            const systemPrompt = `You are an expert academic writer producing deep, scholarly research.
You are writing ONE SECTION of a larger paper. Write with the depth and rigor expected of a peer-reviewed journal.

SECTION NAME: "${sectionPlan.name}"
ARGUMENT GOAL: ${sectionPlan.goal}
ENHANCEMENT LEVEL: ${ctx.enhancementLevel.toUpperCase()}

${evidenceContext}

CRITICAL RETENTION LIST (MANDATORY):
The following terms/names from the source MUST appear in the final text (if relevant to this section).
Do NOT replace them with generic synonyms (e.g. use "Steve Tol", not "The Subject").
KEYS: [${(ctx.plan?.key_terms || []).join(", ")}]

WRITING DEPTH EXPECTATIONS:
- Develop each argument thoroughly before moving to the next
- Provide in-depth analysis, not surface-level summaries
- Include scholarly discussion connecting ideas to broader literature
- Explain the "why" behind claims, not just the "what"

ACADEMIC ENHANCEMENTS (THE TRANSFORMER PROTOCOL):
You are NOT just writing text. You are creating a "World-Class" academic paper.
Your goal is to ACTIVELY FORMALIZE the concepts. Do not wait for opportunities—CREATE THEM.

IF you describe a process -> CONVERT it into a \begin{algorithm} or \begin{figure} (TikZ).
IF you describe a relationship -> FORMULATE it as a \begin{equation} or \begin{theorem}.
IF you describe data/comparison -> STRUCTURE it into a \begin{table}.

MANDATORY TOOLKIT (Use at least 1-2 per section if possible):
- **Formula**: \begin{equation} ... \end{equation}
- **Hypothesis**: \begin{hypothesis} ... \end{hypothesis}
- **Diagram**: \begin{tikzpicture} ... \end{tikzpicture} (Keep it simple, minimal nodes).
- **Logical Structure**: \begin{proof} ... \end{proof}
 ${symbolInstruction}
- **Table**: \begin{table} ... \end{table}
- **Equation**: Numbered math models.
- **Theorem**: \begin{theorem} ... \end{theorem}
- **Proof**: Rigorous derivation.
- **Code Listing**: \begin{algorithm} ... \end{algorithm}
- **Algorithm**: Pseudocode logic.

TIKZ DIAGRAM RULES (CRITICAL):
1. SYNTAX: Use 'right=of X' (edge-to-edge), NEVER 'right of=X' (deprecated).
2. NO \\usetikzlibrary: DO NOT include \\usetikzlibrary{...} in your output. Assume libraries (arrows, shapes, calc, positioning, decorations.pathreplacing) are already loaded in the preamble.
3. WRAPPING: If node text > 5 words, force wrapping: 'text width=2.5cm, align=center'.
4. NO PLOTS: Pure TikZ only. No \\begin{axis}, no \\addplot.
5. STYLE: Start with \\begin{tikzpicture}[node distance=2.5cm, every node/.style={font=\\small}]
6. VENN PROTOCOL (For Venn Diagrams ONLY):
   - COORDINATES: Use POLAR coordinates (e.g. (90:2cm), (210:2cm)) for symmetry. Do NOT use 'right=of'.
   - OPACITY: Use 'fill=gray, opacity=0.3, text opacity=1' to show overlaps clearly.
   - SIZE: Use 'minimum size=4cm' (or radius=2cm) to ensure labels fit.


TABLE RULES (CRITICAL):
1. DENSE TEXT: If table contains sentences, use \\begin{tabularx}{\\textwidth}{...} with 'X' columns (e.g. {l X X}).
2. NEVER use fixed 'p{...}' columns < 4cm for text. Use 'X' instead to fill page width.
3. STRUCTURE: Use \\toprule, \\midrule, \\bottomrule.
4. STYLING: Use \\textbf{...} for headers (Row 1).
5. VALIDITY: Every row MUST end with \\\\ (double backslash). Use & to separate columns matches definition.
6. CONTENT: Escape special LaTeX characters (%, $, _, {, }, &) in text coverage.

CONSTRAINT: ${enhancementInstruction}

CRITICAL RULES:
1. WRITE ONLY THE SECTION CONTENT.
2. BE COMPREHENSIVE. Develop ideas in depth with thorough scholarly discussion.
3. USE THE EVIDENCE.
4. THOUGHTFULLY ENHANCE. If the source text is simple, elevate it using these tools to add scholarly rigor.
5. NO CITATION MARKERS like (ref_X).
6. PURE LATEX ONLY. No Markdown (# Headers, **bold**).
7. STYLING STANDARD. Use \\textbf{} for emphasis. AVOID colored text (e.g. \\textcolor). Keep it classic Academic Black & White.
8. ABSOLUTE NO FABRICATION. ZERO TOLERANCE. Never invent experiments, statistics, sample sizes, p-values, case studies, user quotes, anecdotes, or stories. If the source has data, use it EXACTLY AS-IS - no embellishment, no modification, no "improved" numbers. If you need empirical claims and source has no data, use theoretical arguments only. Violation of this rule makes the paper INVALID.
9. VALID SECTIONING ONLY. Only use \\section{}, \\subsection{}, \\subsubsection{}, \\paragraph{}. NO deeper levels like \\subsubssubsection (not real LaTeX).
10. NO PLACEHOLDERS. Do NOT include text like "[INSERT DIAGRAM HERE]" or "Figure 1 goes here" in the narrative. The system manages enhancement placement automatically.
11. INLINE MATH: Use $ ... $ for all mathematical variables in the narrative text (e.g. $L_{market}$, $\alpha$).



OUTPUT FORMAT (JSON):
{
  "narrative": "The main text of the section (Markdown/LaTeX mixed, but mostly text).",
  "enhancements": [
    {
      "type": "formula|hypothesis|diagram|logical_structure|symbol|table|equation|theorem|proof|code_listing|algorithm",
      "title": "Short title",
      "description": "Caption or brief explanation",
      "content": "The actual LaTeX code (e.g. \\begin{equation}...\\end{equation})",
      "reasoning": "Why this enhancement adds value"
    }
  ]
}`;

            const userPrompt = `Write section "${sectionPlan.name}". 
GOAL: ${sectionPlan.goal}
TRANSFORM the content using the Mandatory Toolkit. Make it look like a top-tier journal paper.
Return JSON Object.`;

            let sectionContent = "";
            let generatedEnhancements: any[] = [];
            let lastLogTime = 0;

            try {
                const result = await pRetry(async () => {
                    return await this.writer.jsonCompletion(
                        userPrompt,
                        systemPrompt,
                        undefined,
                        async (text) => {
                            const now = Date.now();
                            if (now - lastLogTime > 2000) { // Log every 2s, more responsive
                                // SHORT STATUS as requested by User - STANDARDIZED TO CHARS
                                const shortName = sectionPlan.name.length > 60 ? sectionPlan.name.substring(0, 57) + "..." : sectionPlan.name;
                                await this.log(`[Drafting] ${shortName} (${text.length} chars)...`, {
                                    phase: "Phase 3: Drafting",
                                    step: `Drafting: ${sectionPlan.name}`,
                                    progress: progress,
                                    details: `Writing... (${text.length} chars)`
                                });
                                lastLogTime = now;
                            }
                        }
                    );
                }, { retries: 2 });

                // Process the JSON result
                if (result && result.narrative) {
                    // SANITIZE AT SOURCE: Strip reasoning and convert markdown
                    sectionContent = sanitizeLatexOutput(result.narrative);

                    // Harvest validations
                    if (result.enhancements && Array.isArray(result.enhancements)) {
                        for (const enh of result.enhancements) {
                            // Budget check for non-advanced mode
                            if (!isAdvanced && currentEnhancementCount >= totalEnhancementLimit) {
                                continue; // Skip if over budget
                            }

                            generatedEnhancements.push({
                                id: crypto.randomUUID(),
                                type: enh.type || "figure",
                                title: enh.title || "Untitled",
                                description: enh.description || "",
                                content: enh.content || "",
                                location: sectionPlan.name, // AUTOMATICALLY PLACED IN THIS SECTION
                                enabled: true,
                                reasoning: enh.reasoning || "AI Generated"
                            });
                            currentEnhancementCount++;
                        }
                    }
                } else {
                    // Fallback if JSON fails but returns string? Unlikely with jsonCompletion wrapper but safe to check
                    // If purely string, treat as narrative
                    if (typeof result === 'string') sectionContent = sanitizeLatexOutput(result);
                }

            } catch (err: any) {
                await this.log(`[Thinker] Error drafting section "${sectionPlan.name}": ${err.message}`);
                sectionContent = `(Error generating section: ${err.message})`;
            }

            // Fallback content
            if (!sectionContent) sectionContent = "(No content generated)";

            // Hoist local enhancements to global context
            ctx.draft!.enhancements.push(...generatedEnhancements); // We initialized this array earlier

            draftedSections.push({
                name: sectionPlan.name,
                content: sectionContent
            });
        }

        ctx.draft.sections = draftedSections;
        await this.log(`[Thinker] Deep Drafting complete.`, { phase: "Phase 3: Drafting", step: "Draft Complete", progress: 50 });
    }

    // ====== PHASE 4: THE PEER REVIEWER ======
    private async phase4_PeerReviewer(ctx: PipelineContext): Promise<void> {
        const reviewDepth = ctx.advancedOptions?.reviewDepth || "quick";
        await this.log(`[Phase 4 / 6] The Peer Reviewer: Starting ${reviewDepth.toUpperCase()} review process...`, { phase: "Phase 4: Peer Review", step: "Starting Review", progress: 52 });

        if (reviewDepth === "deep") {
            await this.phase4_DeepReview(ctx);
        } else {
            await this.phase4_QuickReview(ctx);
        }
    }

    // Original Single-Pass Review (Consolidated)
    private async phase4_QuickReview(ctx: PipelineContext): Promise<void> {
        await this.log(`[PeerReviewer] Running Quick Review(Single Pass)...`, { phase: "Phase 4: Peer Review", step: "Reviewing Draft", progress: 53 });

        if (!ctx.draft) {
            await this.log(`[PeerReviewer] Error: No draft to review.`);
            return;
        }

        const draftText = ctx.draft.sections.map(s => `### ${s.name} \n${s.content} `).join("\n\n");
        const enhancementsText = ctx.draft.enhancements && ctx.draft.enhancements.length > 0
            ? "\n\n### ACCOMPANYING FIGURES & TABLES (Check these before critiquing missing visuals):\n" + ctx.draft.enhancements.map(e => `- [${e.type}] ${e.title} (Location: ${e.location}): ${e.description}`).join("\n")
            : "";
        const referencesText = JSON.stringify(ctx.references, null, 2);

        const systemPrompt = `You are a Senior Principal Investigator conducting a rigorous Peer Review of a draft paper.

YOUR CAPABILITIES:
You have WEB SEARCH access. USE IT to verify claims against current literature.
You also have the "Card Catalog" (our gathered evidence) for reference.

YOUR TASK:
Perform a "Nature/Science" caliber review focusing on:
1. **Verification**: USE WEB SEARCH to fact-check key claims. Do they align with current research? Are the cited references accurate?
2. **Novelty**: Search for similar recent work. Does this paper offer new insights or just repeat known facts?
3. **Rigor**: Is the logical flow sound? Are the conclusions earned?

OUTPUT STRUCTURE:
- **supported_claims**: Claims you verified via web search or Card Catalog. Include the source.
- **unverified_claims**: Claims that could not be verified or contradict current literature.
- **novelty_check**: Assessment based on your web search of the current state of the field.
- **critique**: High-level feedback on logic and flow.

CRITICAL RULES:
1. ACTIVELY SEARCH THE WEB to verify factual claims.
2. Do NOT hallucinate connections. If you cannot find evidence, mark as UNVERIFIED.
3. Cite URLs or paper titles from your search when possible.`;

        const userPrompt = `DRAFT PAPER:
${draftText}
${enhancementsText}

AVAILABLE REFERENCES(Card Catalog):
${referencesText}

TASK:
Perform a Peer Review.Map claims to evidence.

OUTPUT FORMAT(JSON):
{
    "supported_claims": [
        { "sentence": "Exact text...", "reference_key": "ref_X", "reasoning": "Ref X explicitly states...", "confidence": "High" }
    ],
        "unverified_claims": [
            { "sentence": "Exact text...", "issue": "No matching evidence", "suggestion": "Soften to 'hypothesized' or remove" }
        ],
            "novelty_check": "The paper presents... but lacks...",
                "critique": "General assessment..."
}

Return ONLY the JSON.`;

        return await pRetry(async () => {
            let lastLogTime = 0;
            const result: any = await this.librarian.jsonCompletion(
                userPrompt,
                systemPrompt,
                undefined,
                async (text) => {
                    const now = Date.now();
                    if (now - lastLogTime > 2000) {
                        await this.log(`[Reviewing] Analyzing Draft (${text.length} chars)...`, {
                            phase: "Phase 4: Peer Review",
                            step: "Reviewing Draft",
                            progress: 55,
                            details: `(${text.length} chars)`
                        });
                        lastLogTime = now;
                    }
                }
            );
            ctx.reviewReport = result || { supported_claims: [], unverified_claims: [], critique: "No review generated.", novelty_check: "N/A" };

            const supportedCount = ctx.reviewReport?.supported_claims?.length || 0;
            const unverifiedCount = ctx.reviewReport?.unverified_claims?.length || 0;
            const novelty = ctx.reviewReport?.novelty_check ? ctx.reviewReport.novelty_check.substring(0, 100) + "..." : "N/A";
            const critique = ctx.reviewReport?.critique ? ctx.reviewReport.critique.substring(0, 150) + "..." : "N/A";

            await this.log(`[PeerReviewer] Review complete: ${supportedCount} verified, ${unverifiedCount} unverified.`, { phase: "Phase 4: Peer Review", step: "Review Complete", progress: 58, details: `${supportedCount} verified` });
            if (ctx.reviewReport?.novelty_check) {
                await this.log(`[PeerReviewer] Novelty Check: ${novelty} `, { phase: "Phase 4: Peer Review", step: "Novelty Analysis", progress: 58 });
            }
            if (ctx.reviewReport?.critique) {
                await this.log(`[PeerReviewer] Critique: ${critique} `, { phase: "Phase 4: Peer Review", step: "Critique", progress: 58 });
            }
        }, { retries: 2 });
    }

    // New Deep Review (Multi-Phase)
    private async phase4_DeepReview(ctx: PipelineContext): Promise<void> {
        if (!ctx.draft) return;

        await this.log(`[DeepReview] Starting 6 - Phase Deep Analysis...`, { phase: "Phase 4: Peer Review", step: "Deep Review Start", progress: 53 });

        // 4.1 Claim Extraction
        const claims = await this.phase4_1_ExtractClaims(ctx);

        // 4.2 Evidence Mapping
        const evidenceMap = await this.phase4_2_MapEvidence(ctx, claims);

        // 4.3 Verification Deep-Dive
        const verificationResult = await this.phase4_3_Verify(ctx, claims, evidenceMap);

        // 4.4 Methodology Critique
        const methodologyCritique = await this.phase4_4_CritiqueMethodology(ctx);

        // 4.5 Structure Analysis
        const structureAnalysis = await this.phase4_5_AnalyzeStructure(ctx);

        // 4.6 Novelty Assessment
        const noveltyCheck = await this.phase4_6_AssessNovelty(ctx);

        // Consolidate into Review Report
        ctx.reviewReport = {
            supported_claims: verificationResult.supported_claims,
            unverified_claims: verificationResult.unverified_claims,
            critique: `${structureAnalysis.substring(0, 500)} \n\nMethodology Note: ${methodologyCritique.substring(0, 300)} `,
            novelty_check: noveltyCheck,
            methodology_critique: methodologyCritique,
            structure_analysis: structureAnalysis
        };

        const supportedCount = ctx.reviewReport.supported_claims.length;
        const unverifiedCount = ctx.reviewReport.unverified_claims.length;
        const noveltyShort = noveltyCheck.substring(0, 100) + "...";

        await this.log(`[DeepReview] Complete.${supportedCount} Verified, ${unverifiedCount} Unverified.`, { phase: "Phase 4: Peer Review", step: "Deep Review Complete", progress: 59 });
        await this.log(`[DeepReview] Novelty: ${noveltyShort} `, { phase: "Phase 4: Peer Review", step: "Novelty Analysis", progress: 59 });
    }

    private async phase4_1_ExtractClaims(ctx: PipelineContext): Promise<string[]> {
        await this.log(`[DeepReview] 4.1 Extracting Claims...`, { phase: "Phase 4: Peer Review", step: "4.1 Extracting Claims", progress: 54 });
        const draftText = ctx.draft!.sections.map(s => s.content).join("\n\n");
        const prompt = `Extract all substantive factual claims, data points, and specific arguments from the text below.Ignore general intro / outro fluff.Return a JSON list of strings.`;

        // STREAMING ADDED
        let lastLogTime = 0;
        const result = await this.librarian.jsonCompletion(`TEXT: \n${draftText} `, prompt, undefined, async (text) => {
            const now = Date.now();
            if (now - lastLogTime > 2000) {
                await this.log(`[DeepReview] Extracting claims (${text.length} chars)...`, {
                    phase: "Phase 4: Peer Review", step: "Extracting Claims", progress: 54, details: `(${text.length} chars)`
                });
                lastLogTime = now;
            }
        });
        return result?.claims || result || [];
    }

    private async phase4_2_MapEvidence(ctx: PipelineContext, claims: string[]): Promise<any> {
        await this.log(`[DeepReview] 4.2 Mapping Evidence...`, { phase: "Phase 4: Peer Review", step: "4.2 Mapping Evidence", progress: 55 });
        const referencesText = JSON.stringify(ctx.references, null, 2);
        const claimsText = JSON.stringify(claims.slice(0, 50), null, 2); // Limit to top 50 to avoid overload if massive
        const prompt = `Map these claims to the provided references.Which reference supports which claim ? Return JSON { "mappings": [{ "claim": text, "ref_key": key }] } `;

        // STREAMING ADDED
        let lastLogTime = 0;
        return await this.librarian.jsonCompletion(`CLAIMS: \n${claimsText} \n\nREFS: \n${referencesText} `, prompt, undefined, async (text) => {
            const now = Date.now();
            if (now - lastLogTime > 2000) {
                await this.log(`[DeepReview] Mapping Evidence (${text.length} chars)...`, {
                    phase: "Phase 4: Peer Review", step: "Mapping Evidence", progress: 55, details: `(${text.length} chars)`
                });
                lastLogTime = now;
            }
        });
    }

    private async phase4_3_Verify(ctx: PipelineContext, claims: string[], evidenceMap: any): Promise<{ supported_claims: SupportedClaim[], unverified_claims: UnverifiedClaim[] }> {
        await this.log(`[DeepReview] 4.3 Verifying Claims...`, { phase: "Phase 4: Peer Review", step: "4.3 Verifying", progress: 56 });
        const prompt = `Based on the evidence map, generate the final list of verified vs unverified claims.Be strict.Return JSON { supported_claims: [], unverified_claims: [] } matching the schema.`;
        const input = `CLAIMS: \n${JSON.stringify(claims)} \n\nEVIDENCE_MAP: \n${JSON.stringify(evidenceMap)} `;

        // STREAMING ADDED
        let lastLogTime = 0;
        const result = await this.librarian.jsonCompletion(input, prompt, undefined, async (text) => {
            const now = Date.now();
            if (now - lastLogTime > 2000) {
                await this.log(`[DeepReview] Verifying (${text.length} chars)...`, {
                    phase: "Phase 4: Peer Review", step: "Verifying", progress: 56, details: `(${text.length} chars)`
                });
                lastLogTime = now;
            }
        });
        return result || { supported_claims: [], unverified_claims: [] };
    }

    private async phase4_4_CritiqueMethodology(ctx: PipelineContext): Promise<string> {
        await this.log(`[DeepReview] 4.4 Critiquing Methodology...`, { phase: "Phase 4: Peer Review", step: "4.4 Methodology", progress: 57 });
        const draftText = ctx.draft!.sections.map(s => s.content).join("\n\n");
        const prompt = `Critique the research methodology.Limitations ? Validity ? Sampling bias ? logical fallacies ? Return a concise paragraph string.`;

        // STREAMING ADDED
        let lastLogTime = 0;
        const result = await this.librarian.completion(prompt, `Draft: \n${draftText} `, async (text) => {
            const now = Date.now();
            if (now - lastLogTime > 2000) {
                await this.log(`[DeepReview] Critiquing (${text.length} chars)...`, {
                    phase: "Phase 4: Peer Review", step: "Critiquing", progress: 57, details: `(${text.length} chars)`
                });
                lastLogTime = now;
            }
        });
        return result || "No methodology critique generated.";
    }

    private async phase4_5_AnalyzeStructure(ctx: PipelineContext): Promise<string> {
        await this.log(`[DeepReview] 4.5 Analyzing Structure...`, { phase: "Phase 4: Peer Review", step: "4.5 Structure", progress: 58 });
        const draftText = ctx.draft!.sections.map(s => s.content).join("\n\n");
        const prompt = `Analyze the structure, flow, and coherence.Redundancies ? Missing sections ? Logical progression ? Return a concise paragraph string.`;

        // STREAMING ADDED
        let lastLogTime = 0;
        const result = await this.librarian.completion(prompt, `Draft: \n${draftText} `, async (text) => {
            const now = Date.now();
            if (now - lastLogTime > 2000) {
                await this.log(`[DeepReview] Analyzing Structure (${text.length} chars)...`, {
                    phase: "Phase 4: Peer Review", step: "Analyzing Structure", progress: 58, details: `(${text.length} chars)`
                });
                lastLogTime = now;
            }
        });
        return result || "No structure analysis generated.";
    }

    private async phase4_6_AssessNovelty(ctx: PipelineContext): Promise<string> {
        await this.log(`[DeepReview] 4.6 Assessing Novelty...`, { phase: "Phase 4: Peer Review", step: "4.6 Novelty", progress: 59 });
        const draftText = ctx.draft!.sections.map(s => s.content).join("\n\n");
        const prompt = `Assess the novelty and contribution.Originality ? derivatives ? New insights ? Return a concise paragraph string.`;

        // STREAMING ADDED
        let lastLogTime = 0;
        const result = await this.librarian.completion(prompt, `Draft: \n${draftText} `, async (text) => {
            const now = Date.now();
            if (now - lastLogTime > 2000) {
                await this.log(`[DeepReview] Assessing Novelty (${text.length} chars)...`, {
                    phase: "Phase 4: Peer Review", step: "Assessing Novelty", progress: 59, details: `(${text.length} chars)`
                });
                lastLogTime = now;
            }
        });
        return result || "Novelty assessment unavailable.";
    }

    // ====== PHASE 5: THE REWRITER ======
    // ====== PHASE 5: THE REWRITER (Refactored v1.7.0: Patch-Based) ======
    private async phase5_Rewriter(ctx: PipelineContext): Promise<void> {
        await this.log(`[Phase 5/6] The Rewriter: Strengthening text with evidence (Evidence Integration)...`, { phase: "Phase 5: Rewriting", step: "Starting Rewrite", progress: 60 });

        if (!ctx.draft) {
            await this.log(`[Rewriter] Error: No draft to rewrite.`);
            return;
        }

        // If no report or no verified claims, skip rewrite?
        if (!ctx.reviewReport || (ctx.reviewReport.supported_claims.length === 0 && ctx.reviewReport.unverified_claims.length === 0)) {
            await this.log(`[Rewriter] No claims to address in Peer Review. Skipping rewrite.`);
            ctx.improvedDraft = ctx.draft;
            return;
        }

        const sectionsText = ctx.draft.sections.map(s => `=== SECTION: ${s.name} ===\n${s.content}\n=== END SECTION ===`).join("\n\n");
        const enhancementsText = ctx.draft.enhancements && ctx.draft.enhancements.length > 0
            ? "\n\n=== GENERATED VISUAL ENHANCEMENTS (Do not delete references to these):\n" + ctx.draft.enhancements.map(e => `- [${e.type}] ${e.title} (Location: ${e.location}): ${e.description}`).join("\n")
            : "";
        const referencesText = JSON.stringify(ctx.references, null, 2);

        // Build enhancement-level specific instructions
        const enhancementInstructions = {
            minimal: `ENHANCEMENT LEVEL: MINIMAL
    - Make only essential changes to integrate evidence.
    - Keep the original writing style intact.
    - Add evidence as brief parenthetical notes.`,
            standard: `ENHANCEMENT LEVEL: STANDARD
    - Rewrite claims to naturally incorporate evidence.
    - Improve clarity and academic rigor.
    - Add transitional phrases that connect evidence to arguments.`,
            advanced: `ENHANCEMENT LEVEL: ADVANCED
    - Significantly strengthen arguments with detailed evidence synthesis.
    - Add scholarly discourse markers ("This finding aligns with...", "Building upon...").
    - Create logical bridges between claims and supporting research.`
        };

        const enhancementGuide = enhancementInstructions[ctx.enhancementLevel as keyof typeof enhancementInstructions] || enhancementInstructions.standard;

        const systemPrompt = `You are a distinguished academic editor specializing in surgical evidence integration.

YOUR MISSION:
Review the DRAFT PAPER and the PEER REVIEW REPORT. Generate a list of "Patches" (Search & Replace operations) to improve the text based on the review.

${enhancementGuide}

=== PATCHING PROTOCOL ===
1. You must NOT output the whole paper. Output ONLY the specific changes.
2. For each change, you provide:
   - "original": The EXACT text segment to be replaced (must be unique enough to locate).
   - "new": The new text segment (rewritten with evidence).
   - "rationale": Why you made this change.

CRITICAL RULES:
- The "original" text must match the input EXACTLY (whitespace, punctuation). Copy-paste it.
- Do NOT rewrite sections that don't need changes.
- Do NOT add citation markers ((ref_X)) yet - that is Phase 6.
- PRESERVE LaTeX formatting.
- If a sentence is listed in "Supported Claims", you MUST add the supporting evidence (ref_X) context naturally, but NOT the (ref_X) string itself yet (Phase 6 does that). Actually, wait - instructions say "DO NOT add citation markers". Okay, just integrate the *content/context* of the evidence. Phase 6 inserts actual (ref_X).

OUTPUT FORMAT (JSON):
{
    "patches": [
        {
            "original": "Text to find...",
            "new": "Replacement text...",
            "rationale": "integrated reference ref_1"
        }
    ]
}`;

        const userPrompt = `DRAFT PAPER SECTIONS:
${sectionsText}
${enhancementsText}

PEER REVIEW REPORT:
${JSON.stringify(ctx.reviewReport, null, 2)}

AVAILABLE REFERENCES:
${referencesText}

TASK:
Generate the patches to address the Peer Review Report. 
Focus ONLY on the specific "Supported Claims" (integrate evidence) and "Unverified Claims" (fix/soften).
Return JSON with 'patches' array.`;

        await pRetry(async () => {
            let lastLogTime = 0;
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Rewriter timed out after 15 minutes")), 900000)
            );

            const completionPromise = this.writer.jsonCompletion(
                userPrompt,
                systemPrompt,
                undefined, // Schema optional
                async (text) => {
                    const now = Date.now();
                    if (now - lastLogTime > 2000) { // Changed to 2s
                        await this.log(`[Rewriter] Synthesizing revisions (${text.length} chars)...`, {
                            phase: "Phase 5: Rewriting",
                            step: "Synthesizing Revisions",
                            progress: 68,
                            details: `(${text.length} chars)`
                        });
                        lastLogTime = now;
                    }
                }
            );

            const result: any = await Promise.race([completionPromise, timeoutPromise]);
            const patches = result.patches || [];

            await this.log(`[Rewriter] Synthesized ${patches.length} revisions. Applying...`, { phase: "Phase 5: Rewriting", step: "Applying Revisions", progress: 70 });

            // Apply patches to each section
            // We need to match patches to sections. Since patches are just string replacements, 
            // we can try applying them to all sections or finding which section contains the 'original'.
            // Simpler: Iterate all sections and try to apply all patches. 
            // applyPatches utility handles "patch not found" gracefully.

            // Deep copy sections to avoid mutating previous phase state if something goes wrong
            const improvedSections = ctx.draft!.sections.map(s => ({ ...s }));

            let appliedCount = 0;
            for (const section of improvedSections) {
                const originalContent = section.content;
                section.content = applyPatches(originalContent, patches);
                if (section.content !== originalContent) {
                    appliedCount++; // This count is rough, applyPatches logs details
                }
            }

            ctx.improvedDraft = {
                ...ctx.draft!,
                sections: improvedSections
            };

            await this.log(`[Rewriter] Integration complete. Modified content in ${appliedCount} sections.`, { phase: "Phase 5: Rewriting", step: "Complete", progress: 75 });

        }, {
            retries: 2,
            onFailedAttempt: async (error: any) => {
                await this.log(`[Rewriter] Attempt ${error.attemptNumber} failed: ${error.message}. Retrying...`, { phase: "Phase 5: Rewriting", step: "Error - Retrying", progress: 60 });
            }
        });
    }

    // ====== PHASE 6: THE EDITOR (CHUNKED Refactor v1.6.15) ======
    private async phase6_Editor(ctx: PipelineContext): Promise<void> {
        await this.log(`[Phase 6 / 6] The Editor: Inserting citation markers...`, { phase: "Phase 6: Editing", step: "Starting Editor", progress: 78 });

        if (!ctx.improvedDraft) {
            await this.log(`[Editor] Error: No improved draft to edit.`);
            ctx.finalDraft = ctx.draft;
            return;
        }

        // If no references, just pass through
        if (ctx.references.length === 0) {
            await this.log(`[Editor] No references.Skipping citation insertion.`);
            ctx.finalDraft = ctx.improvedDraft;
            return;
        }

        // Initialize finalDraft as a deep copy of improvedDraft
        // We will update it section by section
        ctx.finalDraft = JSON.parse(JSON.stringify(ctx.improvedDraft));
        const finalDraft = ctx.finalDraft; // Capture for closure safety
        if (!finalDraft) { // Added null check for finalDraft
            await this.log(`[Editor] Error: finalDraft is null after initialization.`);
            return;
        }

        const referencesText = JSON.stringify(ctx.references, null, 2);
        const globalContext = `PAPER CONTEXT:
        TITLE: ${finalDraft.title}
        ABSTRACT: ${finalDraft.abstract}

REFERENCES TO INSERT:
${referencesText} `;

        // Process Sections (Chunked)
        for (let i = 0; i < finalDraft.sections.length; i++) {
            const section = finalDraft.sections[i];
            const shortName = section.name.length > 60 ? section.name.substring(0, 57) + "..." : section.name;
            await this.log(`[Editor] Processing Section ${i + 1} /${finalDraft.sections.length}: "${shortName}"...`, {
                phase: "Phase 6: Editing", step: `Editing Section ${i + 1}`, progress: 80 + Math.floor((i / finalDraft.sections.length) * 10)
            });

            let lastError: string | null = null;

            await pRetry(async () => {
                const systemPrompt = `You are a citation editor. Your ONLY task is to insert (ref_X) markers into the provided text section.
        
CRITICAL RULES:
1. Use (ref_X) format ONLY. 
   - CORRECT: "As shown by Kim (ref_1)..." or "This is known (ref_1, ref_2)."
   - WRONG: "\\cite{ref_1}", "\\ref{ref_1}", "[1]"
2. MATCHING: Match references to their sentences using the provided Reference List.
3. PRESERVATION: PRESERVE all existing LaTeX formatting.
4. SCOPE: Do NOT rewrite content. Only ADD markers.
5. ZERO HALLUCINATION: If a claim has no matching reference, DO NOT fabricate one. DO NOT insert (ref_X) if you are not 100% sure it applies.

LATEX SYNTAX RULES:
- Use \\\\ for manual line breaks inside lists if needed.
- Maintain \\begin{description} ... \\end{description} structures if present.
- NEVER use \\ref{ref_X} for bibliography citations. \\ref is ONLY for internal tables/figures.

${lastError ? `\nPREVIOUS ATTEMPT FAILED WITH ERROR:\n${lastError}\n\nFIX THIS ERROR.` : ""}`;

                const userPrompt = `${globalContext}

CURRENT SECTION TO EDIT:
SECTION NAME: ${section.name}
CONTENT:
${section.content}

TASK:
1. Insert (ref_X) markers at the end of relevant sentences.
2. Return ONLY the updated LaTeX content for this section.
3. Do not return JSON, just the LaTeX string.`;

                // STREAMING ADDED
                let lastLogTime = 0;
                const result = await this.writer.completion(userPrompt, systemPrompt, async (text) => {
                    const now = Date.now();
                    if (now - lastLogTime > 2000) {
                        const shortName = section.name.length > 60 ? section.name.substring(0, 57) + "..." : section.name;
                        await this.log(`[Editing] ${shortName} (${text.length} chars)...`, {
                            phase: "Phase 6: Editing",
                            step: `Editing Section ${i + 1}`,
                            progress: 80 + Math.floor((i / finalDraft.sections.length) * 10), // Added ! for finalDraft
                            details: `(${text.length} chars)`
                        });
                        lastLogTime = now;
                    }
                });

                let newContent = sanitizeLatexOutput(result);

                // If result is wrapped in quotes or markdown block, strip them
                newContent = newContent.replace(/^```latex\n?/, '').replace(/\n?```$/, '').trim();

                // SAFETY NET: If AI returns garbage or empty string, REVERT to original
                if (!newContent || newContent.length < 50) {
                    await this.log(`[Editor] Warning: Generated content too short or empty. Reverting to original for section '${section.name}'.`);
                    newContent = section.content; // Revert
                }

                // Validate LaTeX Validity of this chunk
                const val = validateLatexSyntax(newContent);
                if (!val.valid) {
                    throw new Error(`Invalid LaTeX in section '${section.name}': ${val.errors[0]}`);
                }

                // Update the section in place
                finalDraft.sections[i].content = newContent;

            }, {
                retries: 3,
                onFailedAttempt: async (error: any) => {
                    lastError = error.message;
                    await this.log(`[Editor] Section '${section.name}' failed: ${error.message}. Retrying...`);
                }
            });
        }

        // Process Enhancements (Chunked - Text Fields Only)
        if (finalDraft.enhancements) {
            for (let i = 0; i < finalDraft.enhancements.length; i++) {
                const enh = finalDraft.enhancements[i];
                // SKIP modifying 'content' for diagrams to prevent truncation/corruption
                // Only allowed to modify title and description
                await this.log(`[Editor] Processing Enhancement ${i + 1}/${finalDraft.enhancements.length}: "${enh.title}"...`, { phase: "Phase 6: Editing", step: `Editing Enhancement ${i + 1}`, progress: 90 });

                let lastError: string | null = null;

                await pRetry(async () => {
                    const systemPrompt = `You are a citation editor. Your ONLY task is to insert (ref_X) markers into the enhancement description.
        
CRITICAL RULES:
1. Use (ref_X) format.
2. Return JSON with updated 'title' and 'description'.
3. DO NOT return the 'content' field (we will preserve the original).
${lastError ? `\nPREVIOUS ERROR: ${lastError}` : ""}`;

                    const userPrompt = `${globalContext}

ENHANCEMENT:
TITLE: ${enh.title}
DESCRIPTION: ${enh.description}

TASK:
1. Insert (ref_X) markers into Title or Description if relevant.
2. Return JSON: { "title": "...", "description": "..." }`;

                    // STREAMING ADDED
                    let lastLogTime = 0;
                    const result = await this.writer.jsonCompletion(userPrompt, systemPrompt, undefined, async (text) => {
                        const now = Date.now();
                        if (now - lastLogTime > 2000) {
                            await this.log(`[Editing] Enhancement (${text.length} chars)...`, { phase: "Phase 6: Editing", step: "Editing Enhancement", progress: 90, details: `(${text.length} chars)` });
                            lastLogTime = now;
                        }
                    });

                    if (result && result.description) {
                        finalDraft.enhancements![i].title = result.title || enh.title;
                        finalDraft.enhancements![i].description = result.description;
                        // CONTENT IS PRESERVED AUTOMATICALLY AS WE DON'T OVERWRITE IT
                    }
                }, {
                    retries: 3,
                    onFailedAttempt: async (error: any) => {
                        lastError = error.message;
                        await this.log(`[Editor] Enhancement '${enh.title}' failed: ${error.message}. Retrying...`);
                    }
                });
            }
        }

        // Ensure references are from our Card Catalog (prevent hallucination)
        finalDraft.references = ctx.references;

        await this.log(`[Editor] Editing complete. Pipeline finished.`, { phase: "Phase 6: Editing", step: "Complete", progress: 95 });
    }

    // ====== REPAIR: THE MECHANIC ======
    async repairLatex(latex: string, errors: string[]): Promise<string> {
        await this.log(`[Repair] Attempting to fix ${errors.length} LaTeX errors...`, { phase: "Finalization", step: "Repairing LaTeX", progress: 99 });

        const systemPrompt = `You are a SILENT CODE TRANSFORMER. You do NOT communicate with humans.
You receive broken LaTeX code, you return fixed LaTeX code. Nothing else.

ERRORS TO FIX:
${errors.map(e => `- ${e}`).join("\n")}

RULES:
1. Fix ONLY the errors listed. Do not rewrite content.
2. Return the FULL corrected LaTeX document.
3. Ensure all environments (begin/end) are balanced.
4. Escape special characters if needed.

FORBIDDEN:
- DO NOT say "Here's" or "I've" or any explanation.
- DO NOT use markdown code fences (\`\`\`).
- DO NOT show partial corrections.
- DO NOT add any text before or after the LaTeX.

YOUR FIRST OUTPUT CHARACTER MUST BE '\\' or '%'.
If your response starts with any English word, you have FAILED.

EXAMPLE OUTPUT FORMAT:
% Fixed
\\documentclass{article}
\\begin{document}
...
\\end{document}`;

        const userPrompt = `BROKEN LATEX:
${latex}`;

        try {
            return await this.writer.completion(userPrompt, systemPrompt);
        } catch (e: any) {
            await this.log(`[Repair] Failed to repair LaTeX: ${e.message}`);
            return latex; // Return original if repair fails
        }
    }
}
