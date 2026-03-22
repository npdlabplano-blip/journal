/**
 * Quick utility to move a file between Google Drive folders.
 * Reuses the MCP server's auth module.
 *
 * Usage: node move-file.js <fileId> <destinationFolderId>
 */

import { google } from "googleapis";
import { getAuthClient } from "./src/auth.js";

const [fileId, destFolderId] = process.argv.slice(2);

if (!fileId || !destFolderId) {
  console.error("Usage: node move-file.js <fileId> <destinationFolderId>");
  process.exit(1);
}

const authClient = await getAuthClient();
const drive = google.drive({ version: "v3", auth: authClient });

// Get current parents
const file = await drive.files.get({ fileId, fields: "id, name, parents" });
const previousParents = (file.data.parents || []).join(",");

const res = await drive.files.update({
  fileId,
  addParents: destFolderId,
  removeParents: previousParents,
  fields: "id, name, parents, webViewLink",
});

console.log(JSON.stringify(res.data, null, 2));
