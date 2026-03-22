/**
 * Kroger OAuth 2.0 Authentication Module
 *
 * Handles the Kroger OAuth flow (separate from Google):
 * - Client Credentials grant for product search and store locations
 * - Authorization Code grant for cart access (user-specific)
 * - All credentials and tokens stored in 1Password
 *
 * Usage:
 *   First time:  npm run kroger-auth   (opens browser, saves user tokens)
 *   After that:  getKrogerAuthClients() (returns both client and user auth)
 */

import { exec } from "child_process";
import { createServer } from "http";
import { URL } from "url";
import { promisify } from "util";

const execAsync = promisify(exec);

const KROGER_API_BASE = "https://api.kroger.com/v1";
const KROGER_TOKEN_URL = `${KROGER_API_BASE}/connect/oauth2/token`;
const KROGER_AUTH_URL = `${KROGER_API_BASE}/connect/oauth2/authorize`;
const REDIRECT_URI = "http://localhost:3001/callback";

// 1Password item details
const OP_VAULT = "OpenClaw";
const OP_CREDS_ITEM = "Journal MCP - Kroger OAuth";
const OP_TOKEN_ITEM = "Journal MCP - Kroger Tokens";

/**
 * Run a 1Password CLI command and return the output.
 */
async function opRead(args) {
  const { stdout } = await execAsync(`op ${args}`);
  let val = stdout.trim();
  if (val.startsWith('"') && val.endsWith('"')) {
    val = val.slice(1, -1).replace(/""/g, '"');
  }
  return val;
}

/**
 * Retrieve Kroger OAuth client credentials from 1Password.
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
 * Try to load saved user tokens from 1Password.
 */
async function getSavedTokens() {
  try {
    const tokenJson = await opRead(
      `item get "${OP_TOKEN_ITEM}" --vault="${OP_VAULT}" --fields label=tokens --reveal`
    );
    return JSON.parse(tokenJson);
  } catch {
    return null;
  }
}

/**
 * Save user tokens to 1Password.
 */
async function saveTokens(tokens) {
  const tokenJson = JSON.stringify(tokens);

  try {
    await execAsync(
      `op item edit "${OP_TOKEN_ITEM}" --vault="${OP_VAULT}" 'tokens[concealed]'='${tokenJson}'`
    );
  } catch {
    await execAsync(
      `op item create --category="API Credential" --title="${OP_TOKEN_ITEM}" --vault="${OP_VAULT}" 'tokens[concealed]'='${tokenJson}'`
    );
  }
}

/**
 * Get a client credentials token (for product search and locations).
 * No user context needed — just the app's own credentials.
 */
async function getClientToken(clientId, clientSecret) {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const res = await fetch(KROGER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: "grant_type=client_credentials&scope=product.compact",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kroger client token request failed: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Refresh a user token using the refresh_token grant.
 */
async function refreshUserToken(clientId, clientSecret, refreshToken) {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const res = await fetch(KROGER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kroger token refresh failed: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Run the interactive authorization flow for user-level access (cart).
 */
async function authorize(clientId, clientSecret) {
  const authUrl =
    `${KROGER_AUTH_URL}?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent("cart.basic:write")}`;

  console.log("\nOpening your browser to authorize with Kroger...\n");

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://localhost:3001");

        if (url.pathname !== "/callback") return;

        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.end("Authorization denied. You can close this tab.");
          reject(new Error(`Kroger authorization error: ${error}`));
          server.close();
          return;
        }

        if (!code) {
          res.end("No authorization code received. You can close this tab.");
          reject(new Error("No authorization code in callback"));
          server.close();
          return;
        }

        // Exchange the code for tokens
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
          "base64"
        );

        const tokenRes = await fetch(KROGER_TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${basicAuth}`,
          },
          body:
            `grant_type=authorization_code` +
            `&code=${encodeURIComponent(code)}` +
            `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
        });

        if (!tokenRes.ok) {
          const text = await tokenRes.text();
          throw new Error(`Token exchange failed: ${tokenRes.status} ${text}`);
        }

        const tokens = await tokenRes.json();
        tokens.obtained_at = Date.now();

        await saveTokens(tokens);

        res.end(
          "Kroger authorization successful! You can close this tab and return to the terminal."
        );
        console.log(
          "Authorization complete! Kroger tokens saved to 1Password.\n"
        );
        resolve(tokens);
        server.close();
      } catch (err) {
        res.end("Authorization failed. Check the terminal for details.");
        reject(err);
        server.close();
      }
    });

    server.listen(3001, () => {
      console.log(
        "If the browser doesn't open automatically, visit this URL:\n"
      );
      console.log(authUrl + "\n");
      exec(`open "${authUrl}"`);
    });
  });
}

/**
 * Get authenticated Kroger API clients.
 *
 * Returns an object with:
 * - makeClientRequest(path, options): For product search, locations (no user context)
 * - makeUserRequest(path, options): For cart operations (user context required)
 * - Both handle token refresh automatically
 */
export async function getKrogerAuthClients() {
  const { clientId, clientSecret } = await getCredentials();

  // Get client credentials token (for search/locations)
  let clientTokenData = await getClientToken(clientId, clientSecret);
  let clientTokenExpiry = Date.now() + clientTokenData.expires_in * 1000;

  // Get user tokens (for cart)
  let userTokens = await getSavedTokens();
  if (!userTokens) {
    throw new Error(
      "No Kroger user tokens found. Run `npm run kroger-auth` in the mcp-server directory first."
    );
  }
  let userTokenExpiry =
    (userTokens.obtained_at || Date.now()) +
    (userTokens.expires_in || 1800) * 1000;

  /**
   * Make an authenticated request using client credentials (product search, locations).
   */
  async function makeClientRequest(path, options = {}) {
    // Refresh client token if expired
    if (Date.now() >= clientTokenExpiry - 60000) {
      clientTokenData = await getClientToken(clientId, clientSecret);
      clientTokenExpiry = Date.now() + clientTokenData.expires_in * 1000;
    }

    const res = await fetch(`${KROGER_API_BASE}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${clientTokenData.access_token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Kroger API error: ${res.status} ${text}`);
    }

    return res.json();
  }

  /**
   * Make an authenticated request using user tokens (cart operations).
   */
  async function makeUserRequest(path, options = {}) {
    // Refresh user token if expired
    if (Date.now() >= userTokenExpiry - 60000) {
      const refreshed = await refreshUserToken(
        clientId,
        clientSecret,
        userTokens.refresh_token
      );
      userTokens = {
        ...userTokens,
        ...refreshed,
        obtained_at: Date.now(),
      };
      userTokenExpiry = Date.now() + userTokens.expires_in * 1000;
      await saveTokens(userTokens);
    }

    const res = await fetch(`${KROGER_API_BASE}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${userTokens.access_token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Kroger API error: ${res.status} ${text}`);
    }

    return res.json();
  }

  return { makeClientRequest, makeUserRequest };
}

/**
 * CLI entry point — run with `npm run kroger-auth`
 */
async function main() {
  console.log("Journal MCP — Kroger OAuth Setup\n");
  console.log("Retrieving Kroger credentials from 1Password...");

  const { clientId, clientSecret } = await getCredentials();
  console.log("Credentials loaded.\n");

  await authorize(clientId, clientSecret);

  console.log(
    "Setup complete! The MCP server can now access your Kroger account."
  );
}

const isMain = process.argv[1]?.endsWith("kroger-auth.js");
if (isMain) {
  main().catch((err) => {
    console.error("Kroger auth failed:", err.message);
    process.exit(1);
  });
}
