/**
 * Vertex AI Authentication Module
 *
 * Retrieves the GCP service account key from 1Password and creates
 * an authenticated client for Vertex AI API calls.
 */

import { google } from "googleapis";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// 1Password item details
const OP_VAULT = "OpenClaw";
const OP_ITEM = "Journal MCP - Vertex AI";

// Vertex AI configuration
const GCP_PROJECT_ID = "vertexapi-491411";
const GCP_LOCATION = "us-central1";

/**
 * Run a 1Password CLI command and return the output.
 */
async function opRead(args) {
  const { stdout } = await execAsync(`op ${args}`);
  return stdout.trim();
}

/**
 * Get an authenticated Vertex AI client.
 * Pulls the service account key JSON from 1Password — never stored on disk.
 *
 * Returns an object with:
 * - getAccessToken(): async function that returns a fresh access token
 * - projectId: the GCP project ID
 * - location: the GCP region
 */
export async function getVertexAIClient() {
  const serviceAccountJson = await opRead(
    `item get "${OP_ITEM}" --vault="${OP_VAULT}" --fields notesPlain --reveal`
  );

  const credentials = JSON.parse(serviceAccountJson);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  const client = await auth.getClient();

  return {
    getAccessToken: async () => {
      const tokenResponse = await client.getAccessToken();
      return tokenResponse.token;
    },
    projectId: GCP_PROJECT_ID,
    location: GCP_LOCATION,
  };
}
