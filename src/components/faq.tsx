import type { Faq as FaqItem } from "@/content/types";

/** Native <details>: works without JavaScript, and every answer is in the HTML for search engines and AI. */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="faq max-w-[760px]">
      {items.map((item) => (
        <details key={item.q}>
          <summary>{item.q}</summary>
          <p className="faq-a t-body-lg">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
