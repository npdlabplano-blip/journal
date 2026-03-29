---
description: instructions for creating an online shopping experience for Nicole
---
# Overview
I want to create an simulated, curated online shopping experiences, similar to what I would expect from stitch fix or other personalized shopping capsule sites. They way it works, is a stylist learns my style and generates recommendations that would work well with my price range and current inventory. They will recommend an item, match my size and then show flat-lays of what the item would look like with other pieces in my inventory. I want to expand on this principle and rather than using a service that charges over head, I would like you to create it for me.

# Input
agents/style-guru
inventory: style/wardrobe/catalog.md
photos of inventory: style/wardrobe/photos/


# Output
Indexed website in a similar design to what is notated in website-hld.excalidraw
The site will have an index page highlighting what is being recommended with images. Each recommendation will link to its own page which will have details from the vendors site on the item with an image the vendor supplies (not a DALLE generated image). Underneath that image there will outfit recommendations where you take the vendor image and description and create DALLE generated flat lay images with items for my current wardrobe to give me an idea on how this will look.

Each time this is run, please recommend eight different pieces.

Site should live at style/capsule

# Important
For each recommendation:
1. Verify I don't already own the item or something very similar
2. When recommending, please make sure the vendor has the item in my size, the color you are recommending and in stock. 
3. Each recommendation should have a picture from the vendor. That is the key piece of information I need to know whether I am interested in purchasing.
4. VALIDATE every link that it actually goes to the product page where I can add it to a cart, and the item is not out of stock.
5. Structure the website so that we don't have to re-invent th wheel every time I want to re-run
6. Recommendations should be of excellent quality and extend the use of my current wardrobe and meet the use case I am looking for as prompted
7. Estimate by size by looking below and referencing nutrition/progress/measurements.md

# Order of operations
- Read through current inventory
- Visit approved vendor sites to find items I might be interested in purchasing. 
- If an item is a good candidate for recommendation, make sure it is in stock, in my size and save the picture and link where I can purchase
- Update the website with the recommendations


# Stores
- Nordstroms
- Dillards
- Neiman Marcus
- Banana Republic
- Loft
- Lululemon
- Sacks 5th Avenue
- Anne Taylor
- Anne Fontaine
- White House Black Market
- Buckle

# Sizing
- 5'7"
- 16" torso
- 33" inseam
- nutrition/progress/measurements.md
- Tops: Size Small or 4-6
- Bottoms: Size 6 or 28 waist
- Dresses: Size 6 (numeric) or S (alpha)
- Long inseam preferred (33")

# Scraping Notes (updated 2026-03-29)
These notes help future runs avoid wasted time on sites that don't cooperate:

## Works well with WebFetch (verified product data):
- **White House Black Market** — full product details, prices, colors, sizes, stock status, and image URLs all extractable

## Does NOT work with WebFetch (JavaScript-rendered, obfuscated):
- Nordstrom, Nordstrom Rack, Banana Republic, Ann Taylor, Loft, Dillard's, Saks, Macy's, Sam Edelman, Kate Spade Outlet, Lululemon

## Workaround strategy:
1. Use **WebSearch** to find specific product URLs and leads from any store
2. Use **WebFetch** on WHBM product pages for fully verified picks
3. For non-WHBM stores, use WebSearch cross-references to gather product name, approximate price, color options, and description
4. Add a "verify before purchasing" note on any item where stock/size couldn't be confirmed via direct page scrape
5. Use vendor-supplied image URLs for WHBM; use flat-lay generated images as fallback for stores where product images can't be extracted

# Website Structure (reusable)
- `index.html` — grid of 8 pick cards (vendor images + name + price + tag)
- `picks/pick[1-8].html` — detail pages (vendor image, description, shop button, flat-lay outfit pairing)
- `images/` — generated flat-lay outfit images
- `styles.css` — shared stylesheet
- `template-detail.html` — reusable HTML template with placeholders
- On re-runs: update pick content, regenerate images, overwrite HTML files
