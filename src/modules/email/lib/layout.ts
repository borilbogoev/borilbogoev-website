// The frame of every email that is not a Forms email: brand colours, one eyebrow, one button. Inline styles only (mail clients).
import { site } from "@/content/site";
import { escapeHtml } from "@/modules/forms/lib/markdown";

export { escapeHtml };

const RED = "#C72C2C";

export function emailShell(opts: { eyebrow: string; bodyHtml: string; cta?: { label: string; url: string } }): string {
  const cta = opts.cta
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;background:${RED};color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:14px">${escapeHtml(opts.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1a1a"><div style="max-width:600px;margin:0 auto;padding:32px 16px"><div style="background:#fff;border:1px solid #ececec;border-radius:18px;padding:32px"><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${RED};font-weight:700;margin-bottom:8px">${escapeHtml(opts.eyebrow)}</div><div style="font-size:15px;line-height:1.6">${opts.bodyHtml}</div>${cta}</div><div style="text-align:center;font-size:12px;color:#9a9a9a;margin-top:16px">${escapeHtml(site.name)}</div></div></body></html>`;
}
