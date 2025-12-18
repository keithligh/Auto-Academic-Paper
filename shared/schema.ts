import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Document Analysis result from AI
export const documentAnalysisSchema = z.object({
  title: z.string(),
  abstract: z.string(),
  sections: z.array(z.object({
    name: z.string(),
    content: z.string()
  })),
  // ARCHITECTURE FIX: Separate bibliography from sections to prevent hallucinations
  bibliography: z.string().optional(),
  references: z.array(z.object({
    key: z.string(),
    author: z.string(),
    title: z.string(),
    venue: z.string(),
    year: z.number(),
    url: z.string().optional()
  })).optional(),
  reviewReport: z.object({
    supported_claims: z.array(z.any()),
    unverified_claims: z.array(z.any()),
    novelty_check: z.string().optional(),
    critique: z.string().optional()
  }).optional()
});

export type DocumentAnalysis = z.infer<typeof documentAnalysisSchema>;

// ===== 6-PHASE DEEP WORK PIPELINE SCHEMAS =====

// Phase 1 Output: Strategic Execution Plan
export const sectionPlanSchema = z.object({
  name: z.string(),
  goal: z.string(), // "Argue X", "Refute Y"
  required_evidence: z.array(z.string()) // ["Stat on Z", "Theory A"]
});

export const executionPlanSchema = z.object({
  title_idea: z.string(),
  abstract_goal: z.string(),
  sections: z.array(sectionPlanSchema),
  search_queries: z.array(z.string()),
  key_terms: z.array(z.string()).optional().describe("List of proper nouns, names, and specific terms that MUST be retained from the source.")
});

export type SectionPlan = z.infer<typeof sectionPlanSchema>;
export type ExecutionPlan = z.infer<typeof executionPlanSchema>;

// Phase 2 Output: Researched Claim (reused for Phase 4)
export const claimSchema = z.object({
  sentence: z.string(),
  context: z.string(),
  reasoning: z.string()
});

export type Claim = z.infer<typeof claimSchema>;

// Researched Claim with Citation
export const researchedClaimSchema = claimSchema.extend({
  citation: z.object({
    key: z.string(),
    author: z.string(),
    title: z.string(),
    venue: z.string(),
    year: z.number(),
    url: z.string().optional()
  }).nullable(),
  searchQuery: z.string()
});

export type ResearchedClaim = z.infer<typeof researchedClaimSchema>;


// AI Enhancement (raw output from AI, no ID or enabled status)
export const aiEnhancementSchema = z.object({
  type: z.enum(["formula", "hypothesis", "diagram", "logical_structure", "symbol", "table", "figure", "equation", "theorem", "proof", "code_listing", "algorithm"]),
  title: z.string(),
  description: z.string(),
  content: z.string(),
  location: z.string(),
  reasoning: z.string()
});

export type AiEnhancement = z.infer<typeof aiEnhancementSchema>;

// AI Response Schema (Analysis + Enhancements)
export const aiResponseSchema = documentAnalysisSchema.extend({
  enhancements: z.array(aiEnhancementSchema)
});

export type AiResponse = z.infer<typeof aiResponseSchema>;

// Enhancement represents an AI-suggested addition to the document
export const enhancementSchema = z.object({
  id: z.string(),
  type: z.enum(["formula", "hypothesis", "diagram", "logical_structure", "symbol", "table", "figure", "equation", "theorem", "proof", "code_listing", "algorithm"]),
  title: z.string(),
  description: z.string(),
  content: z.string(), // LaTeX or text content
  location: z.string(), // Section where it should be inserted
  enabled: z.boolean(), // Whether user has accepted this enhancement
  reasoning: z.string() // AI's explanation for adding this
});

export type Enhancement = z.infer<typeof enhancementSchema>;

// Job Progress Schema for Micro-Checkpoints
export const jobProgressSchema = z.object({
  phase: z.string(),       // e.g., "Phase 1: Drafting"
  step: z.string(),        // e.g., "Drafting section: Introduction"
  progress: z.number(),    // 0-100 percentage
  details: z.string().optional() // Granular detail e.g. "Researching claim 4/6"
});

export type JobProgress = z.infer<typeof jobProgressSchema>;

