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
import { getKrogerAuthClients } from "./kroger-auth.js";
import { registerCalendarTools } from "./calendar.js";
import { registerGmailTools } from "./gmail.js";
import { registerDriveTools } from "./drive.js";
import { registerDocsTools } from "./docs.js";
import { registerKrogerTools } from "./kroger.js";
import { getVertexAIClient } from "./vertex-auth.js";
import { getOpenAIClient } from "./openai-auth.js";
import { registerImageTools } from "./image-generation.js";

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

  // Get authenticated Kroger API clients and register Kroger tools
  // This pulls Kroger credentials and tokens from 1Password
  try {
    const krogerClients = await getKrogerAuthClients();
    registerKrogerTools(server, krogerClients);
  } catch (err) {
    // Don't block the entire server if Kroger auth isn't set up yet
    console.error(`Kroger tools unavailable: ${err.message}`);
  }

  // Get authenticated OpenAI client for DALL-E fallback
  // This pulls the API key from 1Password
  let openaiClient = null;
  try {
    openaiClient = await getOpenAIClient();
  } catch (err) {
    console.error(`OpenAI/DALL-E fallback unavailable: ${err.message}`);
  }

  // Get authenticated Vertex AI client and register image generation tools
  // This pulls the GCP service account key from 1Password
  try {
    const vertexClient = await getVertexAIClient();
    registerImageTools(server, vertexClient, openaiClient);
  } catch (err) {
    // Don't block the entire server if Vertex AI auth isn't set up yet
    console.error(`Image generation tools unavailable: ${err.message}`);
  }

  // Connect via stdio transport
  // Claude Code communicates with us through stdin/stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Server failed to start:", err.message);
  process.exit(1);
});
