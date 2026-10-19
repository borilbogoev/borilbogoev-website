import { guarded, json } from "@/modules/auth/guard";
import { MEDIA_ROUTE, putFile, storageConfigured } from "@/modules/forms/lib/storage";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAX_BYTES = 5 * 1024 * 1024;

// Picture upload for the Image block of the builder.
export async function POST(request: Request) {
  return guarded(request, "forms.write", async () => {
    if (!storageConfigured()) return json({ error: "File storage is not set up yet. Paste an image address instead." }, 503);
    const data = await request.formData().catch(() => null);
    const file = data?.get("file");
    if (!(file instanceof File) || !TYPES[file.type]) return json({ error: "Choose a JPG, PNG, WebP or GIF image." }, 400);
    if (file.size > MAX_BYTES) return json({ error: "The image is larger than 5 MB." }, 400);
    const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-]+/g, "-").slice(0, 60) || "image";
    const saved = await putFile(`images/${base}.${TYPES[file.type]}`, file, file.type);
    return json({ url: `${MEDIA_ROUTE}${saved.pathname}` }, 201);
  });
}
