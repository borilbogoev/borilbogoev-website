import Link from "next/link";
import { tokenize } from "../lib/text";
import type { People } from "../lib/client";

/**
 * Renders a stored body as plain text: line breaks kept, links opened safely, mentions linked to profiles.
 * Everything is a React text node, so user text can never become HTML.
 * The name shown is the person's current name; the name inside the token is the fallback.
 */
export function MentionText({ body, people }: { body: string; people?: People }) {
  return (
    <p className="cm-text">
      {tokenize(body).map((s, i) => {
        if (s.kind === "text") return <span key={i}>{s.text}</span>;
        if (s.kind === "link")
          return (
            <a key={i} href={s.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="cm-link">
              {s.text}
            </a>
          );
        const who = people?.[s.userId];
        return (
          <Link key={i} href={`/community/u/${s.userId}`} className="cm-mention">
            @{who?.name || s.name}
          </Link>
        );
      })}
    </p>
  );
}
