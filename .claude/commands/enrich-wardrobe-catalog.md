# Enrich Wardrobe Catalog

Enrich wardrobe catalog descriptions by viewing actual photos and writing rich, detailed descriptions for the Style Guru agent.

## Context
- Catalog lives at `style/wardrobe/catalog.md`
- Photos are stored locally at `style/wardrobe/photos/{category}/` (tops, bottoms, jackets, dresses, shoes)
- Photo filenames include the item number (e.g., `41. Navy blue Fortune Iv blouse.JPG`)
- Current catalog has basic descriptions like "Navy blouse" — we need rich details

## What "Rich Description" Means
For each item, look at the photo and capture:
- **Fabric/texture** — knit, woven, silk-like, cotton, ribbed, cable-knit, chiffon, etc.
- **Fit** — relaxed, fitted, oversized, cropped, A-line, slim, etc.
- **Neckline/closure** — V-neck, crew, mock neck, button-front, zip, wrap, etc.
- **Sleeve detail** — length, cuff style, rolled, ruched, bell, etc.
- **Pattern detail** — if striped, describe width/direction; if floral, describe scale; if plaid, describe colors
- **Notable features** — pockets, ruffles, pleats, hardware, cutouts, hem details, embellishments
- **Styling notes** — what it pairs well with, tuck-in-ability, layering potential

## Process (Batch Mode)
1. Check `style/wardrobe/enrichment-progress.md` to see what's already been done
2. Pick the next batch of 10-15 items that haven't been enriched yet
3. Read each photo using the Read tool
4. Write a rich description based on what you see
5. Update the catalog's Description column with the enriched text (keep it concise but vivid — aim for 15-30 words per description)
6. After updating the catalog, update `style/wardrobe/enrichment-progress.md` with what was completed
7. Commit the changes
8. Report what was done and what's next

## Enrichment Progress Tracker
The file `style/wardrobe/enrichment-progress.md` tracks which items have been enriched. Format:
```
# Enrichment Progress
## Completed
- [ ] Tops 41-57 (batch 1) — done 2026-03-29
## Remaining
- [ ] Tops 58-86, 145, 147, 213
- [ ] Bottoms 101-131 + Absolute Pant, Microflare pant
- [ ] Jackets 201-215
- [ ] Dresses 301-320 + Pointe dress
- [ ] Shoes 501-520
```

## Important Notes
- Work in batches of 10-15 items to avoid context issues
- Update the catalog AND progress tracker after each batch
- Commit after each batch so progress is saved
- Don't change any columns other than Description — leave Brand, Color/Pattern, Subcategory, Season, Occasion, and Drive ID as-is
- If a photo is unclear, note that in the description and move on
