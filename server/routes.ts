import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import os from "os";
import path from "path";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { extractTextFromFile, validateFileSize, validateFileType } from "./documentParser";
import { generateLatex } from "./latexGenerator";
import { AIService } from "./ai/service";
import { sanitizeLatexForExport } from "./ai/utils"; // Auto-Academic-Paper-RC1: Export Sanitizer
import { AIConfig } from "./ai/provider";
import { maxFileSize, documentAnalysisSchema, type DocumentAnalysis, type Enhancement, type AiResponse, type JobProgress } from "@shared/schema";

// Reference: javascript_object_storage blueprint
// Configure multer for file uploads (temporary storage)
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: maxFileSize },
});

const supportedMimeTypes = [
  "application/pdf",
  "text/plain",
  "text/markdown",
];

export async function registerRoutes(app: Express): Promise<Server> {
  // Local upload endpoint (replaces Replit object storage for local dev)
  app.put("/api/local-upload/:id", async (req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");

      const objectStorageService = new ObjectStorageService();
      const uploadDir = objectStorageService.getPrivateObjectDir();

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, req.params.id);
      const writeStream = fs.createWriteStream(filePath);

      req.pipe(writeStream);

      writeStream.on("finish", () => {
        res.json({ success: true });
      });

      writeStream.on("error", (err) => {
        console.error("Upload error:", err);
        res.status(500).json({ error: "Upload failed" });
      });
    } catch (error: any) {
      console.error("Error in upload endpoint:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Serve uploaded documents
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Open upload folder in system explorer
  app.post("/api/open-upload-folder", async (_req, res) => {
    try {
      const { exec } = await import("child_process");
      const objectStorageService = new ObjectStorageService();
      const uploadDir = objectStorageService.getPrivateObjectDir();

      const command = process.platform === "win32" ? `start "" "${uploadDir}"` :
        process.platform === "darwin" ? `open "${uploadDir}"` :
          `xdg-open "${uploadDir}"`;

      exec(command, (error) => {
        if (error) {
          console.error("Failed to open folder:", error);
          // Don't fail the request if just the command failed, but log it
        }
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error opening upload folder:", error);
      res.status(500).json({ error: "Failed to open folder" });
    }
  });

  // Verify AI Configuration
  app.post("/api/verify-ai-config", async (req, res) => {
    try {
      // LOGGING ADDED FOR TRANSPARENCY
      console.log("Received Config:", JSON.stringify(req.body, null, 2));

      const config = req.body as AIConfig;
      // Extract scope if present (it might be in the body alongside config properties, or passed separately)
      // Since we are passing the whole config object, we should probably look for 'scope' in the body
      // but the body IS the config.
      // Let's assume the client sends { ...config, scope: 'writer' }
      // We need to cast it to any to access 'scope' since it's not in AIConfig type
      const scope = (req.body as any).scope;

      // Basic validation
      if (!config.writer || !config.librarian || !config.strategist) {
        return res.status(400).json({ status: "error", error: "Invalid configuration structure" });
      }

      // Instantiate service with the provided config (noop logger for verification)
      const aiService = new AIService(config, async () => { });

      // Run verification with optional scope
      const result = await aiService.verifyConnections(scope);

      if (result.success) {
        res.json({ status: "ok" });
      } else {
        res.status(400).json({ status: "error", error: result.error });
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      res.status(500).json({ status: "error", error: error.message });
    }
  });

  // Create conversion job and start processing
  app.post("/api/conversions", async (req, res) => {
    try {
      const {
        fileName,
        fileType,
        fileSize,
        uploadURL,
        paperType = "research_paper",
        enhancementLevel = "standard",
        authorName,
        authorAffiliation,
        advancedOptions = { formula: true, diagram: true, logical_structure: true, reviewDepth: "quick" }
      } = req.body;

      console.log("POST /api/conversions received", {
        fileName,
        fileType,
        fileSize,
        uploadURL,
        paperType,
        enhancementLevel,
        authorName,
        authorAffiliation,
      });

      const aiConfigHeader = req.headers["x-ai-config"] as string;
      const poeApiKey = req.headers["x-poe-api-key"] as string;

      let aiConfig: AIConfig;

      if (aiConfigHeader) {
        try {
          aiConfig = JSON.parse(aiConfigHeader);
        } catch (e) {
          return res.status(400).json({ error: "Invalid X-AI-Config header" });
        }
      } else if (poeApiKey) {
        // Legacy Fallback: Construct config from old Poe Key
        aiConfig = {
          writer: {
            provider: "poe",
            apiKey: poeApiKey,
            baseURL: "https://api.poe.com/v1",
            model: "Claude-Opus-4.5",
            isVerified: true
          },
          librarian: {
            provider: "poe",
            apiKey: poeApiKey,
            baseURL: "https://api.poe.com/v1",
            model: "Gemini25Flash-AAP",
            isVerified: true
          },
          strategist: {
            provider: "poe",
            apiKey: poeApiKey,
            baseURL: "https://api.poe.com/v1",
            model: "Claude-Opus-4.5",
            isVerified: true
          }
        };
      } else {
        return res.status(401).json({ error: "Missing API Configuration (X-AI-Config or X-Poe-Api-Key)" });
      }

      if (!fileName || !fileType || !fileSize || !uploadURL) {
        console.error("Missing required fields");
        return res.status(400).json({ error: "Missing required fields: fileName, fileType, fileSize, uploadURL" });
      }

      // Validate file type
      if (!validateFileType(fileType, supportedMimeTypes)) {
        return res.status(400).json({ error: "Unsupported file type" });
      }

      if (!validateFileSize(parseInt(fileSize), maxFileSize)) {
        return res.status(400).json({ error: "File too large" });
      }

      // Normalize object path from upload URL
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      // Create conversion job
      const job = await storage.createConversionJob({
        originalFileName: fileName,
        fileType: fileType,
        fileSize: fileSize.toString(),
        objectPath,
        status: "pending",
        paperType,
        enhancementLevel,
        authorName: authorName || null,
        authorAffiliation: authorAffiliation || null,
        originalContent: null,
        latexContent: null,
        enhancements: null,
        error: null,
      });

      console.log("Conversion job created:", job.id);

      // Start async processing - fetch file from object storage
      processDocumentFromStorage(job.id, objectPath, fileType, paperType, enhancementLevel, aiConfig, advancedOptions, authorName, authorAffiliation).catch(err => {
        console.error("Document processing error:", err);
      });

      res.json({ jobId: job.id, job });
    } catch (error) {
      console.error("Error creating conversion:", error);
      res.status(500).json({ error: "Failed to create conversion job" });
    }
  });

  // Debug import: Create a preview job from raw LaTeX (for debugging TikZ etc)
  app.post("/api/conversions/debug-import", async (req, res) => {
    try {
      const { latexContent, originalFileName } = req.body;

      if (!latexContent) {
        return res.status(400).json({ error: "No LaTeX content provided" });
      }

      const job = await storage.createConversionJob({
        originalFileName: originalFileName || "imported.tex",
        fileType: "tex",
        fileSize: String(latexContent.length),
        objectPath: `debug-import/${Date.now()}`,
        paperType: "research_paper",
        enhancementLevel: "standard"
      });

      // Mark as completed with the imported LaTeX
      await storage.updateConversionJob(job.id, {
        status: "completed",
        latexContent,
        originalContent: "[Debug Import]",
        completedAt: new Date()
      });

      res.json({ id: job.id, status: "completed" });
    } catch (error) {
      console.error("Error creating debug import:", error);
      res.status(500).json({ error: "Failed to create debug import" });
    }
  });

  // Get latest completed conversion job (for "Recall Last" feature) - MUST be before /:id
  app.get("/api/conversions/latest", async (req, res) => {
    try {
      const job = await storage.getLatestCompletedJob();
      if (!job) {
        return res.status(404).json({ error: "No completed jobs found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching latest job:", error);
      res.status(500).json({ error: "Failed to fetch latest job" });
    }
  });

  // Get conversion job status
  app.get("/api/conversions/:id", async (req, res) => {
    try {
      const job = await storage.getConversionJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  // NEW: Download Optimized for Export (Sanitized)
  // This separates the "Preview Version" (Database) from the "Compile-Ready Version" (Download)
  app.get("/api/conversions/:id/export", async (req, res) => {
    try {
      const job = await storage.getConversionJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });
      if (!job.latexContent) return res.status(400).json({ error: "No LaTeX content available" });

      // "Just-In-Time" Sanitization for Export
      const exportSafeLatex = sanitizeLatexForExport(job.latexContent);

      const filename = job.originalFileName
        ? job.originalFileName.replace(/\.[^/.]+$/, "") + "_export.tex"
        : `paper_${job.id}.tex`;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/x-tex; charset=utf-8');
      // Use Buffer to prevent BOM from being added
      res.send(Buffer.from(exportSafeLatex, 'utf-8'));

    } catch (error) {
      console.error("Error exporting job:", error);
      res.status(500).json({ error: "Failed to export job" });
    }
  });


  // Update enhancements (toggle enabled state)
  app.patch("/api/conversions/:id/enhancements", async (req, res) => {
    try {
      const job = await storage.getConversionJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const { enhancements } = req.body;
      if (!enhancements) {
        return res.status(400).json({ error: "Enhancements required" });
      }

      // Update job with new enhancements
      const updatedJob = await storage.updateConversionJob(req.params.id, {
        enhancements,
      });

      // Regenerate LaTeX with updated enhancements
      if (updatedJob && job.originalContent) {
        // Validate analysis data from storage
        let analysis: DocumentAnalysis;
        try {
          analysis = documentAnalysisSchema.parse(job.analysis);
        } catch (e: any) {
          console.error(`Job ${req.params.id} has corrupted analysis data`, e);
          return res.status(500).json({
            error: "Analysis data is corrupted. Please re-process the document.",
            details: e?.message || String(e)
          });
        }

        const newLatex = await generateLatex(
          analysis,
          enhancements as Enhancement[],
          job.paperType,
          job.authorName || undefined,
          job.authorAffiliation || undefined,
          undefined, // writerModel (Unknown on re-generation)
          undefined, // strategistModel
          undefined  // librarianModel
        );

        await storage.updateConversionJob(req.params.id, {
          latexContent: newLatex,
        });
      }

      res.json(updatedJob);
    } catch (error) {
      console.error("Error updating enhancements:", error);
      res.status(500).json({ error: "Failed to update enhancements" });
    }
  });

  // List all conversion jobs
  app.get("/api/conversions", async (req, res) => {
    try {
      const jobs = await storage.listConversionJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error listing jobs:", error);
      res.status(500).json({ error: "Failed to list jobs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Async function to process document
async function processDocumentFromStorage(
  jobId: string,
  objectPath: string,
  mimeType: string,
  paperType: string,
  enhancementLevel: string,
  aiConfig: AIConfig,
  advancedOptions: Record<string, any>,
  authorName?: string,
  authorAffiliation?: string
) {
  try {
    console.log("Starting document processing from storage:", { jobId, objectPath });

    // Update status to processing
    await storage.updateConversionJob(jobId, { status: "processing" });

    // Fetch file from object storage
    const objectStorageService = new ObjectStorageService();
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // Download file to temp location
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const tempPath = path.join(os.tmpdir(), `doc-${jobId}-${Date.now()}`);

    // Write file content to temp path using stream
    const writeStream = fs.createWriteStream(tempPath);
    const readStream = objectFile.createReadStream();

    await new Promise<void>((resolve, reject) => {
      readStream.pipe(writeStream);
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
      readStream.on("error", reject);
    });

    console.log("File downloaded to temp path:", tempPath);

    // Process the document using the temp file
    await processDocumentFile(jobId, tempPath, mimeType, paperType, enhancementLevel, aiConfig, advancedOptions, authorName, authorAffiliation);

    // Clean up temp file
    fs.unlinkSync(tempPath);

  } catch (error: any) {
    console.error("Processing from storage failed:", error);
    await storage.updateConversionJob(jobId, {
      status: "failed",
      error: error.message,
    });
  }
}

// Global log queue to prevent race conditions
const logQueues: Record<string, Promise<void>> = {};

// Helper to append logs to the job (Serialized)
// UPDATED: Now supports structured progress updates and optimized terminal output
async function logJobProgress(jobId: string, message: string, progress?: JobProgress) {
  const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
  const logEntry = `[${timestamp}] ${message}`;

  // OPTIMIZED TERMINAL LOGGING: Truncate long messages
  let terminalMessage = message;
  if (terminalMessage.length > 200) {
    terminalMessage = terminalMessage.substring(0, 200) + "... (truncated)";
  }
  console.log(`[Job ${jobId}] ${terminalMessage}`);

  // Initialize queue for this job if not exists
  if (!logQueues[jobId]) {
    logQueues[jobId] = Promise.resolve();
  }

  // Chain the update to the existing promise
  logQueues[jobId] = logQueues[jobId].then(async () => {
    try {
      // Fetch current logs
      const job = await storage.getConversionJob(jobId);
      const currentLogs = (job?.logs as string[]) || [];

      // Update object
      const updates: any = {
        logs: [...currentLogs, logEntry]
      };

      // If progress is provided, update it (Micro-Checkpoint)
      if (progress) {
        updates.progress = progress;
      }

      // Append new log and update progress
      await storage.updateConversionJob(jobId, updates);
    } catch (e) {
      console.error(`Failed to write log for job ${jobId}:`, e);
    }
  });

  // Wait for this specific update to complete (optional, but good for flow control)
  // REMOVED: Do not await the queue. Let it process in background to prevent blocking the AI pipeline.
  // await logQueues[jobId];
}

async function processDocumentFile(
  jobId: string,
  filePath: string,
  mimeType: string,
  paperType: string,
  enhancementLevel: string,
  aiConfig: AIConfig,
  advancedOptions: Record<string, any>,
  authorName?: string,
  authorAffiliation?: string
) {
  try {
    const fs = await import("fs");

    // === PASSTHROUGH PROTOCOL (The Magic Mechanism) ===
    // If it's a LaTeX file, we skip the entire AI pipeline and use it directly.
    // This turns the app into a "Universal LaTeX Previewer".
    if (mimeType === "application/x-tex" || filePath.endsWith(".tex")) {
      await logJobProgress(jobId, "LaTeX file detected. Activating Passthrough Protocol...", { phase: "Initialization", step: "Passthrough Detected", progress: 0 });

      const latexContent = fs.readFileSync(filePath, "utf-8");

      await storage.updateConversionJob(jobId, {
        status: "completed",
        originalContent: latexContent, // Store original for reference
        latexContent: latexContent, // Direct injection
        analysis: {
          title: "Imported LaTeX Document",
          abstract: "This document was imported directly via the Passthrough Protocol.",
          sections: [],
          references: []
        }, // Dummy analysis to satisfy schema
        completedAt: new Date()
      });

      await logJobProgress(jobId, "Passthrough complete. Rendering preview.", { phase: "Complete", step: "Done", progress: 100 });
      return;
    }
    // ==================================================

    // Update status to processing
    await storage.updateConversionJob(jobId, { status: "processing" });
    await logJobProgress(jobId, "Initializing processing environment...", { phase: "Initialization", step: "Setup", progress: 0 });

    // Step 1: Extract text
    await logJobProgress(jobId, "Step 1: Extracting text from document...", { phase: "Phase 1: Extraction", step: "Extracting Text", progress: 5 });
    const text = await extractTextFromFile(filePath, mimeType);
    await storage.updateConversionJob(jobId, { originalContent: text });
    await logJobProgress(jobId, `Text extraction complete. Length: ${text.length} chars.`, { phase: "Phase 1: Extraction", step: "Complete", progress: 10 });

    // Step 2: Analyze document AND generate enhancements
    await logJobProgress(jobId, "Step 2: Starting AI Analysis & Research...", { phase: "Phase 2: Analysis", step: "Starting AI", progress: 15 });

    // Define a logger callback to pass to the AI function
    // UPDATED: Accepts optional progress object
    const logger = async (msg: string, progress?: JobProgress) => await logJobProgress(jobId, msg, progress);

    // analyzeDocument now returns a typed AiResponse object (DocumentAnalysis + enhancements)
    const aiService = new AIService(aiConfig, logger);
    const aiResponse: AiResponse = await aiService.processDocument(
      text,
      paperType,
      enhancementLevel,
      advancedOptions
    );

    // Separate analysis and enhancements
    const { enhancements: aiEnhancements, ...analysisData } = aiResponse;

    // Map AI enhancements to DB schema (add IDs and enabled status)
    const enhancements: Enhancement[] = aiEnhancements.map((e, i) => ({
      id: `enh-${Date.now()}-${i}`,
      enabled: true,
      ...e
    }));

    await storage.updateConversionJob(jobId, {
      analysis: analysisData,
      enhancements: enhancements
    });
    await logJobProgress(jobId, "AI Analysis complete. Structure and enhancements generated.", { phase: "Phase 4: Synthesis", step: "Enhancements Generated", progress: 80 });

    // Step 3: Generate LaTeX with integrated enhancements
    await logJobProgress(jobId, "Step 3: Generating LaTeX code...", { phase: "Phase 5: Compilation", step: "Generating LaTeX", progress: 85 });
    let latex;
    let latexError = null;

    try {
      latex = await generateLatex(
        analysisData,
        enhancements,
        paperType,
        authorName,
        authorAffiliation,
        aiConfig.writer.model,
        aiConfig.strategist.model,
        aiConfig.librarian.model
      );
      await logJobProgress(jobId, "LaTeX generation successful.", { phase: "Phase 5: Compilation", step: "LaTeX Generated", progress: 90 });
    } catch (latexError: any) {
      console.error('[LaTeX Generation] Failed to generate LaTeX:', latexError);
      throw new Error(`LaTeX generation failed: ${latexError.message}. Please check your enhancements or re-process the document.`);
    }

    // Step 4: Validate LaTeX syntax (optional)
    await logJobProgress(jobId, "Step 4: Validating LaTeX syntax...", { phase: "Phase 5: Compilation", step: "Validating LaTeX", progress: 95 });
    let validationWarnings: string[] = [];
    try {
      const { validateLatexSyntax } = await import('./latexValidator');
      const validation = validateLatexSyntax(latex);

      if (!validation.valid) {
        console.warn('[LaTeX Validation] Errors detected:', validation.errors);

        // --- AUTO-REPAIR LOOP ---
        await logJobProgress(jobId, `Validation failed. Attempting auto-repair for ${validation.errors.length} errors...`, { phase: "Phase 5: Compilation", step: "Auto-Repairing", progress: 98 });

        try {
          const aiService = new AIService(aiConfig, logger);
          const repairedLatex = await aiService.repairLatex(latex, validation.errors);

          // Re-validate
          const revalidation = validateLatexSyntax(repairedLatex);
          if (revalidation.valid) {
            latex = repairedLatex; // Success!
            validationWarnings.push("LaTeX was auto-repaired successfully.");
            await logJobProgress(jobId, "Auto-repair successful. LaTeX is valid.", { phase: "Phase 5: Compilation", step: "Repair Success", progress: 99 });
          } else {
            validationWarnings.push(...revalidation.errors);
            await logJobProgress(jobId, "Auto-repair partially failed. Some errors remain.", { phase: "Phase 5: Compilation", step: "Repair Warning", progress: 99 });
            // We still save the repaired version as it's likely better than the original
            latex = repairedLatex;
          }
        } catch (repairErr: any) {
          console.error("Repair failed:", repairErr);
          validationWarnings.push(`Repair system failed: ${repairErr.message}`);
        }
        // ------------------------

      } else {
        await logJobProgress(jobId, "LaTeX syntax is valid.", { phase: "Phase 5: Compilation", step: "Validation Passed", progress: 98 });
      }

      if (validation.warnings.length > 0) {
        console.warn('[LaTeX Validation] Warnings:', validation.warnings);
        validationWarnings.push(...validation.warnings);
      }
    } catch (validationError: any) {
      console.error('[LaTeX Validation] Validation failed:', validationError);
      validationWarnings.push(`Validation system error: ${validationError.message || String(validationError)}`);
    }

    await storage.updateConversionJob(jobId, {
      latexContent: latex,
      status: "completed",
      completedAt: new Date(),
      ...(latexError ? { error: latexError } : {}),
      ...(validationWarnings.length > 0 ? {
        error: [latexError, `LaTeX validation warnings: ${validationWarnings.join('; ')}`].filter(Boolean).join(' | ')
      } : {})
    });
    await logJobProgress(jobId, "Processing complete. Ready for review.", { phase: "Complete", step: "Done", progress: 100 });

  } catch (error: any) {
    console.error("Processing error:", error);
    await logJobProgress(jobId, `CRITICAL ERROR: ${error.message}`, { phase: "Error", step: "Failed", progress: 0, details: error.message });
    await storage.updateConversionJob(jobId, {
      status: "failed",
      error: error.message,
    });
  }
}
