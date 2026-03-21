# MCP Transports

## What is a Transport?

The transport is *how* Claude Code and our MCP server communicate — the communication channel between them.

## Transport Options

### stdio (What We're Using)
- Server runs as a **subprocess** of Claude Code
- Communicates via **JSON messages over stdin/stdout**
- No open network ports, no HTTP
- Simplest and most secure option for local use

### SSE (Server-Sent Events)
- Runs as an HTTP server
- Used for **remote** MCP servers
- Requires network configuration and authentication
- We don't need this — our server runs locally

## Code Example (stdio)

```javascript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Create the server
const server = new McpServer({
  name: "journal-google-mcp",
  version: "1.0.0"
});

// ... register tools and resources here ...

// Connect via stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Why stdio?

- **No open ports** — nothing listening on the network
- **No authentication needed** between Claude and the server (the OS handles process isolation)
- **Simple lifecycle** — Claude Code starts the server, talks to it, and kills it when done
- **Secure** — no network exposure at all

## Runtime Flow

1. Claude Code launches: `node mcp-server/index.js`
2. Server starts and connects `StdioServerTransport`
3. Claude sends JSON requests → server's stdin
4. Server processes them → sends JSON responses to stdout
5. Server stays alive for the session
6. Claude Code closes the connection when done
