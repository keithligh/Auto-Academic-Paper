import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";
import path from "path";

// Initialize SQLite database
// We use a local file named 'local.db' in the project root
const dbPath = path.join(process.cwd(), "local.db");
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema, logger: true });
