import sharp from "sharp";
import { api, ok } from "@/modules/community/server/api";
import { invalid } from "@/modules/community/server/core";
import { canManageCommunities } from "@/modules/community/server/permissions";
import { unwrap } from "@/modules/community/server/posts";
import { MEDIA_ROUTE, putFile, storageConfigured } from "@/modules/forms/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

// Community icon (square) and cover (wide). SuperAdmin only.
export async function POST(request: Request) {
  return api(request, async (viewer) => {
    unwrap(canManageCommunities(viewer.actor));
    const data = await request.formData().catch(() => null);
    const file = data?.get("file");
    const kind = data?.get("kind") === "icon" ? "icon" : "cover";
    if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw invalid("Choose a JPG, PNG or WebP picture.");
    if (file.size > 8 * 1024 * 1024) throw invalid("The picture is larger than 8 MB.");
    let webp: Buffer;
    try {
      const img = sharp(Buffer.from(await file.arrayBuffer())).rotate();
      webp = await (kind === "icon" ? img.resize(256, 256, { fit: "cover" }) : img.resize({ width: 1600, withoutEnlargement: true })).webp({ quality: 82 }).toBuffer();
    } catch {
      throw invalid("The picture could not be read. Try another file.");
    }
    if (!storageConfigured()) return ok({ url: `data:image/webp;base64,${webp.toString("base64")}` });
    const saved = await putFile(`images/community/${kind}.webp`, webp, "image/webp");
    return ok({ url: `${MEDIA_ROUTE}${saved.pathname}` });
  }, { membership: false });
}
