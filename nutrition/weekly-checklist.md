# Weekly Nutrition Planning Checklist

Run this checklist every Sunday (or Saturday evening) to set up the week ahead.

---

## Measurement Schedule

Measurements taken every 2 weeks on Sunday morning, same time as progress photos.

| # | Date | Status |
|---|------|--------|
| 1 | 2026-03-22 | Done (starting measurements) |
| 2 | 2026-04-05 | |
| 3 | 2026-04-19 | |
| 4 | 2026-05-03 | |
| 5 | 2026-05-17 | |
| 6 | 2026-05-31 | |

**Next measurements due: 2026-04-05**

---

## Weekly Checklist

### 1. Progress Check-In
- [ ] Log current weight (if not already logged this morning)
- [ ] Is this a measurement week? If yes:
  - [ ] Take measurements (waist, hips, bust, thigh)
  - [ ] Take progress photos
  - [ ] Update `progress/measurements.md` and `progress/photos.md`
- [ ] Review weight trend for the week — how did the weekly average compare?
- [ ] Discuss wins, struggles, and adjustments
  - What went well this week?
  - Any meals that didn't work or got skipped?
  - Energy levels, hunger, cravings?
  - Did the beverage plan hold (no weeknight IPAs, water-first rule)?

### 2. Review Calendar & Schedule
- [ ] Pull calendar for the upcoming week (Google Calendar)
- [ ] Note custody schedule — which nights are the kids home?
- [ ] Flag busy evenings (church, activities, events) that need quick/no-cook meals
- [ ] Flag any special events (date night, kids' events, work dinners)
- [ ] Check for conflicts that affect grocery timing or meal prep

### 3. Inventory Audit
- [ ] Open `nutrition/current-inventory.md` as the starting point
- [ ] Take verification photos of fridge (each shelf + door), freezer, pantry, counter
- [ ] Upload photos to `nutrition/photos/YYYY-MM-DD/current inventory/`
- [ ] Claude compares photos against running inventory — flag discrepancies
- [ ] Update `current-inventory.md` with corrections

### 4. Build Meal Plan
- [ ] Check `nutrition/meal-history.md` — avoid repeating recent meals
- [ ] Build plan based on:
  - Custody schedule (how many people each night)
  - Busy nights (quick meals) vs. open nights (cook meals)
  - What proteins/produce are already on hand
  - Mom's calorie target (~1,200 cal/day weekdays, ~1,300 weekends)
- [ ] Plan Sunday grill/prep session
- [ ] Plan packed lunches for Mon–Thu
- [ ] Save meal plan to `nutrition/meal-plans/YYYY-MM-DD-week.md`

### 5. Build Grocery List & Kroger Cart
- [ ] Generate grocery list from meal plan minus current inventory
- [ ] Cross-reference items against `nutrition/kroger-products.md` for UPCs
- [ ] **Price check**: Search Kroger for alternatives on each item
  - Flag any comparable product >$0.50 or >15% cheaper
  - Present alternatives for accept/reject
  - Update product DB if switching
- [ ] Push final list to Kroger cart via API
- [ ] Note any items to get elsewhere (Rosas, Amazon, Sprouts)
- [ ] Update `current-inventory.md` with purchased items

---

## After Shopping

- [ ] Update `current-inventory.md` — move "Purchased This Week" items into main sections
- [ ] Remove any items that were out of stock or substituted
- [ ] Start Sunday prep per the meal plan
