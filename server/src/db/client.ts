import Database, { type Database as SQLiteDB } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import path from "path";
import fs from "fs";

const DB_PATH =
  process.env.DATABASE_URL ??
  path.join(process.cwd(), "data", "storage_planner.db");

// Ensure data directory exists for local dev
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export const rawDb: SQLiteDB = sqlite;
export type DB = typeof db;
