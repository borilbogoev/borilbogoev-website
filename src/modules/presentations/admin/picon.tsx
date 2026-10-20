"use client";

// Outline icons for the slide layouts and elements that the shared admin icon set does not have. Same grid and stroke.
import type { ReactNode } from "react";
import { Icon } from "@/modules/forms/admin/ui";

const PATHS: Record<string, ReactNode> = {
  cover: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M7 11h7M7 14.5h4" />
      <path d="M17 8.5v.01" />
    </>
  ),
  section: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M7 10h3M7 14h10" />
    </>
  ),
  agenda: (
    <>
      <path d="M9 7h11M9 12h11M9 17h11" />
      <path d="M4 6.5h2v2M4 11.5h2.2L4 14h2.4M4 16.5h2.3v1.2H4.8h1.5v1.3H4" opacity=".0" />
      <circle cx="5" cy="7" r="1" />
      <circle cx="5" cy="12" r="1" />
      <circle cx="5" cy="17" r="1" />
    </>
  ),
  statement: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M7 10h10M7 14h6" />
    </>
  ),
  columns: (
    <>
      <rect x="3" y="4" width="8" height="16" rx="2" />
      <rect x="13" y="4" width="8" height="16" rx="2" />
    </>
  ),
  imagefull: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
      <circle cx="16.5" cy="8.5" r="1.5" />
    </>
  ),
  imagetext: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M7 9h4M7 12.5h4M7 16h3M14 8.5h4v7h-4z" />
    </>
  ),
  demo: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M9 20h6M12 17v3M10.5 8.5v4l3.5-2z" />
    </>
  ),
  closing: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.5" />
    </>
  ),
  questions: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01" />
    </>
  ),
  blank: <rect x="3" y="4" width="18" height="16" rx="2.5" strokeDasharray="3 3" />,
  code: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M3 14.5h18M9 4v16" />
    </>
  ),
  slides: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  rows: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1.5" />
      <rect x="3" y="11" width="18" height="5" rx="1.5" />
      <path d="M3 19h18" />
    </>
  ),
  present: <path d="M7 4.5v15l12-7.5z" />,
  portrait: <rect x="7" y="3" width="10" height="18" rx="2" />,
  landscape: <rect x="3" y="7" width="18" height="10" rx="2" />,
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
};

export function PIcon({ name }: { name: string }) {
  if (!PATHS[name]) return <Icon name={name} />;
  return (
    <svg className="bbfa-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
