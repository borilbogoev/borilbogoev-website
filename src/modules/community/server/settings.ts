import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { db } from "./core";

const { communitySettings } = schema;

export type CommunitySettings = {
  postingPaused: boolean;
  maxImagesPerPost: number;
  maxImageMb: number;
  ratePostPerHour: number;
  rateCommentPerHour: number;
  rateMessagePerMinute: number;
  updatedBy: string | null;
  updatedAt: Date | null;
};

export const SETTINGS_DEFAULTS: CommunitySettings = { postingPaused: false, maxImagesPerPost: 4, maxImageMb: 8, ratePostPerHour: 10, rateCommentPerHour: 60, rateMessagePerMinute: 20, updatedBy: null, updatedAt: null };

const TTL_MS = 30_000;
let cached: { at: number; value: CommunitySettings } | null = null;

/** The settings row, read through a 30 second cache. Falls back to defaults if the row is missing. */
export async function getSettings(): Promise<CommunitySettings> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const [row] = await db().select().from(communitySettings).where(eq(communitySettings.id, 1)).limit(1);
  const value: CommunitySettings = row
    ? { postingPaused: row.postingPaused, maxImagesPerPost: row.maxImagesPerPost, maxImageMb: row.maxImageMb, ratePostPerHour: row.ratePostPerHour, rateCommentPerHour: row.rateCommentPerHour, rateMessagePerMinute: row.rateMessagePerMinute, updatedBy: row.updatedBy, updatedAt: row.updatedAt }
    : SETTINGS_DEFAULTS;
  cached = { at: Date.now(), value };
  return value;
}

export function clearSettingsCache() {
  cached = null;
}
