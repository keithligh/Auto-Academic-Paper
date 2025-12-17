import { type ConversionJob, type InsertConversionJob, conversionJobs } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getConversionJob(id: string): Promise<ConversionJob | undefined>;
  createConversionJob(job: InsertConversionJob): Promise<ConversionJob>;
  updateConversionJob(id: string, updates: Partial<ConversionJob>): Promise<ConversionJob | undefined>;
  deleteConversionJob(id: string): Promise<boolean>;
  listConversionJobs(): Promise<ConversionJob[]>;
  getLatestCompletedJob(): Promise<ConversionJob | undefined>;
}

export class SQLiteStorage implements IStorage {
  async getConversionJob(id: string): Promise<ConversionJob | undefined> {
    const jobs = await db.select().from(conversionJobs).where(eq(conversionJobs.id, id));
    return jobs[0];
  }

  async createConversionJob(insertJob: InsertConversionJob): Promise<ConversionJob> {
    const id = randomUUID();
    const now = new Date();
    const job: ConversionJob = {
      ...insertJob,
      status: insertJob.status || "pending",
      paperType: insertJob.paperType || "research_paper",
      enhancementLevel: insertJob.enhancementLevel || "standard",
      authorName: insertJob.authorName || null,
      authorAffiliation: insertJob.authorAffiliation || null,
      originalContent: insertJob.originalContent || null,
      analysis: insertJob.analysis || null,
      latexContent: insertJob.latexContent || null,
      enhancements: insertJob.enhancements || null,
      logs: null,
      progress: null, // Initialize progress as null
      error: insertJob.error || null,
      id,
      createdAt: now,
      completedAt: null,
    };

    console.log('[Storage] About to insert job into database:', id);
    await db.insert(conversionJobs).values(job);
    console.log('[Storage] Job inserted successfully:', id);
    return job;
  }

  async updateConversionJob(id: string, updates: Partial<ConversionJob>): Promise<ConversionJob | undefined> {
    // console.log(`[Storage] Updating job ${id} with keys: ${Object.keys(updates).join(', ')}`); // Reduced verbosity
    await db.update(conversionJobs)
      .set(updates)
      .where(eq(conversionJobs.id, id));

    return this.getConversionJob(id);
  }

  async deleteConversionJob(id: string): Promise<boolean> {
    console.log(`[Storage] Deleting job ${id}`);
    const result = await db.delete(conversionJobs).where(eq(conversionJobs.id, id));
    // Check if any rows were deleted
    // Drizzle with better-sqlite3 returns RunResult which has changes property
    return result.changes > 0;
  }

  async listConversionJobs(): Promise<ConversionJob[]> {
    return await db.select().from(conversionJobs).orderBy(conversionJobs.createdAt);
  }

  async getLatestCompletedJob(): Promise<ConversionJob | undefined> {
    // TEMP DEBUG: Get ALL jobs first, then filter in JS
    const allJobs = await db.select().from(conversionJobs);
    console.log(`[Storage] Total jobs in DB: ${allJobs.length}`);

    const completedJobs = allJobs.filter(j => j.status === 'completed');
    console.log(`[Storage] Completed jobs: ${completedJobs.length}`);

    if (completedJobs.length > 0) {
      // Sort by createdAt desc
      completedJobs.sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
      console.log(`[Storage] Returning latest: ${completedJobs[0].id}`);
      return completedJobs[0];
    }

    console.log('[Storage] No completed jobs found');
    return undefined;
  }
}

export const storage = new SQLiteStorage();
