# MCP Overview — Model Context Protocol

## What is MCP?

MCP (Model Context Protocol) is an open protocol that lets AI assistants (like Claude Code) call external tools. Think of it like a USB port — it's a standard way to plug capabilities into an AI.

## Three Key Concepts

### 1. Tools
Functions the AI can call (e.g., "get my calendar events for next week"). Each tool has a name, description, and input schema.

### 2. Resources
Data the AI can read (like files or database entries). Resources are more like documents — the AI reads them for context rather than calling them with specific parameters.

### 3. Transports
How the AI talks to the server. The two options are:
- **stdio** (standard input/output) — the server runs as a subprocess, communicates via JSON over stdin/stdout. No network port, no HTTP. Simple and secure.
- **SSE** (Server-Sent Events) — over HTTP, for remote servers. Not needed for local use.

## How It Works (Our Setup)

```
Claude Code  ---(JSON request via stdin)--->  Our MCP Server  ---(API call)--->  Google
Claude Code  <--(JSON response via stdout)--  Our MCP Server  <--(response)----  Google
```

1. Claude Code launches: `node mcp-server/index.js`
2. Server starts, connects StdioServerTransport
3. Claude sends JSON requests → our server's stdin
4. Our server processes them → sends JSON responses to stdout
5. Server stays alive until Claude Code closes the connection

## Why We're Building Our Own

We rejected third-party community MCP servers for security — we want full code auditability. Our server uses Google's official `googleapis` Node.js client libraries directly.
