"use client";

import { formPath } from "../lib/paths";
import { CopyCode } from "./ui";

type Props = { formId: number; slug: string; siteUrl: string; landingPages?: { id: number; title: string; slug: string }[]; presentations?: { id: number; title: string; slug: string }[] };

export function SharePanel({ formId, slug, siteUrl, landingPages = [], presentations = [] }: Props) {
  const page = slug ? `${siteUrl}${formPath(slug)}` : "";
  const codes: [string, string, string][] = [
    ["Form page", page || "Set a page address in Settings > General to give this form its own page.", page],
    ["Inline: the form sits in the page", `<FormEmbed id={${formId}} />`, `<FormEmbed id={${formId}} />`],
    ["Modal: a button opens the form", `<FormEmbed id={${formId}} display="modal" label="Join the webinar" />`, `<FormEmbed id={${formId}} display="modal" label="Join the webinar" />`],
    ["Dark theme override", `<FormEmbed id={${formId}} theme="dark" />`, `<FormEmbed id={${formId}} theme="dark" />`],
    ["Conversational override", `<FormEmbed id={${formId}} layout="conversational" />`, `<FormEmbed id={${formId}} layout="conversational" />`],
    ["Import (once per file)", `import { FormEmbed } from "@/modules/forms";`, `import { FormEmbed } from "@/modules/forms";`],
    ["Prefill hidden fields via URL", `${siteUrl}/your-page/?utm_source=linkedin&utm_campaign=launch`, `${siteUrl}/your-page/?utm_source=linkedin&utm_campaign=launch`],
  ];
  return (
    <div className="bbfa-section">
      <div className="bbfa-share">
        {codes.map(([label, shown, copy]) => (
          <div className="bbfa-card" key={label}>
            <div className="bbfa-eyebrow">{label}</div>
            {copy ? (
              <CopyCode text={copy} large>
                {shown}
              </CopyCode>
            ) : (
              <p className="bbfa-muted">{shown}</p>
            )}
          </div>
        ))}
        <div className="bbfa-card">
          <div className="bbfa-eyebrow">Landing pages</div>
          {landingPages.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {landingPages.map((p) => (
                <li key={p.id}>
                  <a href={`/admin/landing/${p.id}/builder`}>{p.title}</a> <span className="bbfa-muted">/l/{p.slug}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bbfa-muted">No landing page embeds this form yet. Add a Form block in the Landing pages builder.</p>
          )}
        </div>
        <div className="bbfa-card">
          <div className="bbfa-eyebrow">Presentations</div>
          {presentations.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {presentations.map((p) => (
                <li key={p.id}>
                  <a href={`/admin/presentations/${p.id}/builder`}>{p.title}</a> <span className="bbfa-muted">/p/{p.slug}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bbfa-muted">No presentation embeds this form yet. Add a Form element to a slide in the Presentations builder.</p>
          )}
        </div>
        <div className="bbfa-card">
          <div className="bbfa-eyebrow">Where it goes</div>
          <p>
            Add the line to any page file under <code>src/app</code>, at the spot where the form should appear. The form loads when it comes into view, so it never slows the page down.
          </p>
        </div>
        <div className="bbfa-card">
          <div className="bbfa-eyebrow">Preview</div>
          <p>
            <a className="bbfa-btn" target="_blank" rel="noopener noreferrer" href={`/admin/forms/${formId}/preview`}>
              Open preview ↗
            </a>
          </p>
          <small>Drafts show here before they go live. Submissions in the preview are saved as real responses.</small>
        </div>
      </div>
    </div>
  );
}
