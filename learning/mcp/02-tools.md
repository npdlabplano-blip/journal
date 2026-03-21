# MCP Tools

## What is a Tool?

A tool is a function the AI can call. You define its name, describe what it does, and specify the input schema. The description is critical — it's how Claude decides whether this tool fits the user's request.

## Code Example

```javascript
server.tool(
  // Name — what Claude calls to invoke it
  "get_calendar_events",

  // Description — Claude reads this to decide WHEN to use the tool
  "Get events from Google Calendar for a specific date range",

  // Input schema — defines what parameters Claude must provide
  {
    startDate: {
      type: "string",
      description: "Start date in YYYY-MM-DD format"
    },
    endDate: {
      type: "string",
      description: "End date in YYYY-MM-DD format"
    }
  },

  // Handler — the actual function that runs when called
  async ({ startDate, endDate }) => {
    const events = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date(startDate).toISOString(),
      timeMax: new Date(endDate).toISOString(),
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify(events.data.items, null, 2)
      }]
    };
  }
);
```

## Key Points

- **Name**: What Claude uses to invoke the tool (e.g., `get_calendar_events`)
- **Description**: How Claude decides *when* to use it — make this clear and specific
- **Input schema**: Uses JSON Schema format — Claude generates valid inputs based on it
- **Handler**: The actual function that runs. Always returns a `content` array with typed blocks (usually `type: "text"`)
- Tools are the primary way we'll interact with Google APIs — they accept parameters like date ranges, search queries, folder IDs, etc.
