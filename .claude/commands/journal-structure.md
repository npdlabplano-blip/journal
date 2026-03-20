# Journal Structure Builder

Review the current journal directory structure and CLAUDE.md context file, then help the user extend or modify the organization system.

## What to do

1. Read `CLAUDE.md` to understand the full system context (family, agents, integrations, security principles)
2. Run `find . -type d -not -path './.git/*' -not -path './.claude/*' | sort` to see the current directory structure
3. Review existing agent charters in `agents/` to understand what's already defined
4. Ask the user what they want to add, modify, or reorganize
5. When making changes:
   - Create new directories and starter files as needed
   - Update the relevant agent charter in `agents/` if an agent is affected
   - Update `CLAUDE.md` with any new context, features, or decisions
   - Update `README.md` to reflect structural changes
   - Maintain security principles: never commit secrets, keep `.gitignore` current
6. If adding a new agent:
   - Create a charter file in `agents/` with: Role, Personality, Core Responsibilities, and Data Locations
   - Add corresponding data directories
   - Add the agent to the Agents to Build section in `CLAUDE.md`
   - Add the agent to the README table

## Current Structure Overview

```
planner/    — Calendar, custody schedule, to-dos, routines (central hub)
journal/    — Daily entries, prayers, sermons, Bible study
nutrition/  — Meal plans, recipes, calorie tracking, meal photos
style/      — Wardrobe catalog, outfits, wishlist
finance/    — Budget, bills, savings, investments, statements (manual upload)
news/       — Daily briefings
agents/     — Agent charters (system prompts)
```

## Current Agents

1. Nutrition Coach — `agents/nutrition-coach.md`
2. Devotional Companion — `agents/devotional-companion.md`
3. Style Guru — `agents/style-guru.md`
4. Finance Coach — `agents/finance-coach.md`
5. News Briefing — `agents/news-briefing.md`
