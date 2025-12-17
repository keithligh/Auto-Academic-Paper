import { Response } from "express";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

// Mock File interface to match generic storage file
export interface StorageFile {
  createReadStream(): NodeJS.ReadableStream;
  getMetadata(): Promise<[{ contentType?: string; size: number }]>;
  exists(): Promise<[boolean]>;
}

export class LocalFile implements StorageFile {
  constructor(private filePath: string) { }

  createReadStream(): NodeJS.ReadableStream {
    return fs.createReadStream(this.filePath);
  }

  async getMetadata(): Promise<[{ contentType?: string; size: number }]> {
    const stats = fs.statSync(this.filePath);
    return [{
      contentType: "application/octet-stream", // Simple default
      size: stats.size
    }];
  }

  async exists(): Promise<[boolean]> {
    return [fs.existsSync(this.filePath)];
  }
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() { }

  getPrivateObjectDir(): string {
    // Hardcoded to 'uploads' in the project root for local version
    const dir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  async downloadObject(file: StorageFile, res: Response, cacheTtlSec: number = 3600) {
    try {
      const [metadata] = await file.getMetadata();
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size.toString(),
        "Cache-Control": `private, max-age=${cacheTtlSec}`,
      });
      const stream = file.createReadStream();
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({
            error: "Failed to stream file from storage",
            details: err.message
          });
        }
      });
      stream.pipe(res);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Failed to download file from storage",
          details: error?.message || String(error)
        });
      }
    }
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    // Return local URL that points to our new endpoint
    return `/api/local-upload/${objectId}`;
  }

  async getObjectEntityFile(objectPath: string): Promise<StorageFile> {
    // Handle both URL-style paths and internal paths
    let entityId = objectPath;

    // If it's a URL from our local upload, extract ID
    if (objectPath.includes("/api/local-upload/")) {
      entityId = objectPath.split("/api/local-upload/")[1];
    } else if (objectPath.startsWith("/objects/")) {
      entityId = objectPath.slice(9); // remove /objects/
    }

    const uploadDir = this.getPrivateObjectDir();
    const filePath = path.join(uploadDir, entityId);

    const file = new LocalFile(filePath);
    const [exists] = await file.exists();

    if (!exists) {
      throw new ObjectNotFoundError();
    }

    return file;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    // For local uploads, the rawPath IS the upload URL or similar
    // We can just return it or normalize it to an internal ID format
    if (rawPath.startsWith("/api/local-upload/")) {
      const id = rawPath.split("/api/local-upload/")[1];
      return `/objects/${id}`;
    }
    return rawPath;
  }
}
