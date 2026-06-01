import type { Express, Request, Response } from "express";
import { generateImageBuffer } from "./client";
import { ObjectStorageService, setObjectAclPolicy } from "../object_storage";
import { storage } from "../../storage";

export const VIAL_PROMPT_TEMPLATE = (name: string, contents: string) =>
  `Premium product photography in the Aesop / Le Labo apothecary aesthetic. ` +
  `CLOSE-UP, ZOOMED-IN macro shot of a single small clear glass pharmaceutical vial ` +
  `(${contents}, with a brushed-aluminum crimped cap) standing centered and filling ` +
  `roughly 75% of the frame vertically. Inside the vial, a small amount of fine ` +
  `off-white lyophilized powder rests at the bottom. ` +
  `Soft, diffused natural daylight from the upper-left, casting a gentle long shadow ` +
  `to the right. Background is a seamless warm cream-ivory wall (#F5F1EA), no props, ` +
  `no text on the wall, no measurements, no logos other than the vial label. ` +
  `The vial wears a clean cream paper label with delicate small black serif typography ` +
  `reading exactly: "${name}" on the first line and "${contents}" on the second line, ` +
  `centered, generous whitespace, no other text. ` +
  `Square 1:1 composition. Editorial, minimal, calm, slightly warm color grade. ` +
  `Sharp focus on the label. Subtle film grain. No people, no hands, no extra objects.`;

export function registerImageRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: () => void) => void,
): void {
  app.post(
    "/api/admin/generate-product-image",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const flag = await storage.getSetting("feature_ai_image_enabled");
        if (flag === "false") {
          return res.status(503).json({
            message: "AI image generation is currently disabled.",
          });
        }

        const { name: rawName, contents: rawContents } = req.body as {
          name?: string;
          contents?: string;
        };

        const name = typeof rawName === "string" ? rawName.trim() : "";
        const contents = typeof rawContents === "string" ? rawContents.trim() : "";

        if (!name || !contents) {
          return res.status(400).json({
            message: "Both 'name' and 'contents' are required",
          });
        }
        if (name.length > 120 || contents.length > 200) {
          return res.status(400).json({
            message: "'name' or 'contents' exceeds maximum length",
          });
        }

        const prompt = VIAL_PROMPT_TEMPLATE(name, contents);
        const imageBuffer = await generateImageBuffer(prompt, "1024x1024");

        const objStorage = new ObjectStorageService();
        const uploadURL = await objStorage.getObjectEntityUploadURL();
        const objectPath = objStorage.normalizeObjectEntityPath(uploadURL);

        const uploadRes = await fetch(uploadURL, {
          method: "PUT",
          body: imageBuffer,
          headers: { "Content-Type": "image/png" },
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload generated image to object storage");
        }

        const objectFile = await objStorage.getObjectEntityFile(objectPath);
        await setObjectAclPolicy(objectFile, {
          owner: "admin",
          visibility: "public",
        });

        res.json({ imageUrl: objectPath, prompt });
      } catch (error: any) {
        console.error("AI image generation error:", error);
        res.status(500).json({
          message: "Failed to generate image. Please try again.",
        });
      }
    },
  );
}
