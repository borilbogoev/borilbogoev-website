import type { Block } from "./blocks";

/** What the browser needs to show one form. Never contains notification, webhook or other private settings. */
export type PublicForm = {
  id: number;
  title: string;
  /** open: show the form. closed and login: show only `notice` (already safe HTML). */
  state: "open" | "closed" | "login" | "done";
  notice?: string;
  draft: boolean;
  mode: "classic" | "conversational";
  theme: "light" | "dark";
  accent: string;
  textColor: string;
  radius: number;
  fontFamily: "inter" | "inherit" | "system";
  maxWidth: number;
  progress: boolean;
  pageNumbers: boolean;
  oneOnly: boolean;
  track: boolean;
  labels: { submit: string; next: string; prev: string; required: string };
  blocks: Block[];
  token: string;
};

export type SubmitResult =
  | { ok: true; redirect: string; message: string }
  | { ok: false; message?: string; errors?: Record<string, string> };
