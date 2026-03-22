/**
 * OAuth 2.0 Authentication Module
 *
 * Handles the Google OAuth flow:
 * - Retrieves client credentials from 1Password
 * - Runs a one-time browser-based authorization flow
 * - Stores and refreshes tokens via 1Password
 *
 * Usage:
 *   First time:  npm run auth    (opens browser, saves tokens)
 *   After that:  getAuthClient()  (auto-refreshes, no browser needed)
 */

import { google } from "googleapis";
import { exec } from "child_process";
import { createServer } from "http";
import { URL } from "url";
import { promisify } from "util";

const execAsync = promisify(exec);

// The permissions we're requesting from Google
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
];

// 1Password item details
const OP_VAULT = "OpenClaw";
const OP_CREDS_ITEM = "Journal MCP - Google OAuth";
const OP_TOKEN_ITEM = "Journal MCP - Google Tokens";

/**
 * Run a 1Password CLI command and return the output.
 * Uses the desktop app integration — no service account token needed.
 */
async function opRead(args) {
  const { stdout } = await execAsync(`op ${args}`);
  return stdout.trim();
}

/**
 * Retrieve OAuth client credentials from 1Password.
 * Returns { clientId, clientSecret }.
 */
async function getCredentials() {
  const clientId = await opRead(
    `item get "${OP_CREDS_ITEM}" --vault="${OP_VAULT}" --fields label=username`
  );
  const clientSecret = await opRead(
    `item get "${OP_CREDS_ITEM}" --vault="${OP_VAULT}" --fields label=credential --reveal`
  );
  return { clientId, clientSecret };
}

/**
 * Try to load saved tokens from 1Password.
 * Returns the parsed token object, or null if no tokens are saved yet.
 */
async function getSavedTokens() {
  try {
    const tokenJson = await opRead(
      `item get "${OP_TOKEN_ITEM}" --vault="${OP_VAULT}" --fields label=tokens --reveal`
    );
    return JSON.parse(tokenJson);
  } catch {
    // Item doesn't exist yet — first run
    return null;
  }
}

/**
 * Save tokens to 1Password.
 * Creates the item on first run, updates it on subsequent runs.
 */
async function saveTokens(tokens) {
  const tokenJson = JSON.stringify(tokens);

  try {
    // Try to update existing item
    await execAsync(
      `op item edit "${OP_TOKEN_ITEM}" --vault="${OP_VAULT}" 'tokens[concealed]'='${tokenJson}'`
    );
  } catch {
    // Item doesn't exist yet — create it
    await execAsync(
      `op item create --category="API Credential" --title="${OP_TOKEN_ITEM}" --vault="${OP_VAULT}" 'tokens[concealed]'='${tokenJson}'`
    );
  }
}

/**
 * Create a configured OAuth2 client.
 * This is the object that googleapis uses to authenticate all API calls.
 */
function createOAuth2Client(clientId, clientSecret) {
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    "http://localhost:3000/callback" // Where Google sends the user after they approve
  );
}

/**
 * Run the interactive authorization flow.
 * Opens a browser, waits for the user to approve, captures the auth code.
 */
async function authorize(oauth2Client) {
  // Build the URL that asks Google for permission
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline", // "offline" gives us a refresh token
    scope: SCOPES,
    prompt: "consent", // Always show the consent screen to ensure we get a refresh token
  });

  console.log("\nOpening your browser to authorize with Google...\n");

  // Start a temporary local web server to catch Google's redirect
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://localhost:3000");

        if (url.pathname !== "/callback") return;

        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.end("Authorization denied. You can close this tab.");
          reject(new Error(`Google authorization error: ${error}`));
          server.close();
          return;
        }

        if (!code) {
          res.end("No authorization code received. You can close this tab.");
          reject(new Error("No authorization code in callback"));
          server.close();
          return;
        }

        // Exchange the one-time code for access + refresh tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Save tokens to 1Password
        await saveTokens(tokens);

        res.end(
          "Authorization successful! You can close this tab and return to the terminal."
        );
        console.log("Authorization complete! Tokens saved to 1Password.\n");
        resolve(tokens);
        server.close();
      } catch (err) {
        res.end("Authorization failed. Check the terminal for details.");
        reject(err);
        server.close();
      }
    });

    server.listen(3000, () => {
      console.log("If the browser doesn't open automatically, visit this URL:\n");
      console.log(authUrl + "\n");
      // Open the browser to the Google consent page
      exec(`open "${authUrl}"`);
    });
  });
}

/**
 * Get an authenticated OAuth2 client, ready to make API calls.
 *
 * This is the main function other modules will use:
 * - If tokens exist in 1Password, loads and uses them (auto-refreshes if expired)
 * - If no tokens exist, throws an error telling you to run `npm run auth` first
 */
export async function getAuthClient() {
  const { clientId, clientSecret } = await getCredentials();
  const oauth2Client = createOAuth2Client(clientId, clientSecret);

  const tokens = await getSavedTokens();
  if (!tokens) {
    throw new Error(
      "No tokens found. Run `npm run auth` in the mcp-server directory first."
    );
  }

  oauth2Client.setCredentials(tokens);

  // Listen for token refresh events and save the new tokens
  oauth2Client.on("tokens", async (newTokens) => {
    // Merge with existing tokens (refresh_token isn't always included in refresh responses)
    const merged = { ...tokens, ...newTokens };
    await saveTokens(merged);
  });

  // Re-lock 1Password so next access requires biometric
  await opRead("lock");

  return oauth2Client;
}

/**
 * CLI entry point — run with `npm run auth`
 * Only used for the one-time authorization flow.
 */
async function main() {
  console.log("Journal MCP — Google OAuth Setup\n");
  console.log("Retrieving credentials from 1Password...");

  const { clientId, clientSecret } = await getCredentials();
  console.log("Credentials loaded.\n");

  const oauth2Client = createOAuth2Client(clientId, clientSecret);
  await authorize(oauth2Client);

  // Re-lock 1Password so next access requires biometric
  await opRead("lock");

  console.log("Setup complete! The MCP server can now access your Google account.");
}

// If this file is run directly (npm run auth), start the flow
const isMain = process.argv[1]?.endsWith("auth.js");
if (isMain) {
  main().catch((err) => {
    console.error("Auth failed:", err.message);
    process.exit(1);
  });
}
