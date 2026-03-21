# MCP Resources

## What is a Resource?

A resource is data the AI can *read* without calling a function. Think of it as a file or document that's always available — more like static or semi-static data that provides context.

## Code Example

```javascript
server.resource(
  // Name
  "custody_schedule",

  // URI — a unique identifier for this resource
  "calendar://custody-schedule",

  // Metadata
  {
    description: "Current custody schedule for the kids",
    mimeType: "application/json"
  },

  // Handler — returns the resource content when read
  async () => {
    const schedule = await getCustodySchedule(); // your logic here

    return {
      contents: [{
        uri: "calendar://custody-schedule",
        mimeType: "application/json",
        text: JSON.stringify(schedule, null, 2)
      }]
    };
  }
);
```

## Key Points

- **Resources are like documents** — the AI reads them for context rather than calling them with specific parameters
- **URI**: Like a file path — uniquely identifies the resource (e.g., `calendar://custody-schedule`)
- **mimeType**: Tells the AI what format the data is in (JSON, plain text, etc.)
- **Handler**: Returns content when the resource is read — can fetch live data or return stored data

## Tools vs Resources — When to Use Which

| | Tools | Resources |
|---|---|---|
| **Use when** | You need to pass parameters (dates, queries, IDs) | Data is relatively static or contextual |
| **Example** | "Get events from March 1–7" | "Here's the custody schedule" |
| **Interaction** | AI *calls* them like functions | AI *reads* them like documents |

For our project, **tools are more useful** — we need to pass parameters like date ranges and search queries. Resources would be good for things like the custody schedule that don't change often.
