/**
 * OpenAI Authentication Module
 *
 * Retrieves the OpenAI API key from 1Password and creates
 * an authenticated OpenAI client. Key is never stored on disk.
 */

import OpenAI from "openai";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// 1Password item details
const OP_VAULT = "OpenClaw";
const OP_ITEM = "Journal MCP - OpenAI";

/**
 * Get an authenticated OpenAI client.
 * Pulls the API key from 1Password — never stored on disk.
 */
export async function getOpenAIClient() {
  const { stdout } = await execAsync(
    `op item get "${OP_ITEM}" --vault="${OP_VAULT}" --fields credential --reveal`
  );

  const apiKey = stdout.trim();

  if (!apiKey || apiKey.length < 10) {
    throw new Error("OpenAI API key not found or invalid in 1Password");
  }

  return new OpenAI({ apiKey });
}
