#!/usr/bin/env node

/**
 * Bulk Email Archiver
 *
 * Archives promotional, social, news, and other noise emails
 * based on the cleanup rules in feedback_email_cleanup.md.
 *
 * Usage:
 *   node mcp-server/src/archive-promos.js              # dry run (shows what would be archived)
 *   node mcp-server/src/archive-promos.js --archive     # actually archive
 *   node mcp-server/src/archive-promos.js --archive --limit 500  # archive up to 500
 */

import { google } from "googleapis";
import { getAuthClient } from "./auth.js";

// ── Configuration ──────────────────────────────────────────────────────────

const BATCH_SIZE = 50; // Gmail API max per list request
const ARCHIVE_BATCH = 10; // emails to archive per API call (avoid rate limits)
const RATE_LIMIT_DELAY_MS = 250; // delay between archive batches
const DEFAULT_LIMIT = 200; // default max emails per run

// Gmail queries that match noise categories.
// Each query targets a category from the cleanup rules.
const NOISE_QUERIES = [
  // Promotional / Marketing — broad category match
  "category:promotions",
  // Social — LinkedIn, Nextdoor, Facebook, etc.
  "category:social",
  // News newsletters
  `from:(nytimes.com OR washingtonpost.com OR wsj.com OR dailywire.com OR news4sanantonio OR flightaware)`,
  // Permanent auto-archive senders
  `from:(googlealerts-noreply@google.com OR hello@my.simple.life)`,
  // Faith (non-Coppell Bible) — archive these specifically
  `from:(churchgrowth.org OR crossway.org OR daily.pray.com OR precept.org)`,
];

// Senders/patterns to NEVER archive, even if they match a noise category.
// These override the noise queries above.
const KEEP_PATTERNS = [
  /parentsquare/i,
  /coppellisd/i,
  /coppellbible/i,
  /ptso/i,
  /schoology/i,
  /remind\.com/i,
  // Financial alerts (not marketing)
  /account.*alert/i,
  /fraud.*alert/i,
  /payment.*due/i,
  /statement.*ready/i,
];

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--archive");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : DEFAULT_LIMIT;

  if (dryRun) {
    console.log("🔍 DRY RUN — showing what would be archived. Use --archive to actually archive.\n");
  } else {
    console.log(`📬 ARCHIVE MODE — will archive up to ${limit} emails.\n`);
  }

  // Auth via existing 1Password-backed OAuth
  const auth = await getAuthClient();
  const gmail = google.gmail({ version: "v1", auth });

  let totalFound = 0;
  let totalArchived = 0;
  let totalSkipped = 0;

  for (const query of NOISE_QUERIES) {
    if (totalArchived >= limit) break;

    const fullQuery = `is:inbox ${query}`;
    console.log(`\n── Query: ${query}`);

    let pageToken = undefined;
    let queryFound = 0;

    while (totalArchived < limit) {
      // List matching messages
      const res = await gmail.users.messages.list({
        userId: "me",
        q: fullQuery,
        maxResults: BATCH_SIZE,
        pageToken,
      });

      const messages = res.data.messages || [];
      if (messages.length === 0) break;

      // Fetch headers to check against keep patterns
      const toArchive = [];

      for (const msg of messages) {
        if (totalArchived + toArchive.length >= limit) break;

        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject"],
        });

        const headers = detail.data.payload?.headers || [];
        const from = headers.find((h) => h.name === "From")?.value || "";
        const subject = headers.find((h) => h.name === "Subject")?.value || "";

        // Check if this email should be kept
        const shouldKeep = KEEP_PATTERNS.some(
          (pat) => pat.test(from) || pat.test(subject)
        );

        if (shouldKeep) {
          totalSkipped++;
          console.log(`  KEEP: ${from.slice(0, 40)} — ${subject.slice(0, 60)}`);
          continue;
        }

        toArchive.push({ id: msg.id, from, subject });
      }

      queryFound += toArchive.length;

      if (dryRun) {
        for (const email of toArchive) {
          console.log(`  WOULD ARCHIVE: ${email.from.slice(0, 40)} — ${email.subject.slice(0, 60)}`);
        }
        totalArchived += toArchive.length;
      } else {
        // Archive in small batches to avoid rate limits
        for (let i = 0; i < toArchive.length; i += ARCHIVE_BATCH) {
          const batch = toArchive.slice(i, i + ARCHIVE_BATCH);
          const ids = batch.map((e) => e.id);

          await gmail.users.messages.batchModify({
            userId: "me",
            requestBody: {
              ids,
              removeLabelIds: ["INBOX"],
            },
          });

          totalArchived += batch.length;
          process.stdout.write(`  Archived ${totalArchived} so far...\r`);

          if (i + ARCHIVE_BATCH < toArchive.length) {
            await sleep(RATE_LIMIT_DELAY_MS);
          }
        }
        console.log();
      }

      pageToken = res.data.nextPageToken;
      if (!pageToken) break;
    }

    totalFound += queryFound;
    console.log(`  → ${queryFound} emails ${dryRun ? "would be archived" : "archived"} for this query`);
  }

  console.log("\n════════════════════════════════════════");
  console.log(`Total found:    ${totalFound}`);
  console.log(`Total skipped:  ${totalSkipped} (matched keep patterns)`);
  console.log(`Total archived: ${totalArchived}${dryRun ? " (dry run)" : ""}`);
  console.log("════════════════════════════════════════\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
