/**
 * Push Weekly Grocery List to Kroger Cart
 *
 * Uses the same Kroger auth as the MCP server.
 * Searches each item at the Coppell store and adds best match to cart.
 */

import { getKrogerAuthClients } from "./src/kroger-auth.js";

const STORE_ID = "03500448"; // Kroger Coppell
const API_BASE = "https://api.kroger.com/v1";

// Corrected grocery list with Nicole's preferences applied
const groceryList = [
  // === MEAT / PROTEIN ===
  { search: "boneless skinless chicken thighs", qty: 2, notes: "~3 lbs total" },
  { search: "flank steak", qty: 1, notes: "~1.5 lbs — may return seasoned skirt steak, swap in app if needed" },
  { search: "kroger steakhouse pork tenderloin", qty: 1, notes: "Kroger steakhouse version" },
  { search: "ground beef 80 20", qty: 2, notes: "1 lb packs, need 1.5 lbs total" },
  { search: "boneless skinless chicken breast", qty: 1, notes: "~1.5 lbs for Saturday fajitas" },
  { search: "large eggs dozen", qty: 1, notes: "Hard boil 6 + breakfast" },

  // === PRODUCE ===
  { search: "bell peppers mixed", qty: 6, notes: "Prep trays + fajitas + snacking" },
  { search: "kroger broccoli florets", qty: 2, notes: "Bagged pre-cut florets — if returns cauliflower, swap in app" },
  { search: "zucchini squash", qty: 3, notes: "Monday air fry" },
  { search: "green beans fresh", qty: 1, notes: "1 lb for Friday" },
  { search: "sweet potatoes", qty: 3, notes: "Tuesday wedges" },
  { search: "arugula", qty: 1, notes: "5 oz bag, Sunday salad" },
  { search: "mixed greens", qty: 2, notes: "5 oz containers" },
  { search: "green leaf lettuce", qty: 1, notes: "Taco bowls + taco salad (preference over romaine)" },
  { search: "butter lettuce", qty: 1, notes: "Friday burger wraps" },
  { search: "cherry tomatoes pint", qty: 2, notes: "All week salads + snacking" },
  { search: "cucumber", qty: 2, notes: "Lunches + snacking" },
  { search: "avocados", qty: 4, notes: "Various meals" },
  { search: "yellow onion", qty: 2, notes: "Fajitas + cooking" },
  { search: "white onion", qty: 1, notes: "General use" },
  { search: "garlic head", qty: 1, notes: "Various recipes" },
  { search: "cilantro bunch", qty: 2, notes: "Chimichurri + rice + fajitas" },
  { search: "flat leaf parsley", qty: 1, notes: "Chimichurri" },
  { search: "limes", qty: 6, notes: "Rice + taco bowls + fajitas" },
  { search: "lemons", qty: 3, notes: "Vinaigrette + broccoli + marinade" },
  { search: "grapes", qty: 1, notes: "1 lb bag — breakfast + freeze for cravings" },
  { search: "pico de gallo fresh", qty: 1, notes: "Kroger pre-made fresh pico" },
  { search: "bananas", qty: 1, notes: "Bunch — sweet craving replacement + Connie snack" },

  // === DAIRY ===
  { search: "colby jack block cheese", qty: 1, notes: "Block only — shred at home for everything" },
  { search: "parmesan cheese grated", qty: 1, notes: "For zucchini — check stock" },
  { search: "plain greek yogurt", qty: 1, notes: "Sour cream substitute" },
  { search: "cheese sticks", qty: 1, notes: "Breakfast + snacks" },

  // === PANTRY ===
  { search: "kroger jasmine rice", qty: 1, notes: "2 lb bag, long grain" },
  { search: "hummus", qty: 2, notes: "Lunches + snacking" },
  { search: "fire roasted salsa", qty: 1, notes: "Not Pace — roasted/fire-roasted" },
  { search: "taco seasoning", qty: 1, notes: "Taco bowls" },
  { search: "fajita seasoning", qty: 1, notes: "Saturday fajitas" },
  { search: "kalamata olives", qty: 1, notes: "Thursday snack plate" },
  { search: "tortilla chips", qty: 1, notes: "Calvin — taco bowls" },
  { search: "flour tortillas large", qty: 1, notes: "Calvin — fajitas" },
  { search: "brioche buns", qty: 1, notes: "Calvin — burgers (preference over regular buns)" },
  { search: "almonds", qty: 1, notes: "Thursday snack plate — check stock" },

  // === BEVERAGES ===
  { search: "kroger sparkling water lime 1 liter", qty: 5, notes: "Kroger brand lime — may need to swap in app" },
  { search: "kroger sparkling water mandarin orange", qty: 5, notes: "Kroger brand mandarin — may need to swap in app" },
  { search: "celestial seasonings vanilla tea", qty: 1, notes: "Evening sweet craving replacement" },

  // === FROZEN / BREAKFAST ===
  { search: "frozen berries mixed", qty: 1, notes: "Protein shakes" },
  { search: "jimmy dean breakfast sandwich biscuit", qty: 1, notes: "Calvin's breakfast" },
];

