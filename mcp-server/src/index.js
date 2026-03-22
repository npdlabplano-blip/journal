/**
 * Journal MCP Server — Main Entry Point
 *
 * A custom MCP server that exposes Google Workspace tools
 * (Calendar, Gmail, Drive, Docs) to Claude Code via stdio transport.
 *
 * Claude Code launches this as a subprocess and communicates via stdin/stdout.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAuthClient } from "./auth.js";
import { registerCalendarTools } from "./calendar.js";
import { registerGmailTools } from "./gmail.js";
import { registerDriveTools } from "./drive.js";
import { registerDocsTools } from "./docs.js";

async function main() {
  // Create the MCP server instance
  const server = new McpServer({
    name: "journal-google",
    version: "1.0.0",
  });

  // Get an authenticated Google API client
  // This pulls credentials and tokens from 1Password
  const authClient = await getAuthClient();

  // Register all tool groups
  // Each module adds its own tools to the server
  registerCalendarTools(server, authClient);
  registerGmailTools(server, authClient);
  registerDriveTools(server, authClient);
  registerDocsTools(server, authClient);

  // Connect via stdio transport
  // Claude Code communicates with us through stdin/stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Server failed to start:", err.message);
  process.exit(1);
});
