"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ImageControl } from "@/modules/forms/admin/controls";
import { api, ApiError, Card, SelectField, TextArea, TextField, Toggle, useConfirm, useCopy, useFormatters, useToast } from "@/modules/forms/admin/ui";
import { cleanSlug } from "@/modules/forms/lib/sanitize";
import { CHROME_CHOICES, PAGE_STATUSES, type LandingSettings } from "../lib/settings";
import "./landing-admin.css";

type Props = {
  pageId: number;
  title: string;
  status: string;
  slug: string;
  settings: LandingSettings;
  siteUrl: string;
  usedForms: { id: number; title: string }[];
  readOnly: boolean;
};

const NAV = [
  ["general", "General"],
  ["frame", "Frame & action"],
  ["seo", "Search & sharing"],
  ["tracking", "Statistics"],
  ["access", "When not live"],
  ["history", "Version history"],
] as const;

type Revision = { id: number; label: string; createdAt: string; blocks: number };

export function PageSettingsEditor({ pageId, title: t0, status: st0, slug: sl0, settings: s0, siteUrl, usedForms, readOnly }: Props) {
  const router = useRouter();
  const toast = useToast();
  const copy = useCopy();
  const confirm = useConfirm();
  const f = useFormatters();
  const [title, setTitle] = useState(t0);
  const [status, setStatus] = useState(st0);
  const [slug, setSlug] = useState(sl0);
  const [s, setS] = useState<LandingSettings>(s0);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState("general");
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const set = <K extends keyof LandingSettings>(k: K, v: LandingSettings[K]) => setS((cur) => ({ ...cur, [k]: v }));
  const flag = (k: keyof LandingSettings) => !!s[k];
  const setFlag = (k: keyof LandingSettings) => (v: boolean) => setS((cur) => ({ ...cur, [k]: v ? 1 : 0 }));

  useEffect(() => {
    const els = NAV.map(([id]) => document.getElementById(`sec-${id}`)).filter(Boolean) as HTMLElement[];
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((en) => en.forEach((x) => x.isIntersecting && setActive(x.target.id.replace("sec-", ""))), { rootMargin: "-30% 0px -60% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    api<{ revisions: Revision[] }>(`landing/${pageId}/revisions`)
      .then((r) => alive && setRevisions(r.revisions))
      .catch(() => alive && setRevisions([]));
    return () => {
      alive = false;
    };
  }, [pageId]);

  const save = async () => {
    setBusy(true);
    try {
      const res = await api<{ page: { slug: string } }>(`landing/${pageId}`, { method: "PUT", body: { title, status, slug: cleanSlug(slug), settings: s, label: "Settings" } });
      setSlug(res.page.slug);
      toast("Saved");
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const restore = async (id: number) => {
    if (!(await confirm("Put this version back? The current content is kept in the history.", "Restore version"))) return;
    try {
      await api(`landing/${pageId}/revisions`, { method: "POST", body: { revision: id } });
      toast("Version restored");
      router.refresh();
      const r = await api<{ revisions: Revision[] }>(`landing/${pageId}/revisions`);
      setRevisions(r.revisions);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not restore", "error");
    }
  };

  const pageUrl = `${siteUrl}/l/${cleanSlug(slug)}`;

  return (
    <div className="bbfa-settings">
      <aside className="bbfa-settings__nav">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#sec-${id}`} className={active === id ? "is-active" : ""}>
            {label}
          </a>
        ))}
        {!readOnly ? (
          <button type="button" className={`bbfa-btn${busy ? " is-loading" : ""}`} onClick={save}>
            Save settings
          </button>
        ) : null}
      </aside>
      <fieldset className="bbfa-settings__body" disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <Card id="sec-general" eyebrow="General" title="Page basics">
          <TextField label="Page name" value={title} onChange={setTitle} />
          <SelectField label="Status" value={status} onChange={setStatus} choices={Object.fromEntries(PAGE_STATUSES.map((k) => [k, k === "published" ? "Published: live at the address below" : k === "draft" ? "Draft: not public, preview only" : "Archived: not public, kept for the numbers"]))} />
          <TextField
            label="Address"
            value={slug}
            onChange={(v) => setSlug(v.toLowerCase())}
            placeholder="e.g. ai-for-busy-parents"
            help={
              <>
                The page lives at{" "}
                <button type="button" className="bbfa-tag" onClick={() => copy(pageUrl)}>
                  {pageUrl}
                </button>
                {status === "published" ? " Changing the address of a live page breaks links already shared." : ""}
              </>
            }
          />
          <TextArea label="Internal note" value={s.note} onChange={(v) => set("note", v)} rows={2} help="Only visible to staff." />
          {usedForms.length ? (
            <div className="bbfa-field bbfa-field--wide">
              <span className="bbfa-label">Forms on this page</span>
              <div className="bbfa-tags">
                {usedForms.map((x) => (
                  <a key={x.id} className="bbfa-tag" href={`/admin/forms/${x.id}/builder`}>
                    {x.title} (#{x.id})
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <Card id="sec-frame" eyebrow="Frame & action" title="Header, footer and language">
          <SelectField label="Frame" value={s.chrome} onChange={(v) => set("chrome", v as LandingSettings["chrome"])} choices={CHROME_CHOICES} />
          <SelectField label="Language of the page" value={s.lang} onChange={(v) => set("lang", v as LandingSettings["lang"])} choices={{ en: "English", bg: "Bulgarian" }} />
          <TextField label="Sticky bar button (phones)" value={s.sticky_label} onChange={(v) => set("sticky_label", v)} placeholder="Reserve My Seat" help="A bar fixed to the bottom of phone screens with one red button. Empty: off." />
          <TextField label="Sticky bar link" value={s.sticky_url} onChange={(v) => set("sticky_url", v)} placeholder="#form" help="#anchor of a block, or a full address." />
        </Card>

        <Card id="sec-seo" eyebrow="Search & sharing" title="How the page appears in results and shared links">
          <TextField label="Title" value={s.seo_title} onChange={(v) => set("seo_title", v)} placeholder={title} help="Empty uses the page name. The site name is added." />
          <TextArea label="Description" value={s.seo_description} onChange={(v) => set("seo_description", v)} rows={3} help="One or two sentences, up to ~160 characters." />
          <div className="bbfa-field bbfa-field--wide">
            <ImageControl label="Share image (1200 × 630)" value={{ id: 0, url: s.og_image }} uploadUrl="/api/admin/landing/media" onChange={(v) => set("og_image", v.url)} />
          </div>
          <div className="bbfa-field bbfa-field--wide">
            <Toggle label="Let search engines list this page" checked={flag("indexable")} onChange={setFlag("indexable")} help="Off: the page carries a noindex tag, right for ad and email traffic. The site must be launched as indexable too." />
          </div>
        </Card>

        <Card id="sec-tracking" eyebrow="Statistics" title="Views and clicks" desc="No cookies, no IP address stored, no third party. Visitors are counted from a random id kept in their browser.">
          <div className="bbfa-field bbfa-field--wide">
            <Toggle label="Count views and clicks on this page" checked={flag("track")} onChange={setFlag("track")} />
            <Toggle label="Do not count signed-in admins" checked={flag("exclude_staff")} onChange={setFlag("exclude_staff")} help="Your own visits while you are signed in stay out of the numbers." />
          </div>
        </Card>

        <Card id="sec-access" eyebrow="When not live" title="Draft and archived pages">
          <TextField label="Send visitors to" value={s.closed_redirect} onChange={(v) => set("closed_redirect", v)} placeholder="/sessions" help="A path of this site or a full address. Empty shows a 404 page." />
        </Card>

        <Card id="sec-history" eyebrow="Version history" title="Earlier versions" desc="Every save keeps a copy. The last 30 are kept.">
          {revisions === null ? (
            <p className="bbfa-muted">Loading...</p>
          ) : revisions.length ? (
            <ul className="bbfa-rev bbfa-field--wide" style={{ gridColumn: "1 / -1" }}>
              {revisions.map((r) => (
                <li key={r.id}>
                  <span>
                    <strong>{r.label || "Saved"}</strong> <em>· {r.blocks} blocks</em>
                  </span>
                  <em>{f.dateTime(r.createdAt)}</em>
                  {!readOnly ? (
                    <button type="button" className="bbfa-mini" onClick={() => void restore(r.id)}>
                      Restore
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="bbfa-muted">No saved versions yet.</p>
          )}
        </Card>

        {!readOnly ? (
          <p>
            <button type="button" className={`bbfa-btn${busy ? " is-loading" : ""}`} onClick={save}>
              Save settings
            </button>
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}