// Items to SKIP (Amazon or Sprouts):
// - IQ Bars → Amazon
// - Robert Irvine Fit Crunch bars → Amazon
// - Garden of Life protein powder → Sprouts
// - Laird Performance Mushrooms → Sprouts
// - NeoCell Collagen → Sprouts
// - Walnut milk → check stock

async function searchProduct(makeClientRequest, term, locationId) {
  const params = new URLSearchParams({
    "filter.term": term,
    "filter.locationId": locationId,
    "filter.limit": "5",
  });

  const data = await makeClientRequest(`/products?${params}`);
  return (data.data || []).map((product) => {
    const item = product.items?.[0] || {};
    const price = item.price || {};
    return {
      upc: product.upc,
      name: product.description,
      brand: product.brand || "Store Brand",
      size: item.size || "N/A",
      price: price.regular ? price.regular.toFixed(2) : "N/A",
      promoPrice: price.promo ? price.promo.toFixed(2) : null,
    };
  });
}

async function main() {
  console.log("Connecting to Kroger API...\n");
  const { makeClientRequest, makeUserRequest } = await getKrogerAuthClients();
  console.log("Authenticated. Searching products at Kroger Coppell...\n");

  const cartItems = [];
  const notFound = [];
  const warnings = [];

  for (const item of groceryList) {
    process.stdout.write(`Searching: "${item.search}" ... `);

    try {
      const results = await searchProduct(makeClientRequest, item.search, STORE_ID);

      if (results.length === 0) {
        console.log("NOT FOUND");
        notFound.push(item);
        continue;
      }

      const best = results[0];
      const priceStr = best.promoPrice
        ? `$${best.promoPrice} (was $${best.price})`
        : `$${best.price}`;

      console.log(`✓ ${best.name} — ${best.size} — ${priceStr}`);

      cartItems.push({
        upc: best.upc,
        quantity: item.qty,
        name: best.name,
        price: best.promoPrice || best.price,
      });

      // Flag known problematic searches
      if (item.search.includes("broccoli") && best.name.toLowerCase().includes("cauliflower")) {
        warnings.push(`⚠ "${item.search}" matched cauliflower — swap in app`);
      }
      if (item.search.includes("cilantro") && !best.name.toLowerCase().includes("cilantro")) {
        warnings.push(`⚠ "${item.search}" matched "${best.name}" — verify in app`);
      }
      if (item.search.includes("flank") && best.name.toLowerCase().includes("seasoned")) {
        warnings.push(`⚠ "${item.search}" matched seasoned meat — swap in app if needed`);
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      notFound.push(item);
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  // Push all found items to cart
  if (cartItems.length > 0) {
    console.log(`\n--- Pushing ${cartItems.length} items to Kroger cart ---\n`);

    try {
      await makeUserRequest("/cart/add", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((i) => ({ upc: i.upc, quantity: i.quantity })),
        }),
      });
      console.log(`✅ Successfully added ${cartItems.length} items to your Kroger cart!\n`);
    } catch (err) {
      console.error(`❌ Cart push failed: ${err.message}\n`);
    }
  }

  // Summary
  console.log("=== SUMMARY ===\n");

  let estimatedTotal = 0;
  console.log("Items added to cart:");
  for (const item of cartItems) {
    const lineTotal = parseFloat(item.price) * item.quantity;
    estimatedTotal += isNaN(lineTotal) ? 0 : lineTotal;
    console.log(`  ✓ ${item.name} × ${item.quantity} — $${item.price}`);
  }
  console.log(`\n  Estimated total: ~$${estimatedTotal.toFixed(2)}\n`);

  if (notFound.length > 0) {
    console.log("Items NOT found (add manually in app):");
    for (const item of notFound) {
      console.log(`  ✗ ${item.search} (${item.notes})`);
    }
    console.log();
  }

  if (warnings.length > 0) {
    console.log("Warnings (verify in Kroger app):");
    for (const w of warnings) {
      console.log(`  ${w}`);
    }
    console.log();
  }

  console.log("Skip list (Amazon/Sprouts):");
  console.log("  • IQ Bars → Amazon");
  console.log("  • Robert Irvine Fit Crunch bars (yellow box) × 2 → Amazon");
  console.log("  • Garden of Life Raw Organic Protein (vanilla) → Sprouts");
  console.log("  • Laird Performance Mushrooms → Sprouts");
  console.log("  • NeoCell Collagen Bio-Peptides → Sprouts");
  console.log("\nOpen the Kroger app to review your cart, remove what you already have, and checkout!");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
