import { journalEntries, type JournalEntry, type InsertJournalEntry } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";

const dbPath = process.env.DATABASE_PATH || "journal.db";
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

export interface IStorage {
  getAllEntries(): JournalEntry[];
  getEntry(id: number): JournalEntry | undefined;
  createEntry(entry: InsertJournalEntry): JournalEntry;
  updateEntry(id: number, entry: Partial<InsertJournalEntry>): JournalEntry | undefined;
  deleteEntry(id: number): boolean;
  markSynced(id: number, githubPath: string): void;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Create table if not exists
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'entries',
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0,
        github_path TEXT
      )
    `);
  }

  getAllEntries(): JournalEntry[] {
    return db.select().from(journalEntries).orderBy(desc(journalEntries.createdAt)).all();
  }

  getEntry(id: number): JournalEntry | undefined {
    return db.select().from(journalEntries).where(eq(journalEntries.id, id)).get();
  }

  createEntry(entry: InsertJournalEntry): JournalEntry {
    return db.insert(journalEntries).values(entry).returning().get();
  }

  updateEntry(id: number, entry: Partial<InsertJournalEntry>): JournalEntry | undefined {
    const existing = this.getEntry(id);
    if (!existing) return undefined;
    return db
      .update(journalEntries)
      .set({ ...entry, updatedAt: new Date().toISOString(), synced: false })
      .where(eq(journalEntries.id, id))
      .returning()
      .get();
  }

  deleteEntry(id: number): boolean {
    const result = db.delete(journalEntries).where(eq(journalEntries.id, id)).run();
    return result.changes > 0;
  }

  markSynced(id: number, githubPath: string): void {
    db.update(journalEntries)
      .set({ synced: true, githubPath })
      .where(eq(journalEntries.id, id))
      .run();
  }
}

export const storage = new DatabaseStorage();
