import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  try {
    if (mimeType === "application/pdf") {
      return await extractTextFromPDF(filePath);
    } else if (mimeType === "text/plain" || mimeType === "text/markdown") {
      let result = await extractTextFromTXT(filePath);

      // Sanitization: Remove existing bibliographies to prevent AI hallucination
      return sanitizeExtractedText(result);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error("Error extracting text:", error);
    throw error;
  }
}

// === SANITIZATION HELPER ===
function sanitizeExtractedText(text: string): string {
  // 1. Remove LaTeX \begin{thebibliography} blocks
  let clean = text.replace(/\\begin\{thebibliography\}[\s\S]*?\\end\{thebibliography\}/g, "");

  // 2. Remove common "References" or "Bibliography" sections at the end of text
  // Heuristic: Look for "References" followed by [1] or (Author, Year) patterns
  // We truncate everything after "References" if it looks like a list
  const refMatch = clean.match(/(^|\n)(References|Bibliography|Works Cited)\s*(\n|$)/i);
  if (refMatch) {
    // Check if what follows looks like citations (simplistic check)
    // If the remainder is > 50 chars and contains [1] or (20..., assume it's a bib
    const index = refMatch.index!;
    const remainder = clean.substring(index);
    if (remainder.length > 50 && (/\[\d+\]/.test(remainder) || /\(\d{4}\)/.test(remainder))) {
      clean = clean.substring(0, index);
    }
  }

  return clean;
}

async function extractTextFromPDF(filePath: string): Promise<string> {
  // pdf-parse v2 API: use 'data' parameter for buffer
  const { PDFParse } = require("pdf-parse");
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const result = await parser.getText();
  return result.text;
}



async function extractTextFromTXT(filePath: string): Promise<string> {
  return fs.readFileSync(filePath, "utf-8");
}

export function validateFileSize(size: number, maxSize: number): boolean {
  return size <= maxSize;
}

export function validateFileType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(mimeType);
}
