import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertJournalEntrySchema } from "@shared/schema";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, relative } from "path";

const GITHUB_REPO = "namsler1/journal";
const GITHUB_BRANCH = "main";

// Use direct HTTPS GitHub API — works everywhere with a personal access token
async function githubApiRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; data?: any }> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GH_ENTERPRISE_TOKEN;
  if (!token) {
    console.warn("No GitHub token found. Set GITHUB_TOKEN env var for sync.");
    return { ok: false };
  }

  const apiHost = process.env.GH_HOST
    ? `https://${process.env.GH_HOST}/api/v3`
    : "https://api.github.com";

  try {
    const url = `${apiHost}/repos/${GITHUB_REPO}/${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`GitHub API ${method} ${path}: ${res.status} ${text}`);
      return { ok: false };
    }

    const data = await res.json().catch(() => null);
    return { ok: true, data };
  } catch (error) {
    console.error("GitHub API error:", error);
    return { ok: false };
  }
}

async function syncToGitHub(
  path: string,
  content: string,
  message: string
): Promise<boolean> {
  const encoded = Buffer.from(content).toString("base64");

  // Check if file already exists to get its SHA
  let sha: string | undefined;
  const existing = await githubApiRequest("GET", `contents/${path}`);
  if (existing.ok && existing.data?.sha) {
    sha = existing.data.sha;
  }

  const body: Record<string, unknown> = {
    message,
    content: encoded,
    branch: GITHUB_BRANCH,
  };
  if (sha) body.sha = sha;

  const result = await githubApiRequest("PUT", `contents/${path}`, body);
  return result.ok;
}

async function deleteFromGitHub(path: string, message: string): Promise<boolean> {
  const existing = await githubApiRequest("GET", `contents/${path}`);
  if (!existing.ok || !existing.data?.sha) return false;

  const result = await githubApiRequest("DELETE", `contents/${path}`, {
    message,
    sha: existing.data.sha,
    branch: GITHUB_BRANCH,
  });
  return result.ok;
}

function buildGitHubPath(category: string, createdAt: string, id: number): string {
  const date = createdAt.split("T")[0];
  return `journal/${category}/${date}-${id}.md`;
}

function buildMarkdownContent(
  title: string,
  content: string,
  tags: string,
  createdAt: string,
  updatedAt: string
): string {
  const parsedTags = JSON.parse(tags || "[]");
  const tagLine = parsedTags.length > 0 ? `tags: [${parsedTags.join(", ")}]\n` : "";
  return `---
title: "${title}"
date: ${createdAt}
updated: ${updatedAt}
${tagLine}---

${content}
`;
}

// --- Import entries from disk (journal/ directory) ---

const JOURNAL_DIR = process.env.JOURNAL_DIR || "";
const CATEGORIES = ["entries", "bible-study", "prayers", "sermons"];

function parseFrontmatter(raw: string): { meta: Record<string, string>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, content: raw.trim() };

  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      meta[key] = val;
    }
  }
  return { meta, content: match[2].trim() };
}

function scanJournalDir(): void {
  if (!JOURNAL_DIR || !existsSync(JOURNAL_DIR)) {
    console.log("[scan] JOURNAL_DIR not set or missing — skipping disk import.");
    return;
  }

  const existingEntries = storage.getAllEntries();
  const trackedPaths = new Set(existingEntries.map((e) => e.githubPath).filter(Boolean));

  let imported = 0;

  for (const cat of CATEGORIES) {
    const catDir = join(JOURNAL_DIR, cat);
    if (!existsSync(catDir)) continue;

    const files = readdirSync(catDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const filePath = join(catDir, file);
      // Build the github-style path: journal/<category>/<filename>
      const githubPath = `journal/${cat}/${file}`;

      // Skip if already tracked
      if (trackedPaths.has(githubPath)) continue;

      try {
        const raw = readFileSync(filePath, "utf-8");
        const { meta, content } = parseFrontmatter(raw);

        // Derive title from frontmatter or filename
        const title = meta.title || file.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-\d+[-_]?/, "") || file;

        // Parse date from frontmatter or filename
        let createdAt = meta.date || "";
        if (!createdAt) {
          const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
          createdAt = dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString();
        }
        const updatedAt = meta.updated || createdAt;

        // Parse tags
        let tags = "[]";
        if (meta.tags) {
          const tagMatch = meta.tags.match(/\[([^\]]*)\]/);
          if (tagMatch) {
            const tagList = tagMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
            tags = JSON.stringify(tagList);
          }
        }

        const entry = storage.createEntry({
          title,
          content,
          category: cat,
          tags,
          createdAt,
          updatedAt,
        });
        storage.markSynced(entry.id, githubPath);
        imported++;
      } catch (err) {
        console.error(`[scan] Failed to import ${filePath}:`, err);
      }
    }
  }

  if (imported > 0) {
    console.log(`[scan] Imported ${imported} entries from disk.`);
  } else {
    console.log("[scan] No new entries to import from disk.");
  }
}

export async function registerRoutes(server: Server, app: Express) {
  // Import entries from disk on startup
  scanJournalDir();
  // Get all entries
  app.get("/api/entries", (_req, res) => {
    const entries = storage.getAllEntries();
    res.json(entries);
  });

  // Get single entry
  app.get("/api/entries/:id", (req, res) => {
    const entry = storage.getEntry(Number(req.params.id));
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    res.json(entry);
  });

  // Create entry
  app.post("/api/entries", async (req, res) => {
    const result = insertJournalEntrySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }
    const entry = storage.createEntry(result.data);

    // Auto-sync to GitHub
    const githubPath = buildGitHubPath(entry.category, entry.createdAt, entry.id);
    const mdContent = buildMarkdownContent(
      entry.title,
      entry.content,
      entry.tags,
      entry.createdAt,
      entry.updatedAt
    );
    const synced = await syncToGitHub(
      githubPath,
      mdContent,
      `Add journal entry: ${entry.title}`
    );
    if (synced) {
      storage.markSynced(entry.id, githubPath);
    }

    const updated = storage.getEntry(entry.id);
    res.status(201).json(updated);
  });

  // Update entry
  app.patch("/api/entries/:id", async (req, res) => {
    const id = Number(req.params.id);
    const existing = storage.getEntry(id);
    if (!existing) return res.status(404).json({ message: "Entry not found" });

    const entry = storage.updateEntry(id, req.body);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    // If category changed, delete old file
    if (
      existing.githubPath &&
      req.body.category &&
      req.body.category !== existing.category
    ) {
      await deleteFromGitHub(existing.githubPath, `Move entry: ${entry.title}`);
    }

    const githubPath = buildGitHubPath(entry.category, entry.createdAt, entry.id);
    const mdContent = buildMarkdownContent(
      entry.title,
      entry.content,
      entry.tags,
      entry.createdAt,
      entry.updatedAt
    );
    const synced = await syncToGitHub(
      githubPath,
      mdContent,
      `Update journal entry: ${entry.title}`
    );
    if (synced) {
      storage.markSynced(entry.id, githubPath);
    }

    const updated = storage.getEntry(entry.id);
    res.json(updated);
  });

  // Delete entry
  app.delete("/api/entries/:id", async (req, res) => {
    const id = Number(req.params.id);
    const entry = storage.getEntry(id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    if (entry.githubPath) {
      await deleteFromGitHub(
        entry.githubPath,
        `Delete journal entry: ${entry.title}`
      );
    }

    storage.deleteEntry(id);
    res.status(204).send();
  });

  // Manual sync endpoint
  app.post("/api/entries/:id/sync", async (req, res) => {
    const id = Number(req.params.id);
    const entry = storage.getEntry(id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    const githubPath = buildGitHubPath(entry.category, entry.createdAt, entry.id);
    const mdContent = buildMarkdownContent(
      entry.title,
      entry.content,
      entry.tags,
      entry.createdAt,
      entry.updatedAt
    );
    const synced = await syncToGitHub(
      githubPath,
      mdContent,
      `Sync journal entry: ${entry.title}`
    );

    if (synced) {
      storage.markSynced(entry.id, githubPath);
      const updated = storage.getEntry(entry.id);
      res.json(updated);
    } else {
      res.status(500).json({ message: "GitHub sync failed" });
    }
  });

  // Re-scan journal directory for new files
  app.post("/api/scan", (_req, res) => {
    scanJournalDir();
    const entries = storage.getAllEntries();
    res.json({ message: "Scan complete", count: entries.length });
  });

  // Health / sync status
  app.get("/api/status", (_req, res) => {
    const hasToken = !!(
      process.env.GITHUB_TOKEN ||
      process.env.GH_TOKEN ||
      process.env.GH_ENTERPRISE_TOKEN
    );
    res.json({
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH,
      githubConfigured: hasToken,
    });
  });
}
