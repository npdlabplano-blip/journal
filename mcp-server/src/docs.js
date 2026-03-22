/**
 * Google Docs Tools
 *
 * Provides read/write access to Google Docs content:
 * - read_doc: Read the text content of a Google Doc
 * - create_doc: Create a new Google Doc with content
 * - append_to_doc: Add text to the end of an existing Google Doc
 */

import { google } from "googleapis";
import { z } from "zod";

/**
 * Extract plain text from a Google Docs document.
 * Docs store content as structured elements — this walks through
 * paragraphs and pulls out the text.
 */
function extractText(doc) {
  const content = doc.body?.content || [];
  let text = "";

  for (const element of content) {
    if (element.paragraph) {
      for (const paragraphElement of element.paragraph.elements) {
        if (paragraphElement.textRun) {
          text += paragraphElement.textRun.content;
        }
      }
    }
  }

  return text;
}

export function registerDocsTools(server, authClient) {
  const docs = google.docs({ version: "v1", auth: authClient });
  const drive = google.drive({ version: "v3", auth: authClient });

  /**
   * Read the full text content of a Google Doc.
   * Use search_drive or list_drive_files to find the document ID first.
   */
  server.tool(
    "read_doc",
    "Read the text content of a Google Doc by its ID. Use search_drive to find doc IDs.",
    {
      documentId: z
        .string()
        .describe(
          "The Google Doc ID (from Drive search/list results)"
        ),
    },
    async ({ documentId }) => {
      const res = await docs.documents.get({ documentId });

      const text = extractText(res.data);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                title: res.data.title,
                documentId: res.data.documentId,
                content: text,
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
   * Create a new Google Doc with initial content.
   * The doc is created in Drive and can optionally be placed in a specific folder.
   */
  server.tool(
    "create_doc",
    "Create a new Google Doc with text content",
    {
      title: z.string().describe("Title for the new document"),
      content: z
        .string()
        .default("")
        .describe("Initial text content for the document"),
      parentFolderId: z
        .string()
        .optional()
        .describe("Optional folder ID to create the doc in"),
    },
    async ({ title, content, parentFolderId }) => {
      // Step 1: Create the doc
      const createRes = await docs.documents.create({
        requestBody: { title },
      });

      const documentId = createRes.data.documentId;

      // Step 2: Add content if provided
      if (content) {
        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: { index: 1 }, // Index 1 = start of document body
                  text: content,
                },
              },
            ],
          },
        });
      }

      // Step 3: Move to folder if specified
      if (parentFolderId) {
        await drive.files.update({
          fileId: documentId,
          addParents: parentFolderId,
          removeParents: "root",
          fields: "id, parents",
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                documentId,
                title,
                message: "Document created successfully.",
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
   * Append text to the end of an existing Google Doc.
   * Useful for journal entries, logs, running notes, etc.
   */
  server.tool(
    "append_to_doc",
    "Append text to the end of an existing Google Doc",
    {
      documentId: z.string().describe("The Google Doc ID to append to"),
      text: z.string().describe("Text to append to the end of the document"),
    },
    async ({ documentId, text }) => {
      // First, get the current document to find the end index
      const doc = await docs.documents.get({ documentId });
      const endIndex =
        doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1;

      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: endIndex },
                text: "\n" + text,
              },
            },
          ],
        },
      });

      return {
        content: [
          {
            type: "text",
            text: `Text appended to document ${doc.data.title} (${documentId}).`,
          },
        ],
      };
    }
  );
}
