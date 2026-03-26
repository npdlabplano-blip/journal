/**
 * Image Generation Tools (Imagen 3 via Vertex AI)
 *
 * Uses Google's Imagen 3 model on Vertex AI to generate images.
 *
 * Tools:
 * - generate_image: General-purpose image generation from any text prompt
 * - generate_outfit_image: Generate a styled outfit visualization
 */

import { z } from "zod";

export function registerImageTools(server, vertexClient) {
  /**
   * General-purpose image generation using Imagen 3.
   */
  server.tool(
    "generate_image",
    "Generate an AI image from a text prompt using Imagen 3. Use this for any image generation need — landscape designs, visualizations, concept art, etc.",
    {
      prompt: z
        .string()
        .describe(
          "Detailed text prompt describing the image to generate. Be specific about subject, style, lighting, colors, composition, and mood."
        ),
      aspect_ratio: z
        .enum(["1:1", "9:16", "16:9", "3:4", "4:3"])
        .default("4:3")
        .describe(
          'Aspect ratio of the generated image. "1:1" (square), "9:16" (portrait/phone), "16:9" (landscape/wide), "3:4" (portrait), "4:3" (landscape). Default: "4:3".'
        ),
    },
    async ({ prompt, aspect_ratio }) => {
      try {
        const accessToken = await vertexClient.getAccessToken();
        const { projectId, location } = vertexClient;

        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-002:predict`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: aspect_ratio,
              safetySetting: "block_few",
            },
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `Vertex AI API error (${response.status}): ${errorBody}`
          );
        }

        const result = await response.json();
        const imageData = result.predictions[0].bytesBase64Encoded;
        const mimeType = result.predictions[0].mimeType || "image/png";

        return {
          content: [
            {
              type: "image",
              data: imageData,
              mimeType,
            },
            {
              type: "text",
              text: JSON.stringify(
                {
                  model: "imagen-3.0-generate-002",
                  aspect_ratio,
                  prompt_length: prompt.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        const message = err?.message || String(err);
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

  /**
   * Generate a flat-lay or styled outfit visualization using Imagen 3.
   * Designed for the Style Guru agent to create visual outfit suggestions.
   */
  server.tool(
    "generate_outfit_image",
    "Generate an AI outfit visualization image using Imagen 3. Returns the generated image. Use this to create flat-lay or styled-look visuals for outfit suggestions.",
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
        const accessToken = await vertexClient.getAccessToken();
        const { projectId, location } = vertexClient;

        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-002:predict`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: "1:1",
              safetySetting: "block_few",
            },
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Vertex AI API error (${response.status}): ${errorBody}`);
        }

        const result = await response.json();
        const imageData = result.predictions[0].bytesBase64Encoded;
        const mimeType = result.predictions[0].mimeType || "image/png";

        return {
          content: [
            {
              type: "image",
              data: imageData,
              mimeType,
            },
            {
              type: "text",
              text: JSON.stringify(
                {
                  model: "imagen-3.0-generate-002",
                  style,
                  occasion: occasion || "general",
                  season: season || "not specified",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        const message = err?.message || String(err);
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
