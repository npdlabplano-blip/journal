/**
 * Kroger Tools
 *
 * Provides grocery integration with Kroger:
 * - find_kroger_store: Find nearby Kroger store locations
 * - search_kroger_products: Search for products at a specific store
 * - add_to_kroger_cart: Add items to the user's Kroger cart
 * - add_grocery_list_to_cart: Add an entire grocery list to the cart in one go
 */

import { z } from "zod";

// Nicole's preferred store — Kroger Marketplace, Coppell TX (Sandy Lake & Denton Tap)
// This will be looked up on first run and can be overridden per-call
const DEFAULT_ZIP = "75019";

export function registerKrogerTools(server, krogerClients) {
  const { makeClientRequest, makeUserRequest } = krogerClients;

  /**
   * Find nearby Kroger store locations by zip code.
   * Returns store IDs needed for product search and cart.
   */
  server.tool(
    "find_kroger_store",
    "Find Kroger store locations near a zip code. Returns store IDs for product search.",
    {
      zipCode: z
        .string()
        .default(DEFAULT_ZIP)
        .describe("Zip code to search near (default: 75019 — Coppell, TX)"),
      radius: z
        .number()
        .default(10)
        .describe("Search radius in miles (default: 10)"),
      limit: z
        .number()
        .default(5)
        .describe("Max number of stores to return (default: 5)"),
    },
    async ({ zipCode, radius, limit }) => {
      const params = new URLSearchParams({
        "filter.zipCode.near": zipCode,
        "filter.radiusInMiles": radius.toString(),
        "filter.limit": limit.toString(),
      });

      const data = await makeClientRequest(`/locations?${params}`);

      const stores = (data.data || []).map((store) => ({
        locationId: store.locationId,
        name: store.name,
        address: store.address
          ? `${store.address.addressLine1}, ${store.address.city}, ${store.address.state} ${store.address.zipCode}`
          : "N/A",
        phone: store.phone || "N/A",
      }));

      return {
        content: [
          {
            type: "text",
            text:
              stores.length > 0
                ? JSON.stringify(stores, null, 2)
                : `No Kroger stores found near ${zipCode}.`,
          },
        ],
      };
    }
  );

  /**
   * Search for products at a specific Kroger store.
   * Returns product names, UPCs, prices, and sizes.
   */
  server.tool(
    "search_kroger_products",
    "Search for a product at a Kroger store. Returns product details, UPCs, and prices.",
    {
      term: z
        .string()
        .describe(
          'Search term (e.g., "boneless chicken thighs", "Topo Chico", "arugula")'
        ),
      locationId: z
        .string()
        .describe(
          "Kroger store location ID (from find_kroger_store). Required for pricing."
        ),
      limit: z
        .number()
        .default(5)
        .describe("Max number of results (default: 5)"),
    },
    async ({ term, locationId, limit }) => {
      const params = new URLSearchParams({
        "filter.term": term,
        "filter.locationId": locationId,
        "filter.limit": limit.toString(),
      });

      const data = await makeClientRequest(`/products?${params}`);

      const products = (data.data || []).map((product) => {
        const item = product.items?.[0] || {};
        const price = item.price || {};
        return {
          productId: product.productId,
          upc: product.upc,
          name: product.description,
          brand: product.brand || "Store Brand",
          size: item.size || "N/A",
          price: price.regular
            ? `$${price.regular.toFixed(2)}`
            : "Price not available",
          promoPrice: price.promo
            ? `$${price.promo.toFixed(2)}`
            : null,
          inStock: item.fulfillment?.inStore ?? null,
        };
      });

      return {
        content: [
          {
            type: "text",
            text:
              products.length > 0
                ? JSON.stringify(products, null, 2)
                : `No products found for "${term}" at this location.`,
          },
        ],
      };
    }
  );

  /**
   * Add a single item to the user's Kroger cart.
   * Does NOT purchase — just stages it in the cart for review.
   */
  server.tool(
    "add_to_kroger_cart",
    "Add a product to your Kroger cart (does NOT purchase — just stages it for review in the Kroger app).",
    {
      upc: z
        .string()
        .describe("Product UPC code (from search_kroger_products)"),
      quantity: z
        .number()
        .default(1)
        .describe("Quantity to add (default: 1)"),
    },
    async ({ upc, quantity }) => {
      await makeUserRequest("/cart/add", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ upc, quantity }],
        }),
      });

      return {
        content: [
          {
            type: "text",
            text: `Added to Kroger cart: UPC ${upc}, quantity ${quantity}. Open the Kroger app to review.`,
          },
        ],
      };
    }
  );

  /**
   * Add multiple items to the Kroger cart at once.
   * Takes an array of { upc, quantity } objects.
   * Designed for pushing an entire grocery list in one call.
   */
  server.tool(
    "add_grocery_list_to_cart",
    "Add multiple products to your Kroger cart at once (e.g., a full grocery list). Does NOT purchase.",
    {
      items: z
        .array(
          z.object({
            upc: z.string().describe("Product UPC code"),
            quantity: z
              .number()
              .default(1)
              .describe("Quantity to add (default: 1)"),
          })
        )
        .describe("Array of items to add, each with a UPC and quantity"),
    },
    async ({ items }) => {
      // Kroger cart API accepts multiple items in one call
      await makeUserRequest("/cart/add", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      return {
        content: [
          {
            type: "text",
            text:
              `Added ${items.length} items to your Kroger cart.\n` +
              `Open the Kroger app to review, remove what you already have, and checkout when ready.\n\n` +
              `Items added:\n` +
              items.map((i) => `  - UPC ${i.upc} × ${i.quantity}`).join("\n"),
          },
        ],
      };
    }
  );
}
