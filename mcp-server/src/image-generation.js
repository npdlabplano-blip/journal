/**
 * Image Generation Tools (DALL-E)
 *
 * Provides AI-generated outfit visualizations for the Style Guru agent.
 * Uses OpenAI's DALL-E API to create flat-lay and styled-look images.
 *
 * Tools:
 * - generate_outfit_image: Generate a styled outfit visualization
 */

import { z } from "zod";

export function registerImageTools(server, openaiClient) {
  /**
   * Generate a flat-lay or styled outfit visualization using DALL-E.
   * Designed for the Style Guru agent to create visual outfit suggestions.
   */
  server.tool(
    "generate_outfit_image",
    "Generate an AI outfit visualization image using DALL-E. Returns a URL to the generated image. Use this to create flat-lay or styled-look visuals for outfit suggestions.",
    {
      outfit_description: z
        .string()
        .describe(
          "Detailed description of the outfit to visualize. Include: specific clothing items, colors, fabrics, patterns, and silhouettes. Example: 'Navy Daniel Rainn blouse with white polka dots, black slim-fit ankle pants, cognac leather block-heel sandals, gold hoop earrings, structured tan tote bag'"
        ),
      occasion: z
        .string()
        .optional()
        .describe(
          'The occasion for the outfit: "work", "church", "date_night", "casual", "lounge". Affects the styling and setting of the image.'
        ),
      style: z
        .enum(["flat_lay", "styled_look", "mannequin"])
        .default("flat_lay")
        .describe(
          "Image style: 'flat_lay' (items arranged on a surface, overhead view), 'styled_look' (outfit on a fashion illustration/mannequin), 'mannequin' (on a dress form)"
        ),
      season: z
        .string()
        .optional()
        .describe(
          'Season for styling context: "spring", "summer", "fall", "winter". Affects layering and accessories in the image.'
        ),
    },
    async ({ outfit_description, occasion, style, season }) => {
      // Build a detailed prompt for DALL-E that produces clean, fashion-forward images
      const styleDescriptions = {
        flat_lay:
          "Overhead flat-lay photograph on a clean white marble surface. Items neatly arranged with small gaps between them. Professional fashion photography style, soft natural lighting, no wrinkles.",
        styled_look:
          "Fashion illustration of a complete outfit on an elegant faceless fashion figure. Clean white background, editorial style, professional fashion sketch with realistic fabric textures.",
        mannequin:
          "Professional fashion photograph of outfit displayed on a modern white dress form/mannequin. Clean studio background, soft lighting, editorial quality.",
      };

      const occasionContext = occasion
        ? ` This outfit is styled for a ${occasion.replace("_", " ")} occasion.`
        : "";

      const seasonContext = season ? ` Styled for ${season} weather.` : "";

      const prompt = `${styleDescriptions[style]} The outfit consists of: ${outfit_description}.${occasionContext}${seasonContext} High-quality, photorealistic, fashion editorial style. No text or labels in the image.`;

      try {
        const response = await openaiClient.images.generate({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
        });

        const imageUrl = response.data[0].url;
        const revisedPrompt = response.data[0].revised_prompt;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  image_url: imageUrl,
                  revised_prompt: revisedPrompt,
                  style,
                  occasion: occasion || "general",
                  note: "Image URL expires after ~1 hour. Download or display promptly.",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        const message = err?.error?.message || err.message || String(err);
        return {
          content: [
            {
              type: "text",
              text: `Image generation failed: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
