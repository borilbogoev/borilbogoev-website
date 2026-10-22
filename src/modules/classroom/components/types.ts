import type { CommentView } from "../lib/learn";
import type { PlayerBlock } from "./blocks";

export type OutlineLesson = { id: number; slug: string; title: string; summary: string; minutes: number; preview: boolean; draft?: boolean };
export type OutlineModule = { id: number; slug: string; title: string; summary: string; lessons: OutlineLesson[] };
export type ShellCourse = {
  id: number;
  slug: string;
  title: string;
  access: "open" | "paid" | "invite";
  priceLabel: string;
  comments: boolean;
  /** Where the course lives: /classroom/<slug>, or the staff preview under /admin/preview/classroom/<slug>. */
  base: string;
  /** Staff preview: drafts are listed, nothing is recorded as progress, and the way back is the builder. */
  preview?: boolean;
};

export type BankDetails = { beneficiary: string; bank: string; iban: string; swift: string; instructions: string };

export type CourseStateData = {
  loaded: boolean;
  signedIn: boolean;
  user?: { name: string; email: string; role: string; student: boolean };
  staff: boolean;
  moderator: boolean;
  enrolment: { status: "pending" | "active" | "revoked"; reference: string | null } | null;
  completed: number[];
  lastLessonId: number | null;
  bank: BankDetails | null;
};

export type LessonData =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "denied"; reason: string; message: string }
  | { status: "error"; message: string }
  | { status: "ok"; reason: string; blocks: PlayerBlock[]; state: Record<number, Record<string, unknown>>; note: { body: string; updatedAt: string | null } | null; comments: CommentView[] | null; results: Record<number, number[]> };
