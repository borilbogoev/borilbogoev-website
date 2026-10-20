import { guarded, json } from "@/modules/auth/guard";
import { storageConfigured } from "@/modules/forms/lib/storage";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, storeImage } from "@/modules/landing/lib/images";

export const runtime = "nodejs";
export const maxDuration = 60;

// Picture upload for the image controls of the presentation builder: resized and stored as WebP (the Landing Pages pipeline).
export async function POST(request: Request) {
  return guarded(request, "presentations.write", async () => {
    if (!storageConfigured()) return json({ error: "File storage is not set up yet. Paste an image address instead." }, 503);
    const data = await request.formData().catch(() => null);
    const file = data?.get("file");
    if (!(file instanceof File) || !IMAGE_TYPES.includes(file.type)) return json({ error: "Choose a JPG, PNG, WebP or GIF image." }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return json({ error: "The image is larger than 12 MB." }, 400);
    try {
      return json(await storeImage(file), 201);
    } catch (error) {
      console.error("[presentations] image failed", error instanceof Error ? error.message : error);
      return json({ error: "The image could not be processed. Try another file." }, 422);
    }
  });
}
