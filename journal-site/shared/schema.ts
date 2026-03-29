import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const journalEntries = sqliteTable("journal_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("entries"),
  tags: text("tags").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  synced: integer("synced", { mode: "boolean" }).notNull().default(false),
  githubPath: text("github_path"),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({
  id: true,
  synced: true,
  githubPath: true,
});

export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;
