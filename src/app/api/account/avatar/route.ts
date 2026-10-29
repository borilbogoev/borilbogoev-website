import sharp from "sharp";
import { guarded, json } from "@/modules/auth/guard";
import { getProfile, setAvatar } from "@/modules/account/lib/profile";
import { deleteFiles, MEDIA_ROUTE, putFile, storageConfigured } from "@/modules/forms/lib/storage";
import { IMAGE_TYPES } from "@/modules/landing/lib/images";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

/** The old picture's blob path, when it lives in our store. */
const blobPath = (url: string) => (url.startsWith(MEDIA_ROUTE) ? url.slice(MEDIA_ROUTE.length) : "");

// A person's own picture: square, 256 px, WebP. Any signed-in user may change their own; nobody else's.
export async function POST(request: Request) {
  return guarded(request, undefined, async (user) => {
    const data = await request.formData().catch(() => null);
    const file = data?.get("file");
    if (!(file instanceof File) || !IMAGE_TYPES.includes(file.type) || file.type === "image/gif") return json({ error: "Choose a JPG, PNG or WebP picture." }, 400);
    if (file.size > MAX_BYTES) return json({ error: "The picture is larger than 8 MB." }, 400);
    let webp: Buffer;
    try {
      webp = await sharp(Buffer.from(await file.arrayBuffer())).rotate().resize(256, 256, { fit: "cover", position: "attention" }).webp({ quality: 82 }).toBuffer();
    } catch {
      return json({ error: "The picture could not be read. Try another file." }, 422);
    }
    const before = (await getProfile(user.id))?.avatarUrl ?? "";
    let url: string;
    if (storageConfigured()) {
      const saved = await putFile(`images/avatars/${user.id.slice(0, 8)}.webp`, webp, "image/webp");
      url = `${MEDIA_ROUTE}${saved.pathname}`;
    } else {
      url = `data:image/webp;base64,${webp.toString("base64")}`; // local testing without file storage
    }
    await setAvatar(user.id, url);
    if (blobPath(before)) await deleteFiles([blobPath(before)]);
    return json({ url }, 200);
  });
}

export async function DELETE(request: Request) {
  return guarded(request, undefined, async (user) => {
    const before = (await getProfile(user.id))?.avatarUrl ?? "";
    await setAvatar(user.id, null);
    if (blobPath(before)) await deleteFiles([blobPath(before)]);
    return json({ ok: true }, 200);
  });
}
