/**
 * OpenAI Authentication Module
 *
 * Retrieves the OpenAI API key from 1Password and creates an authenticated client.
 * Follows the same pattern as auth.js (Google) and kroger-auth.js (Kroger).
 */

import OpenAI from "openai";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// 1Password item details
const OP_VAULT = "OpenClaw";
const OP_ITEM = "Journal MCP - OpenAI";

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
 * Get an authenticated OpenAI client.
 * Pulls the API key from 1Password — never stored on disk.
 */
export async function getOpenAIClient() {
  const apiKey = await opRead(
    `item get "${OP_ITEM}" --vault="${OP_VAULT}" --fields label=credential --reveal`
  );

  return new OpenAI({ apiKey });
}
