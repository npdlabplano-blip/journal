# Build Custom Google MCP Server

We are building a custom MCP server from scratch using Google's official `googleapis` Node.js client libraries. This is an intentional choice — we rejected third-party community MCP servers for security reasons (user is a network security specialist and wants full code auditability).

## Background

Read `CLAUDE.md` for full project context, specifically the "Connectors & Integrations" section.

## What We're Building

A local MCP server (Node.js, stdio transport) that exposes these Google Workspace services:

### 1. Google Calendar (read-only)
- List calendars
- Get events for a date range
- Search events
- **Key use case:** Custody schedule, kids' activities, work calendar, church events

### 2. Gmail (read-only)
- List/search emails
- Read email content
- Get unread count
- **Key use case:** Surface missed emails, important messages, upcoming deadlines

### 3. Google Drive (read/write, scoped to specific folders)
- List files in folders
- Read file content
- Create/update files
- **Key use case:** Recipes, wardrobe photos, document storage

## Prerequisites Needed

1. **Google Cloud Project** — user has one but may need help configuring it
2. **Enable APIs:** Google Calendar API, Gmail API, Google Drive API
3. **OAuth 2.0 credentials** — Desktop application type
4. **Node.js** — already installed (v24.12.0)

## Security Requirements

- OAuth 2.0 — no stored passwords
- Principle of least privilege on scopes:
  - Calendar: `https://www.googleapis.com/auth/calendar.readonly`
  - Gmail: `https://www.googleapis.com/auth/gmail.readonly`
  - Drive: `https://www.googleapis.com/auth/drive` (scoped to specific folders in code)
- Credentials stored in `.env` (git-ignored)
- Tokens stored locally, never committed
- All secrets in `.gitignore`

## How to Approach This

**IMPORTANT:** Walk through this step by step. The user wants to understand every component of the MCP server — this is a learning exercise for her work. Don't dump code. Explain:
- What MCP is and how the protocol works (tools, resources, transports)
- How OAuth 2.0 flow works with Google
- What each part of the server code does
- Security considerations at each step

## Steps

1. **Google Cloud Console setup** — help configure the project, enable APIs, create OAuth credentials
2. **Project scaffolding** — initialize the Node.js project, install dependencies
3. **OAuth flow** — build the auth module (token acquisition, refresh, secure storage)
4. **MCP server skeleton** — set up the MCP server with stdio transport
5. **Google Calendar tools** — implement calendar read tools
6. **Gmail tools** — implement email read tools
7. **Google Drive tools** — implement drive read/write tools
8. **Wire into Claude Code** — configure the MCP server in Claude Code settings
9. **Test and verify** — test each tool end-to-end
10. **Security review** — audit scopes, token handling, and access patterns

## File Location

The MCP server code should live in: `mcp-server/` within this project.
