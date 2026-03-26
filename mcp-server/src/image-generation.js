/**
 * Image Generation Tools (Imagen 3 via Vertex AI)
 *
 * Uses Google's Imagen 3 model on Vertex AI to generate images.
 *
 * Tools:
 * - generate_image: General-purpose image generation from any text prompt
 * - edit_image: Edit an existing image using a text prompt (mask-free or with auto-masking)
 * - generate_outfit_image: Generate a styled outfit visualization
 */

import { z } from "zod";
import { readFile, writeFile } from "fs/promises";
import { basename, join } from "path";

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

        // Save generated image to 00-inbox folder
        const ext = mimeType === "image/jpeg" ? ".jpg" : ".png";
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const outFileName = `generated_${timestamp}${ext}`;
        const inboxDir = join(process.cwd(), "00-inbox");
        const outPath = join(inboxDir, outFileName);
        await writeFile(outPath, Buffer.from(imageData, "base64"));

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
                  saved_to: outPath,
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
   * Edit an existing image using Imagen 3 (mask-free editing).
   * Uses imagen-3.0-capability-001 to modify a photo based on a text prompt.
   */
  server.tool(
    "edit_image",
    "Edit an existing image using AI. Provide a file path to the source image and a text prompt describing the desired changes. Uses Imagen 3 mask-free editing to modify the image without requiring a mask. Great for visualizing changes to photos — landscaping, remodeling, styling, etc.",
    {
      image_path: z
        .string()
        .describe(
          "Absolute file path to the source image to edit (PNG, JPEG, GIF, or BMP). Max 20MB."
        ),
      prompt: z
        .string()
        .describe(
          "Text prompt describing the desired edits. Be specific about what to add, change, or modify. Example: 'Add colorful flower beds with brick edging along the front walkway'"
        ),
      edit_mode: z
        .enum(["inpaint_insert", "inpaint_remove", "bgswap", "outpaint"])
        .default("inpaint_insert")
        .describe(
          'Edit mode: "inpaint_insert" (add objects/elements from prompt), "inpaint_remove" (remove objects and fill), "bgswap" (replace background), "outpaint" (extend image). Default: "inpaint_insert".'
        ),
      mask_mode: z
        .enum(["background", "foreground", "semantic"])
        .default("background")
        .describe(
          'Auto-mask mode (ignored when mask_image_path is provided): "background" (auto-detect and mask background areas), "foreground" (auto-detect and mask foreground), "semantic" (AI determines what to mask based on prompt). Default: "background".'
        ),
      mask_image_path: z
        .string()
        .optional()
        .describe(
          "Optional absolute file path to a custom mask image (PNG). Must be the same dimensions as the source image. White areas (255) will be edited, black areas (0) will be preserved. Use this for precise control over which parts of the image to modify."
        ),
    },
    async ({ image_path, prompt, edit_mode, mask_mode, mask_image_path }) => {
      const editModeMap = {
        inpaint_insert: "EDIT_MODE_INPAINT_INSERTION",
        inpaint_remove: "EDIT_MODE_INPAINT_REMOVAL",
        bgswap: "EDIT_MODE_BGSWAP",
        outpaint: "EDIT_MODE_OUTPAINT",
      };

      const maskModeMap = {
        background: "MASK_MODE_BACKGROUND",
        foreground: "MASK_MODE_FOREGROUND",
        semantic: "MASK_MODE_SEMANTIC",
      };

      try {
        // Read the source image and convert to base64
        const imageBuffer = await readFile(image_path);
        const imageBase64 = imageBuffer.toString("base64");

        const accessToken = await vertexClient.getAccessToken();
        const { projectId, location } = vertexClient;

        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-capability-001:predict`;

        const requestBody = {
          instances: [
            {
              prompt,
              referenceImages: [
                {
                  referenceType: "REFERENCE_TYPE_RAW",
                  referenceId: 1,
                  referenceImage: {
                    bytesBase64Encoded: imageBase64,
                  },
                },
              ],
            },
          ],
          parameters: {
            editMode: editModeMap[edit_mode],
            sampleCount: 1,
            safetySetting: "block_few",
          },
        };

        // Add mask config: custom mask image if provided, otherwise auto-mask mode
        if (mask_image_path) {
          const maskBuffer = await readFile(mask_image_path);
          const maskBase64 = maskBuffer.toString("base64");
          requestBody.instances[0].referenceImages.push({
            referenceType: "REFERENCE_TYPE_MASK",
            referenceId: 2,
            referenceImage: {
              bytesBase64Encoded: maskBase64,
            },
            maskImageConfig: {
              maskMode: "MASK_MODE_USER_PROVIDED",
              dilation: 0.0,
            },
          });
        } else {
          requestBody.instances[0].referenceImages.push({
            referenceType: "REFERENCE_TYPE_MASK",
            referenceId: 2,
            maskImageConfig: {
              maskMode: maskModeMap[mask_mode],
              dilation: 0.01,
            },
          });
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
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

        // Save edited image to 00-inbox folder
        const ext = mimeType === "image/jpeg" ? ".jpg" : ".png";
        const srcName = basename(image_path, ext).replace(/_resized$/, "");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const outFileName = `${srcName}_edited_${timestamp}${ext}`;
        const inboxDir = join(process.cwd(), "00-inbox");
        const outPath = join(inboxDir, outFileName);
        await writeFile(outPath, Buffer.from(imageData, "base64"));

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
                  model: "imagen-3.0-capability-001",
                  edit_mode,
                  mask_mode: mask_image_path ? "custom" : mask_mode,
                  mask_image: mask_image_path || null,
                  source_image: image_path,
                  saved_to: outPath,
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
              text: `Image editing failed: ${message}`,
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

        // Save outfit image to 00-inbox folder
        const ext = mimeType === "image/jpeg" ? ".jpg" : ".png";
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const outFileName = `outfit_${timestamp}${ext}`;
        const inboxDir = join(process.cwd(), "00-inbox");
        const outPath = join(inboxDir, outFileName);
        await writeFile(outPath, Buffer.from(imageData, "base64"));

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
                  saved_to: outPath,
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
