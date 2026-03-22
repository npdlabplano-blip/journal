/**
 * Gmail Tools
 *
 * Provides read/modify access to Gmail:
 * - get_unread_count: Quick unread email count
 * - list_emails: Search/list emails using Gmail query syntax
 * - read_email: Read full email content by ID
 * - trash_email: Move an email to trash
 * - archive_email: Archive an email (remove from inbox, keep in All Mail)
 * - archive_emails: Archive multiple emails at once
 * - send_email: Compose and send an email
 */

import { google } from "googleapis";
import { z } from "zod";

/**
 * Decode base64url-encoded email body content.
 * Gmail API returns body data in base64url format.
 */
function decodeBody(data) {
  if (!data) return "";
  return Buffer.from(data, "base64url").toString("utf-8");
}

/**
 * Extract the plain text body from a Gmail message.
 * Emails can be simple (body right on the payload) or multipart
 * (body nested in parts — like when there's both HTML and plain text).
 */
function getMessageBody(payload) {
  // Simple message — body is directly on the payload
  if (payload.body?.data) {
    return decodeBody(payload.body.data);
  }

  // Multipart message — look through the parts
  if (payload.parts) {
    // Prefer plain text over HTML
    const textPart = payload.parts.find(
      (part) => part.mimeType === "text/plain"
    );
    if (textPart?.body?.data) {
      return decodeBody(textPart.body.data);
    }

    // Fall back to HTML if no plain text
    const htmlPart = payload.parts.find(
      (part) => part.mimeType === "text/html"
    );
    if (htmlPart?.body?.data) {
      return decodeBody(htmlPart.body.data);
    }

    // Check nested multipart (e.g., multipart/alternative inside multipart/mixed)
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = getMessageBody(part);
        if (nested) return nested;
      }
    }
  }

  return "(Could not extract message body)";
}

/**
 * Extract a specific header value from a Gmail message.
 */
function getHeader(headers, name) {
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value || "";
}

