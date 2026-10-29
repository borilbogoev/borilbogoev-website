// Post images. The server re-encodes every upload (this also drops EXIF, GPS included) and chooses the storage key.
import { randomBytes } from "node:crypto";
import sharp, { type OutputInfo } from "sharp";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { schema } from "@/db";
import { deleteFiles, MEDIA_ROUTE, putFile, storageConfigured } from "@/modules/forms/lib/storage";
import { CommunityError, db, invalid } from "./core";
import { communityState, memberState, type Scope } from "./context";
import { canPost } from "./permissions";
import { unwrap, type MediaDTO } from "./posts";

const { communityPostMedia: M } = schema;

const ALLOWED = new Set(["jpeg", "png", "webp", "gif"]);
const MAX_PENDING = 12; // images uploaded but not yet in a post
const MAX_PER_HOUR = 40;
const MAX_SIDE = 2000;

export async function saveImage(scope: Scope, file: File, alt: string): Promise<MediaDTO> {
  const { viewer, settings } = scope;
  unwrap(canPost(viewer.actor, memberState(scope.membership), communityState(scope.community), settings));
  const maxBytes = settings.maxImageMb * 1024 * 1024;
  if (file.size > maxBytes) throw invalid(`Each image can be up to ${settings.maxImageMb} MB.`);
  if (file.size === 0) throw invalid("That file is empty.");

  const hour = new Date(Date.now() - 3_600_000);
  const [counts] = await db()
    .select({ pending: sql<number>`count(*) filter (where ${M.postId} is null)::int`, recent: sql<number>`count(*) filter (where ${M.createdAt} > ${hour})::int` })
    .from(M)
    .where(eq(M.uploaderId, viewer.user.id));
  if (!viewer.actor.superAdmin && ((counts?.pending ?? 0) >= MAX_PENDING || (counts?.recent ?? 0) >= MAX_PER_HOUR)) throw new CommunityError(429, "You are uploading too fast. Try again later.", { retryAfter: 600 });

  const input = Buffer.from(await file.arrayBuffer());
  let format: string | undefined;
  try {
    format = (await sharp(input, { animated: true }).metadata()).format; // by content, not by file name or declared type
  } catch {
    throw invalid("Use a JPG, PNG, WebP or GIF image.");
  }
  if (!format || !ALLOWED.has(format)) throw invalid("Use a JPG, PNG, WebP or GIF image.");

  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(input, { animated: format === "gif", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw invalid("The image could not be read. Try another file.");
  }
  const key = `images/community/${viewer.user.id.slice(0, 8)}-${randomBytes(8).toString("hex")}.webp`;
  let url: string;
  let storageKey = key;
  if (storageConfigured()) {
    const saved = await putFile(key, out.data, "image/webp");
    storageKey = saved.pathname;
    url = `${MEDIA_ROUTE}${saved.pathname}`;
  } else {
    url = `data:image/webp;base64,${out.data.toString("base64")}`; // local testing without file storage
  }
  const [row] = await db()
    .insert(M)
    .values({ uploaderId: viewer.user.id, url, storageKey, mimeType: "image/webp", width: out.info.width, height: out.info.pageHeight ?? out.info.height, sizeBytes: out.info.size, alt: alt.trim().slice(0, 300) || null, createdAt: new Date() })
    .returning();
  return { id: row.id, url: row.url, width: row.width, height: row.height, alt: row.alt ?? "" };
}

/** Removes an unattached upload of the caller's, file and row. */
export async function discardImage(userId: string, id: number) {
  const [row] = await db().delete(M).where(and(eq(M.id, id), eq(M.uploaderId, userId), isNull(M.postId))).returning();
  if (row && row.storageKey.startsWith("images/")) await deleteFiles([row.storageKey]);
}

/** Housekeeping: pending uploads older than a day. Safe to call from a cron later. */
export async function purgeOrphanImages() {
  const cutoff = new Date(Date.now() - 86_400_000);
  const rows = await db().delete(M).where(and(isNull(M.postId), lt(M.createdAt, cutoff))).returning({ key: M.storageKey });
  await deleteFiles(rows.map((r) => r.key).filter((k) => k.startsWith("images/")));
}
