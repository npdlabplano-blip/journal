# Journal — Personal Organization System

## Overview
This is a personal journal and home organization system for managing daily life, meal planning, calendars, to-do lists, and recipes.

## Family
- **User** (parent)
- **Calvin** — 16 years old
- **Constance** — 13 years old
- Kids split custody time with ex — custody schedule must be factored into meal planning (how many people, which nights)
- Very busy family schedule

## Key Features (Planned)
- Calendar and email integration — check for missed items, upcoming events
- Custody schedule tracking — drives meal planning and daily logistics
- To-do list management
- Meal planning — account for who's home on which nights
- Recipe management — stored in Google Drive
- Context/prompt files — so nothing needs to be reinvented each session

## Google Ecosystem
- **Google Calendar** — primary calendar (events, custody schedule, kids' activities)
- **Gmail** — primary email
- **Google Drive** — all document storage, including recipes

## Meal Planning & Nutrition
- Existing recipe collection lives in Google Drive
- Wants to continuously add new creative, healthy recipes
- Meal plans should rotate and stay fresh — avoid repetition
- **Dietary preferences:**
  - Healthy, not super carb-heavy
  - Grilled meats and veggies are always a win
  - Needs make-ahead meals and leftover-friendly options for busy nights
  - No allergies or dietary restrictions in the family
- **Nutrition tracking:**
  - Calorie counting and macro tracking
  - Photo-based calorie estimation (take a picture of a meal, get calorie/nutrition breakdown)
  - Weight loss goal

## Planner (Central Hub)
The planner is the core of the system — calendars, tasks, and routines all live here. Agents reference this data but the planner is its own area.

- **Calendar Integration** — syncs with Google Calendar; custody schedule, kids' activities, work, church, social
- **Custody Schedule** — which nights the kids are home; drives meal planning, logistics
- **To-Do Lists** by category:
  - **Home** — household tasks, maintenance, errands
  - **Church** — church commitments, events, volunteering
  - **Work** — professional tasks and deadlines
  - **Extended Family** — family obligations, events, coordination
- **Daily/Weekly Routines** — morning routines, evening routines, weekly prep
- **Upcoming Events** — pulled from calendar, surfaced proactively

## Journal & Spiritual Life
- **Daily Reflection** — personal journaling and reflection
- **Prayer Journal** — tracking prayers, answered prayers, prayer requests
- **Sermon Notes** — capturing notes from sermons
- **Bible Study Notes** — study notes and insights
- **Devotional Agent** — an agent/prompt to provide devotionals for Bible Study
  - _Characteristics TBD — to be designed in detail_

## Agents to Build
Each agent should be a standalone agent with its own charter, personality, and system prompt — NOT just a prompt template.

1. **Nutrition Coach Agent** — a dedicated health and nutrition partner
   - Meal planning: creative, healthy, low-carb-leaning recipes
   - Custody-aware: knows which nights kids are home, adjusts portions/recipes
   - Schedule-aware: suggests make-ahead meals and leftover plans for busy nights
   - Pulls from existing Google Drive recipe library AND suggests new recipes
   - Keeps meal rotation fresh — avoids repetition
   - Calorie counting and nutrition tracking
   - Photo-based meal analysis: user takes a picture, agent estimates calories/macros
   - Supports weight loss goals
   - Tracks nutrition over time
   - _Full charter TBD_

2. **Devotional Agent** — a warm, personal daily devotional companion
   - **Bible Translation:** ESV (English Standard Version)
   - **Format:** Daily reading + reflection questions
   - **Theological framework:** Southern Baptist / Bible Church theology
   - **Hermeneutics:** Proper hermeneutics — historical-grammatical interpretation, context-driven, scripture interprets scripture
   - **Tone:** Conversational, warm, accessible — NOT academic or preachy
   - **Personalization:**
     - Should be aware of journal entries, prayers, and things the user has shared
     - Reflection questions should be applicable to a single mom of two teenagers
     - Should meet the user where she is in life, not be generic
   - _Full charter TBD_

3. **Style Guru Agent** — personal wardrobe and style advisor
   - **Wardrobe inventory:** Photos saved in Google Drive; optimize for AI by generating a structured catalog (item descriptions, colors, categories, seasons) from the photos
   - Suggests daily outfits based on what's in the closet
   - Considers occasion, weather, and season
   - **Style profile:**
     - Mix of everything — cute but professional
     - **Work:** Cute and professional (executive director at a global bank); some days business casual
     - **Church:** Cute, not too conservative — church is casual but she likes to look put-together
     - **Date night:** Really cute — rare but important
   - **Budget ranges:**
     - Tops: $50–100
     - Bottoms: ~$100
     - Shoes: $70–100
     - Bags: ~$100
     - Accessories: $20–50
   - Recommends future purchases to fill wardrobe gaps or refresh looks within budget
   - _Full charter TBD_

4. **Finance Coach Agent** — personal financial advisor and accountability partner
   - **Monthly budgeting:** Track income vs. expenses, flag overspending
   - **Bill tracking:** Due dates, reminders, make sure nothing gets missed
   - **Savings goals:** Emergency fund, vacations, kids' college, or other goals
   - **Investment guidance:** Portfolio tracking, general investment awareness
   - **No debt** — debt-free, focus is on building wealth and staying on budget
   - **Starting fresh** — no existing finance tracking system; this agent will establish the system from the ground up
   - **Current savings goal:** Build up ~$90k cash reserve
   - Should help establish budget categories, tracking habits, and accountability
   - _Full charter TBD_

5. **News Briefing Agent** — personal daily news curator
   - Provides a concise daily briefing so user stays informed
   - **News categories:**
     - World/national headlines
     - JPMorgan Chase — company-specific news
     - AI and technology
     - Finance and banking industry
     - Dallas/Fort Worth area events and local news
   - **Format:** Quick bullet-point briefing with links to actual articles — scannable in 5 minutes
   - _Full charter TBD_

## Connectors & Integrations

### Custom MCP Server (Build Our Own)
We are building a custom MCP server using Google's official `googleapis` Node.js client libraries.
This was chosen over third-party community MCP servers for security — user controls every line of code.

**Status:** Not yet built. Next step: build step-by-step in a dedicated session.

**Services to expose via our MCP server:**
1. **Google Calendar** — read events, custody schedule, kids' activities (read-only scope)
2. **Gmail** — surface missed/important emails, upcoming deadlines (read-only scope)
3. **Google Drive** — read/write recipes, wardrobe photos, documents (scoped to specific folders)

**Additional integrations (TBD):**
4. **Web Search** — for News Briefing agent (headlines + article links)
5. **Weather API** — for Style Guru (outfit weather awareness) and Nutrition Coach (grilling weather)
6. **Apple Health** — calorie burn, steps, activity data via Apple Watch (explore HealthKit export or Shortcuts)

### Manual Upload (No API Connection)
- **Bank statements/transactions** — uploaded manually to `finance/statements/` for security. No direct banking API access. This is an intentional security boundary.

### Security Principles
- All API credentials stored in `.env` file (git-ignored, never committed)
- OAuth 2.0 for all Google integrations — no stored passwords
- Principle of least privilege: each connector gets only the scopes it needs
  - Calendar: read-only
  - Gmail: read-only
  - Drive: read/write (scoped to specific folders)
- `.env`, credentials, and tokens are in `.gitignore`
- No direct access to banking or financial accounts
- Secrets never logged, never written to data files
- Regular review of OAuth token scopes and access
- Custom MCP server preferred over third-party for full code auditability
