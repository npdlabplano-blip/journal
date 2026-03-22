/**
 * Google Calendar Tools
 *
 * Provides read-only access to Google Calendar:
 * - list_calendars: See all available calendars
 * - get_events: Get events for a date range
 * - search_events: Search events by keyword
 */

import { google } from "googleapis";
import { z } from "zod";

export function registerCalendarTools(server, authClient) {
  const calendar = google.calendar({ version: "v3", auth: authClient });

  /**
   * List all calendars the user has access to.
   * Useful for discovering calendar IDs to use with other tools.
   */
  server.tool(
    "list_calendars",
    "List all Google Calendars (personal, work, shared, etc.)",
    {},
    async () => {
      const res = await calendar.calendarList.list();
      const calendars = res.data.items.map((cal) => ({
        id: cal.id,
        name: cal.summary,
        description: cal.description || "",
        primary: cal.primary || false,
        color: cal.backgroundColor,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(calendars, null, 2),
          },
        ],
      };
    }
  );

  /**
   * Get events from a calendar within a date range.
   *
   * - calendarId defaults to "primary" (the user's main calendar)
   * - Dates should be in YYYY-MM-DD format
   * - Returns up to maxResults events (default 50)
   */
  server.tool(
    "get_events",
    "Get calendar events for a date range. Use list_calendars first to find calendar IDs.",
    {
      calendarId: z
        .string()
        .default("primary")
        .describe(
          'Calendar ID to query. Use "primary" for the main calendar, or a specific ID from list_calendars.'
        ),
      startDate: z
        .string()
        .describe("Start date in YYYY-MM-DD format (e.g., 2026-03-21)"),
      endDate: z
        .string()
        .describe("End date in YYYY-MM-DD format (e.g., 2026-03-28)"),
      maxResults: z
        .number()
        .default(50)
        .describe("Maximum number of events to return (default 50)"),
    },
    async ({ calendarId, startDate, endDate, maxResults }) => {
      const res = await calendar.events.list({
        calendarId,
        timeMin: new Date(`${startDate}T00:00:00`).toISOString(),
        timeMax: new Date(`${endDate}T23:59:59`).toISOString(),
        maxResults,
        singleEvents: true, // Expand recurring events into individual instances
        orderBy: "startTime",
      });

      const events = (res.data.items || []).map((event) => ({
        id: event.id,
        title: event.summary || "(No title)",
        description: event.description || "",
        start: event.start.dateTime || event.start.date, // dateTime for timed, date for all-day
        end: event.end.dateTime || event.end.date,
        location: event.location || "",
        allDay: !event.start.dateTime,
        status: event.status,
        creator: event.creator?.email || "",
      }));

      return {
        content: [
          {
            type: "text",
            text:
              events.length > 0
                ? JSON.stringify(events, null, 2)
                : "No events found in this date range.",
          },
        ],
      };
    }
  );

  /**
   * Search for events by keyword across a calendar.
   *
   * Searches event titles, descriptions, locations, and attendees.
   * Great for finding specific events like "custody", "dentist", "soccer practice".
   */
  server.tool(
    "search_events",
    "Search calendar events by keyword (searches titles, descriptions, locations)",
    {
      query: z
        .string()
        .describe(
          'Search term to find in events (e.g., "custody", "soccer", "dentist")'
        ),
      calendarId: z
        .string()
        .default("primary")
        .describe("Calendar ID to search. Defaults to primary calendar."),
      startDate: z
        .string()
        .optional()
        .describe(
          "Optional start date (YYYY-MM-DD). Defaults to today if not provided."
        ),
      endDate: z
        .string()
        .optional()
        .describe(
          "Optional end date (YYYY-MM-DD). Defaults to 3 months from now if not provided."
        ),
      maxResults: z
        .number()
        .default(25)
        .describe("Maximum number of results (default 25)"),
    },
    async ({ query, calendarId, startDate, endDate, maxResults }) => {
      const now = new Date();
      const threeMonthsLater = new Date(now);
      threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

      const res = await calendar.events.list({
        calendarId,
        q: query,
        timeMin: startDate
          ? new Date(`${startDate}T00:00:00`).toISOString()
          : now.toISOString(),
        timeMax: endDate
          ? new Date(`${endDate}T23:59:59`).toISOString()
          : threeMonthsLater.toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = (res.data.items || []).map((event) => ({
        id: event.id,
        title: event.summary || "(No title)",
        description: event.description || "",
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        location: event.location || "",
        allDay: !event.start.dateTime,
      }));

      return {
        content: [
          {
            type: "text",
            text:
              events.length > 0
                ? JSON.stringify(events, null, 2)
                : `No events found matching "${query}".`,
          },
        ],
      };
    }
  );
}