// Conversion Job represents a document conversion request
export const conversionJobs = sqliteTable("conversion_jobs", {
  id: text("id").primaryKey(), // UUID generated in application
  originalFileName: text("original_file_name").notNull(),
  fileType: text("file_type").notNull(), // 'pdf', 'docx', 'txt'
  fileSize: text("file_size").notNull(),
  objectPath: text("object_path").notNull(), // Path to uploaded file in object storage
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  paperType: text("paper_type").notNull().default("research_paper"), // 'research_paper', 'essay', 'thesis'
  enhancementLevel: text("enhancement_level").notNull().default("standard"), // 'minimal', 'standard', 'advanced'
  authorName: text("author_name"), // Author name for the paper
  authorAffiliation: text("author_affiliation"), // Author affiliation/institution
  originalContent: text("original_content"), // Extracted text from document
  analysis: text("analysis", { mode: "json" }).$type<DocumentAnalysis>(), // Document analysis results (title, abstract, sections)
  latexContent: text("latex_content"), // Generated LaTeX
  enhancements: text("enhancements", { mode: "json" }).$type<Enhancement[]>(), // Array of enhancement objects
  logs: text("logs", { mode: "json" }).$type<string[]>(), // Real-time processing logs
  progress: text("progress", { mode: "json" }).$type<JobProgress>(), // Micro-checkpoint progress
  error: text("error"), // Error message if failed
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const insertConversionJobSchema = createInsertSchema(conversionJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
}).extend({
  analysis: documentAnalysisSchema.optional().nullable(),
  enhancements: z.array(enhancementSchema).optional().nullable(),
  progress: jobProgressSchema.optional().nullable()
});

export type InsertConversionJob = z.infer<typeof insertConversionJobSchema>;
export type ConversionJob = typeof conversionJobs.$inferSelect;

// Paper Type options
export const paperTypes = [
  { value: "research_paper", label: "Research Paper" },
  { value: "essay", label: "Essay" },
  { value: "thesis", label: "Thesis" },
] as const;

// Enhancement Level options
export const enhancementLevels = [
  { value: "minimal", label: "Minimal", description: "Basic formatting only" },
  { value: "standard", label: "Standard", description: "Balanced enhancements" },
  { value: "advanced", label: "Advanced", description: "Maximum scholarly elements" },
] as const;

// Processing status steps
export const processingSteps = [
  { id: "upload", label: "Upload", description: "Uploading document" },
  { id: "analyze", label: "Analyze", description: "Analyzing content" },
  { id: "enhance", label: "Enhance", description: "Adding scholarly elements" },
  { id: "review", label: "Review", description: "Ready for review" },
] as const;

// File type validation
export const supportedFileTypes = {
  'application/pdf': { ext: '.pdf', label: 'PDF' },
  'text/plain': { ext: '.txt', label: 'TXT' },
} as const;

export const maxFileSize = 50 * 1024 * 1024; // 50MB in bytes

// ===== AI CONFIGURATION SCHEMAS =====

export const providerTypeSchema = z.enum(["poe", "openrouter", "grok", "openai", "anthropic", "gemini", "ollama", "custom"]);
export type ProviderType = z.infer<typeof providerTypeSchema>;

export const providerConfigSchema = z.object({
  provider: providerTypeSchema,
  apiKey: z.string(),
  baseURL: z.string().optional(),
  model: z.string(),
  isVerified: z.boolean().optional().default(false)
});
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export const searchConfigSchema = z.object({
  provider: z.enum(["tavily", "serpapi", "none"]),
  apiKey: z.string().optional()
});
export type SearchConfig = z.infer<typeof searchConfigSchema>;

export const aiConfigSchema = z.object({
  writer: providerConfigSchema,
  librarian: providerConfigSchema,
  strategist: providerConfigSchema,
  search: searchConfigSchema.optional()
});
export type AIConfig = z.infer<typeof aiConfigSchema>;

export const defaultAIConfig: AIConfig = {
  writer: {
    provider: "poe",
    apiKey: "",
    model: "Claude-Opus-4.5",
    isVerified: false
  },
  librarian: {
    provider: "poe",
    apiKey: "",
    model: "Gemini3Flash-AAP",
    isVerified: false
  },
  strategist: {
    provider: "poe",
    apiKey: "",
    model: "Claude-Opus-4.5", // Defaults to Writer-like model
    isVerified: false
  }
};
