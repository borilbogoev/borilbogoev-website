// Course-level settings stored in classroom_courses.settings, and the small enums around a course. Pure.
import { sanitizeFor, type Control, type Settings } from "@/modules/forms/lib/blocks";

export const COURSE_STATUSES = ["draft", "active", "inactive", "archived"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];
export const STATUS_LABELS: Record<CourseStatus, string> = { draft: "Draft", active: "Active", inactive: "Inactive", archived: "Archived" };
export const cleanStatus = (v: unknown): CourseStatus | null => ((COURSE_STATUSES as readonly string[]).includes(String(v)) ? (v as CourseStatus) : null);

export const ACCESS_MODES = ["open", "paid", "invite"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];
export const ACCESS_LABELS: Record<AccessMode, string> = {
  open: "Free: any student can enrol",
  paid: "Paid: bank transfer, confirmed by an admin",
  invite: "Invitation only: an admin enrols each student",
};
export const cleanAccess = (v: unknown): AccessMode => ((ACCESS_MODES as readonly string[]).includes(String(v)) ? (v as AccessMode) : "open");

export const LEVELS = { "": "Not set", beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as const;

/** Languages of course content. The interface is English only; this field is the seam for a multi-language upgrade. */
export const LANGUAGES: Record<string, string> = { en: "English", bg: "Bulgarian" };
export const cleanLanguage = (v: unknown) => (Object.prototype.hasOwnProperty.call(LANGUAGES, String(v)) ? String(v) : "en");

const text = (key: string, label: string, def = "", help?: string): Control => ({ key, type: "text", label, default: def, help });
const toggle = (key: string, label: string, def = 0, help?: string): Control => ({ key, type: "toggle", label, default: def, help });
const image = (key: string, label: string): Control => ({ key, type: "image", label, default: { id: 0, url: "" } });

export const COURSE_CONTROLS: Control[] = [
  { key: "level", type: "select", label: "Level", default: "", choices: { ...LEVELS } },
  text("duration", "Time to complete", "", "For example: 4 hours, 6 weeks."),
  { key: "outcomes", type: "options", label: "What students will learn", default: [] },
  text("instructor", "Instructor", "Boril Bogoev, Ph.D."),
  text("instructor_role", "Instructor role line", "Head of AI and Automation"),
  toggle("comments", "Students can ask questions under each lesson", 1),
  text("seo_title", "Search title", "", "Leave empty to use the course title."),
  text("seo_description", "Search description", "", "Leave empty to use the short description."),
  image("og_image", "Share image (optional)"),
  toggle("indexable", "Let search engines list this course", 1),
];

export type CourseSettings = {
  level: keyof typeof LEVELS;
  duration: string;
  outcomes: string[];
  instructor: string;
  instructor_role: string;
  comments: number;
  seo_title: string;
  seo_description: string;
  og_image: { url?: string; width?: number; height?: number; variants?: { w: number; url: string }[] };
  indexable: number;
};

export function sanitizeCourseSettings(input: unknown, base?: Settings): CourseSettings {
  const merged = { ...(base ?? {}), ...(input && typeof input === "object" ? (input as Settings) : {}) };
  return sanitizeFor(COURSE_CONTROLS, merged) as CourseSettings;
}

/** Price in the course currency, such as "AED 800". Zero or free courses show "Free". */
export function formatPrice(cents: number, currency: string): string {
  if (!cents) return "Free";
  const amount = cents / 100;
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export type Img = { id?: number; url?: string; width?: number; height?: number; variants?: { w: number; url: string }[] };

export function cleanImage(v: unknown): Img {
  return sanitizeFor([image("image", "Image")], { image: v }).image as Img;
}