export function registerGmailTools(server, authClient) {
  const gmail = google.gmail({ version: "v1", auth: authClient });

  /**
   * Get unread email count.
   * Quick way to check if there are emails needing attention.
   */
  server.tool(
    "get_unread_count",
    "Get the number of unread emails in your inbox",
    {},
    async () => {
      const res = await gmail.users.labels.get({
        userId: "me",
        id: "INBOX",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                unread: res.data.messagesUnread,
                total: res.data.messagesTotal,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  /**
   * List/search emails using Gmail's powerful query syntax.
   *
   * Supports the same queries you'd use in Gmail's search bar:
   * - "from:boss@work.com"
   * - "subject:meeting is:unread"
   * - "after:2026/03/01 before:2026/03/21"
   * - "has:attachment filename:pdf"
   * - "label:important"
   */
  server.tool(
    "list_emails",
    "Search/list emails using Gmail query syntax (e.g., 'from:someone@example.com', 'is:unread', 'subject:meeting')",
    {
      query: z
        .string()
        .default("is:inbox")
        .describe(
          'Gmail search query (e.g., "is:unread", "from:someone@example.com", "subject:meeting after:2026/03/01")'
        ),
      maxResults: z
        .number()
        .default(20)
        .describe("Maximum number of emails to return (default 20)"),
    },
    async ({ query, maxResults }) => {
      const res = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults,
      });

      if (!res.data.messages || res.data.messages.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No emails found matching: "${query}"`,
            },
          ],
        };
      }

      // Fetch headers for each message (subject, from, date)
      const emails = await Promise.all(
        res.data.messages.map(async (msg) => {
          const detail = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
            format: "metadata",
            metadataHeaders: ["Subject", "From", "Date"],
          });

          return {
            id: detail.data.id,
            threadId: detail.data.threadId,
            subject: getHeader(detail.data.payload.headers, "Subject"),
            from: getHeader(detail.data.payload.headers, "From"),
            date: getHeader(detail.data.payload.headers, "Date"),
            snippet: detail.data.snippet,
            unread: detail.data.labelIds?.includes("UNREAD") || false,
          };
        })
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(emails, null, 2),
          },
        ],
      };
    }
  );

  /**
   * Read the full content of a specific email.
   * Use list_emails first to find the email ID.
   */
  server.tool(
    "read_email",
    "Read the full content of an email by its ID. Use list_emails first to find IDs.",
    {
      emailId: z.string().describe("The email ID (from list_emails results)"),
    },
    async ({ emailId }) => {
      const res = await gmail.users.messages.get({
        userId: "me",
        id: emailId,
        format: "full",
      });

      const headers = res.data.payload.headers;
      const body = getMessageBody(res.data.payload);

      const email = {
        id: res.data.id,
        threadId: res.data.threadId,
        subject: getHeader(headers, "Subject"),
        from: getHeader(headers, "From"),
        to: getHeader(headers, "To"),
        cc: getHeader(headers, "Cc"),
        date: getHeader(headers, "Date"),
        labels: res.data.labelIds,
        body,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(email, null, 2),
          },
        ],
      };
    }
  );

  /**
   * Move an email to trash.
   * Emails in trash are automatically deleted after 30 days.
   * This is recoverable — not a permanent delete.
   */
  server.tool(
    "trash_email",
    "Move an email to trash (recoverable for 30 days). Use list_emails to find IDs first.",
    {
      emailId: z
        .string()
        .describe("The email ID to trash (from list_emails results)"),
    },
    async ({ emailId }) => {
      await gmail.users.messages.trash({
        userId: "me",
        id: emailId,
      });

      return {
        content: [
          {
            type: "text",
            text: `Email ${emailId} moved to trash.`,
          },
        ],
      };
    }
  );

  /**
   * Archive a single email.
   * Removes the INBOX label — email stays in All Mail and is searchable.
   */
  server.tool(
    "archive_email",
    "Archive an email (removes from inbox, keeps in All Mail). Use list_emails to find IDs first.",
    {
      emailId: z
        .string()
        .describe("The email ID to archive (from list_emails results)"),
    },
    async ({ emailId }) => {
      await gmail.users.messages.modify({
        userId: "me",
        id: emailId,
        requestBody: {
          removeLabelIds: ["INBOX"],
        },
      });

      return {
        content: [
          {
            type: "text",
            text: `Email ${emailId} archived.`,
          },
        ],
      };
    }
  );

  /**
   * Archive multiple emails at once.
   * Useful for bulk inbox cleanup.
   */
  server.tool(
    "archive_emails",
    "Archive multiple emails at once (removes from inbox, keeps in All Mail). Use list_emails to find IDs first.",
    {
      emailIds: z
        .array(z.string())
        .describe("Array of email IDs to archive (from list_emails results)"),
    },
    async ({ emailIds }) => {
      const results = await Promise.all(
        emailIds.map(async (emailId) => {
          try {
            await gmail.users.messages.modify({
              userId: "me",
              id: emailId,
              requestBody: {
                removeLabelIds: ["INBOX"],
              },
            });
            return { id: emailId, status: "archived" };
          } catch (error) {
            return { id: emailId, status: "failed", error: error.message };
          }
        })
      );

      const archived = results.filter((r) => r.status === "archived").length;
      const failed = results.filter((r) => r.status === "failed").length;

      return {
        content: [
          {
            type: "text",
            text: `Archived ${archived} email(s).${failed > 0 ? ` ${failed} failed.` : ""}\n\n${JSON.stringify(results, null, 2)}`,
          },
        ],
      };
    }
  );

  /**
   * Send an email.
   * Composes and sends from the authenticated Gmail account.
   */
  server.tool(
    "send_email",
    "Compose and send an email from your Gmail account",
    {
      to: z
        .string()
        .describe("Recipient email address (e.g., someone@example.com)"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body text (plain text)"),
      cc: z
        .string()
        .optional()
        .describe("Optional CC recipients (comma-separated)"),
    },
    async ({ to, subject, body, cc }) => {
      // Build the raw RFC 2822 email message
      const lines = [
        `To: ${to}`,
        ...(cc ? [`Cc: ${cc}`] : []),
        `Subject: ${subject}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        body,
      ];
      const rawMessage = lines.join("\r\n");

      // Gmail API expects base64url-encoded raw message
      const encoded = Buffer.from(rawMessage)
        .toString("base64url");

      const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encoded,
        },
      });

      return {
        content: [
          {
            type: "text",
            text: `Email sent successfully. Message ID: ${res.data.id}`,
          },
        ],
      };
    }
  );
}
