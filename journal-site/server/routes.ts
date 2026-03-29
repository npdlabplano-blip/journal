import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertJournalEntrySchema } from "@shared/schema";

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

export async function registerRoutes(server: Server, app: Express) {
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
