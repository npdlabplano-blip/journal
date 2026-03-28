/**
 * Google Drive Tools
 *
 * Provides read/write access to Google Drive:
 * - list_drive_files: List files in a folder
 * - search_drive: Search for files by name or content
 * - get_file_info: Get metadata about a file
 * - create_folder: Create a new folder
 * - upload_text_file: Create a text-based file in Drive
 * - delete_file: Move a file to trash
 */

import { google } from "googleapis";
import { z } from "zod";
import { createWriteStream, mkdirSync } from "fs";
import { dirname } from "path";

/**
 * Common Drive file fields to return.
 * Keeps responses consistent and useful.
 */
const FILE_FIELDS =
  "id, name, mimeType, createdTime, modifiedTime, size, parents, webViewLink";

export function registerDriveTools(server, authClient) {
  const drive = google.drive({ version: "v3", auth: authClient });

  /**
   * List files in a specific folder (or root if no folder specified).
   * Returns file names, types, and IDs for further operations.
   */
  server.tool(
    "list_drive_files",
    "List files in a Google Drive folder. Use 'root' for the top-level folder.",
    {
      folderId: z
        .string()
        .default("root")
        .describe(
          'Folder ID to list. Use "root" for top-level, or a specific folder ID.'
        ),
      maxResults: z
        .number()
        .default(50)
        .describe("Maximum number of files to return (default 50)"),
      fileType: z
        .string()
        .optional()
        .describe(
          'Optional filter by type: "folder", "document", "spreadsheet", "image", or a MIME type'
        ),
    },
    async ({ folderId, maxResults, fileType }) => {
      let query = `'${folderId}' in parents and trashed = false`;

      // Add file type filter if specified
      if (fileType) {
        const mimeMap = {
          folder: "application/vnd.google-apps.folder",
          document: "application/vnd.google-apps.document",
          spreadsheet: "application/vnd.google-apps.spreadsheet",
          image: "image/",
        };
        const mime = mimeMap[fileType] || fileType;
        if (fileType === "image") {
          query += ` and mimeType contains '${mime}'`;
        } else {
          query += ` and mimeType = '${mime}'`;
        }
      }

      const res = await drive.files.list({
        q: query,
        pageSize: maxResults,
        fields: `files(${FILE_FIELDS})`,
        orderBy: "modifiedTime desc",
      });

      return {
        content: [
          {
            type: "text",
            text:
              res.data.files.length > 0
                ? JSON.stringify(res.data.files, null, 2)
                : "No files found in this folder.",
          },
        ],
      };
    }
  );

  /**
   * Search for files across all of Drive by name or content.
   * Uses Drive's full-text search — finds matches in file names,
   * document content, descriptions, and more.
   */
  server.tool(
    "search_drive",
    "Search Google Drive for files by name or content",
    {
      query: z
        .string()
        .describe(
          'Search term to find files (e.g., "chicken recipe", "budget 2026")'
        ),
      fileType: z
        .string()
        .optional()
        .describe(
          'Optional filter: "folder", "document", "spreadsheet", "image", or MIME type'
        ),
      maxResults: z
        .number()
        .default(20)
        .describe("Maximum number of results (default 20)"),
    },
    async ({ query, fileType, maxResults }) => {
      let q = `fullText contains '${query}' and trashed = false`;

      if (fileType) {
        const mimeMap = {
          folder: "application/vnd.google-apps.folder",
          document: "application/vnd.google-apps.document",
          spreadsheet: "application/vnd.google-apps.spreadsheet",
          image: "image/",
        };
        const mime = mimeMap[fileType] || fileType;
        if (fileType === "image") {
          q += ` and mimeType contains '${mime}'`;
        } else {
          q += ` and mimeType = '${mime}'`;
        }
      }

      const res = await drive.files.list({
        q,
        pageSize: maxResults,
        fields: `files(${FILE_FIELDS})`,
        orderBy: "relevance",
      });

      return {
        content: [
          {
            type: "text",
            text:
              res.data.files.length > 0
                ? JSON.stringify(res.data.files, null, 2)
                : `No files found matching "${query}".`,
          },
        ],
      };
    }
  );

  /**
   * Get detailed metadata about a specific file.
   */
  server.tool(
    "get_file_info",
    "Get detailed information about a Drive file by its ID",
    {
      fileId: z.string().describe("The file ID (from list or search results)"),
    },
    async ({ fileId }) => {
      const res = await drive.files.get({
        fileId,
        fields:
          "id, name, mimeType, createdTime, modifiedTime, size, parents, webViewLink, description, owners, shared",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(res.data, null, 2),
          },
        ],
      };
    }
  );

  /**
   * Create a new folder in Drive.
   */
  server.tool(
    "create_folder",
    "Create a new folder in Google Drive",
    {
      name: z.string().describe("Name for the new folder"),
      parentFolderId: z
        .string()
        .default("root")
        .describe(
          'Parent folder ID. Use "root" for top-level, or a specific folder ID.'
        ),
    },
    async ({ name, parentFolderId }) => {
      const res = await drive.files.create({
        requestBody: {
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId],
        },
        fields: FILE_FIELDS,
      });

      return {
        content: [
          {
            type: "text",
            text: `Folder created:\n${JSON.stringify(res.data, null, 2)}`,
          },
        ],
      };
    }
  );

  /**
   * Create a plain text file in Drive.
   * For Google Docs, use the Docs tools instead.
   */
  server.tool(
    "upload_text_file",
    "Create a plain text or CSV file in Google Drive",
    {
      name: z
        .string()
        .describe('File name (e.g., "shopping-list.txt", "data.csv")'),
      content: z.string().describe("Text content for the file"),
      mimeType: z
        .string()
        .default("text/plain")
        .describe(
          'MIME type (default "text/plain"). Use "text/csv" for CSV files.'
        ),
      parentFolderId: z
        .string()
        .default("root")
        .describe("Parent folder ID. Defaults to root."),
    },
    async ({ name, content, mimeType, parentFolderId }) => {
      const res = await drive.files.create({
        requestBody: {
          name,
          parents: [parentFolderId],
        },
        media: {
          mimeType,
          body: content,
        },
        fields: FILE_FIELDS,
      });

      return {
        content: [
          {
            type: "text",
            text: `File created:\n${JSON.stringify(res.data, null, 2)}`,
          },
        ],
      };
    }
  );

  /**
   * Move a file to a different folder in Google Drive.
   */
  server.tool(
    "move_file",
    "Move a file to a different folder in Google Drive",
    {
      fileId: z.string().describe("The file ID to move"),
      destinationFolderId: z
        .string()
        .describe("The folder ID to move the file into"),
    },
    async ({ fileId, destinationFolderId }) => {
      // Get current parents
      const file = await drive.files.get({
        fileId,
        fields: "id, name, parents",
      });

      const previousParents = (file.data.parents || []).join(",");

      const res = await drive.files.update({
        fileId,
        addParents: destinationFolderId,
        removeParents: previousParents,
        fields: FILE_FIELDS,
      });

      return {
        content: [
          {
            type: "text",
            text: `File moved successfully:\n${JSON.stringify(res.data, null, 2)}`,
          },
        ],
      };
    }
  );

  /**
   * Move a file to trash (recoverable for 30 days).
   */
  server.tool(
    "delete_file",
    "Move a Drive file to trash (recoverable for 30 days)",
    {
      fileId: z.string().describe("The file ID to trash"),
    },
    async ({ fileId }) => {
      await drive.files.update({
        fileId,
        requestBody: {
          trashed: true,
        },
      });

      return {
        content: [
          {
            type: "text",
            text: `File ${fileId} moved to trash.`,
          },
        ],
      };
    }
  );

  /**
   * Download an image from Drive to a local file path.
   * Used to view wardrobe photos and other images locally.
   */
  server.tool(
    "download_drive_image",
    "Download an image from Google Drive to a local file for viewing. Returns the local path.",
    {
      fileId: z.string().describe("The Drive file ID of the image"),
      localPath: z
        .string()
        .describe(
          "Absolute local file path to save the image to (e.g., /Users/.../wardrobe/41.jpg)"
        ),
    },
    async ({ fileId, localPath }) => {
      // Ensure parent directory exists
      mkdirSync(dirname(localPath), { recursive: true });

      // Download image bytes from Drive
      const res = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "stream" }
      );

      // Pipe to local file
      const dest = createWriteStream(localPath);
      await new Promise((resolve, reject) => {
        res.data.on("end", resolve).on("error", reject).pipe(dest);
      });

      return {
        content: [
          {
            type: "text",
            text: `Image downloaded to: ${localPath}`,
          },
        ],
      };
    }
  );

  /**
   * Download all images from a Drive folder to a local directory.
   * Useful for batch-downloading wardrobe category folders.
   */
  server.tool(
    "download_drive_folder_images",
    "Download all images from a Google Drive folder to a local directory. Returns list of downloaded files.",
    {
      folderId: z.string().describe("The Drive folder ID containing images"),
      localDir: z
        .string()
        .describe(
          "Absolute local directory path to save images into (e.g., /Users/.../wardrobe/tops)"
        ),
    },
    async ({ folderId, localDir }) => {
      mkdirSync(localDir, { recursive: true });

      // List all image files in the folder
      const listRes = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
        pageSize: 100,
        fields: "files(id, name, mimeType)",
        orderBy: "name",
      });

      const files = listRes.data.files || [];
      if (files.length === 0) {
        return {
          content: [{ type: "text", text: "No images found in this folder." }],
        };
      }

      const results = [];
      for (const file of files) {
        const localPath = `${localDir}/${file.name}`;
        try {
          const res = await drive.files.get(
            { fileId: file.id, alt: "media" },
            { responseType: "stream" }
          );
          const dest = createWriteStream(localPath);
          await new Promise((resolve, reject) => {
            res.data.on("end", resolve).on("error", reject).pipe(dest);
          });
          results.push({ name: file.name, path: localPath, status: "ok" });
        } catch (err) {
          results.push({
            name: file.name,
            path: localPath,
            status: `error: ${err.message}`,
          });
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `Downloaded ${results.filter((r) => r.status === "ok").length}/${files.length} images to ${localDir}\n\n${JSON.stringify(results, null, 2)}`,
          },
        ],
      };
    }
  );
}
