/**
 * Google Calendar Tools
 *
 * Provides access to Google Calendar:
 * - list_calendars: See all available calendars
 * - get_events: Get events for a date range
 * - search_events: Search events by keyword
 * - create_event: Create a new calendar event
 * - delete_event: Delete a calendar event
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

  /**
   * Create a new calendar event.
   *
   * Supports timed events and all-day events.
   * For timed events, provide startDateTime/endDateTime in ISO format.
   * For all-day events, provide startDate/endDate in YYYY-MM-DD format.
   */
  server.tool(
    "create_event",
    "Create a new Google Calendar event (timed or all-day)",
    {
      calendarId: z
        .string()
        .default("primary")
        .describe(
          'Calendar ID. Use "primary" for the main calendar, or a specific ID from list_calendars.'
        ),
      title: z.string().describe("Event title/summary"),
      description: z
        .string()
        .optional()
        .describe("Event description or notes"),
      location: z
        .string()
        .optional()
        .describe("Event location (address or place name)"),
      startDateTime: z
        .string()
        .optional()
        .describe(
          "Start date+time in ISO 8601 format for timed events (e.g., 2026-03-25T16:30:00). Omit for all-day events."
        ),
      endDateTime: z
        .string()
        .optional()
        .describe(
          "End date+time in ISO 8601 format for timed events (e.g., 2026-03-25T18:00:00). Omit for all-day events."
        ),
      startDate: z
        .string()
        .optional()
        .describe(
          "Start date in YYYY-MM-DD format for all-day events. Omit for timed events."
        ),
      endDate: z
        .string()
        .optional()
        .describe(
          "End date in YYYY-MM-DD format for all-day events (exclusive — the event ends before this date). Omit for timed events."
        ),
    },
    async ({
      calendarId,
      title,
      description,
      location,
      startDateTime,
      endDateTime,
      startDate,
      endDate,
    }) => {
      // Determine if this is a timed or all-day event
      const isAllDay = !startDateTime && startDate;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const eventBody = {
        summary: title,
        description: description || undefined,
        location: location || undefined,
        start: isAllDay
          ? { date: startDate }
          : { dateTime: startDateTime, timeZone },
        end: isAllDay
          ? { date: endDate || startDate }
          : { dateTime: endDateTime || startDateTime, timeZone },
      };

      const res = await calendar.events.insert({
        calendarId,
        requestBody: eventBody,
      });

      const created = res.data;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: created.id,
                title: created.summary,
                start: created.start.dateTime || created.start.date,
                end: created.end.dateTime || created.end.date,
                location: created.location || "",
                link: created.htmlLink,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  /**
   * Delete a calendar event by its ID.
   *
   * Use get_events or search_events first to find the event ID.
   */
  server.tool(
    "delete_event",
    "Delete a Google Calendar event by ID. Use get_events or search_events to find event IDs first.",
    {
      calendarId: z
        .string()
        .default("primary")
        .describe(
          'Calendar ID. Use "primary" for the main calendar, or a specific ID from list_calendars.'
        ),
      eventId: z
        .string()
        .describe("The event ID to delete (from get_events or search_events)"),
    },
    async ({ calendarId, eventId }) => {
      await calendar.events.delete({
        calendarId,
        eventId,
      });

      return {
        content: [
          {
            type: "text",
            text: `Event ${eventId} deleted successfully.`,
          },
        ],
      };
    }
  );
}
