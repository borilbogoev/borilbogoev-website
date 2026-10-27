"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ImageControl } from "@/modules/forms/admin/controls";
import { api, ApiError, Card, SelectField, TextArea, TextField, Toggle, useConfirm, useCopy, useFormatters, useToast } from "@/modules/forms/admin/ui";
import { cleanSlug } from "@/modules/forms/lib/sanitize";
import { DECK_STATUSES, ORIENTATION_LABELS, STATUS_HELP, type DeckMode, type DeckOrientation, type DeckSettings } from "../lib/settings";
import "@/modules/landing/admin/landing-admin.css";
import "./presentations-admin.css";

type Props = {
  deckId: number;
  title: string;
  status: string;
  slug: string;
  mode: DeckMode;
  orientation: DeckOrientation;
  categoryId: number | null;
  tags: string[];
  hasPassword: boolean;
  settings: DeckSettings;
  siteUrl: string;
  categories: { id: number; name: string }[];
  allTags: string[];
  usedForms: { id: number; title: string }[];
  readOnly: boolean;
};

const NAV = [
  ["general", "General"],
  ["organise", "Category & tags"],
  ["presenting", "Presenting"],
  ["access", "Access"],
  ["seo", "Search & sharing"],
  ["tracking", "Statistics"],
  ["history", "Version history"],
] as const;

type Revision = { id: number; label: string; createdAt: string; slides: number };

export function DeckSettingsEditor({ deckId, title: t0, status: st0, slug: sl0, mode: m0, orientation: o0, categoryId: c0, tags: tg0, hasPassword: hp0, settings: s0, siteUrl, categories: cats0, allTags, usedForms, readOnly }: Props) {
  const router = useRouter();
  const toast = useToast();
  const copy = useCopy();
  const confirm = useConfirm();
  const f = useFormatters();
  const [title, setTitle] = useState(t0);
  const [status, setStatus] = useState(st0);
  const [slug, setSlug] = useState(sl0);
  const [mode, setMode] = useState<DeckMode>(m0);
  const [orientation, setOrientation] = useState<DeckOrientation>(o0);
  const [categoryId, setCategoryId] = useState<string>(c0 ? String(c0) : "");
  const [cats, setCats] = useState(cats0);
  const [newCat, setNewCat] = useState("");
  const [tags, setTags] = useState(tg0.join(", "));
  const [hasPassword, setHasPassword] = useState(hp0);
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [s, setS] = useState<DeckSettings>(s0);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState("general");
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const set = <K extends keyof DeckSettings>(k: K, v: DeckSettings[K]) => setS((cur) => ({ ...cur, [k]: v }));
  const flag = (k: keyof DeckSettings) => !!s[k];
  const setFlag = (k: keyof DeckSettings) => (v: boolean) => setS((cur) => ({ ...cur, [k]: v ? 1 : 0 }));

  useEffect(() => {
    const els = NAV.map(([id]) => document.getElementById(`sec-${id}`)).filter(Boolean) as HTMLElement[];
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((en) => en.forEach((x) => x.isIntersecting && setActive(x.target.id.replace("sec-", ""))), { rootMargin: "-30% 0px -60% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    api<{ revisions: Revision[] }>(`presentations/${deckId}/revisions`)
      .then((r) => alive && setRevisions(r.revisions))
      .catch(() => alive && setRevisions([]));
    return () => {
      alive = false;
    };
  }, [deckId]);

  const addCategory = async () => {
    if (!newCat.trim()) return;
    try {
      const res = await api<{ id: number; categories: { id: number; name: string }[] }>("presentations/categories", { method: "POST", body: { name: newCat } });
      setCats(res.categories);
      setCategoryId(String(res.id));
      setNewCat("");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not add the category", "error");
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = await api<{ deck: { slug: string; hasPassword: boolean; tags: string[] } }>(`presentations/${deckId}`, {
        method: "PUT",
        body: { title, status, slug: cleanSlug(slug), mode, orientation, categoryId: categoryId ? Number(categoryId) : null, tags, settings: s, password: password || undefined, clearPassword, label: "Settings" },
      });
      setSlug(res.deck.slug);
      setHasPassword(res.deck.hasPassword);
      setTags(res.deck.tags.join(", "));
      setPassword("");
      setClearPassword(false);
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
      await api(`presentations/${deckId}/revisions`, { method: "POST", body: { revision: id } });
      toast("Version restored");
      router.refresh();
      const r = await api<{ revisions: Revision[] }>(`presentations/${deckId}/revisions`);
      setRevisions(r.revisions);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not restore", "error");
    }
  };

  const deckUrl = `${siteUrl}/p/${cleanSlug(slug)}`;

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
        <Card id="sec-general" eyebrow="General" title="Presentation basics">
          <TextField label="Name" value={title} onChange={setTitle} />
          <SelectField label="Status" value={status} onChange={setStatus} choices={Object.fromEntries(DECK_STATUSES.map((k) => [k, STATUS_HELP[k]]))} />
          <TextField
            label="Address"
            value={slug}
            onChange={(v) => setSlug(v.toLowerCase())}
            placeholder="e.g. session001-3-headaches-of-parents"
            help={
              <>
                The deck lives at{" "}
                <button type="button" className="bbfa-tag" onClick={() => copy(deckUrl)}>
                  {deckUrl}
                </button>
                {status === "active" ? " Changing the address of a live deck breaks links already shared." : ""}
              </>
            }
          />
          <SelectField label="Opens as" value={mode} onChange={(v) => setMode(v as DeckMode)} choices={{ slides: "Slides: one at a time, full window", accordion: "Accordion: a long page whose sections fold open and shut" }} />
          <SelectField label="Layout" value={orientation} onChange={(v) => setOrientation(v as DeckOrientation)} choices={ORIENTATION_LABELS} />
          <TextArea label="Internal note" value={s.note} onChange={(v) => set("note", v)} rows={2} help="Only visible to staff." />
          {usedForms.length ? (
            <div className="bbfa-field bbfa-field--wide">
              <span className="bbfa-label">Forms in this deck</span>
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

        <Card id="sec-organise" eyebrow="Category & tags" title="Keep the library in order" desc="One category per presentation, any number of tags. Both filter the list.">
          <SelectField label="Category" value={categoryId} onChange={setCategoryId} choices={{ "": "No category", ...Object.fromEntries(cats.map((c) => [String(c.id), c.name])) }} />
          <div className="bbfa-field">
            <TextField label="New category" value={newCat} onChange={setNewCat} placeholder="e.g. Webinars" />
            <button type="button" className="bbfa-mini" onClick={() => void addCategory()} disabled={!newCat.trim()} style={{ marginTop: 8 }}>
              Add category
            </button>
          </div>
          <TextField label="Tags" wide value={tags} onChange={setTags} placeholder="ai, parents, webinar" help={allTags.length ? `Separate with commas. In use: ${allTags.slice(0, 12).join(", ")}${allTags.length > 12 ? "…" : ""}` : "Separate with commas."} />
        </Card>

        <Card id="sec-presenting" eyebrow="Presenting" title="How the deck looks and moves" desc="Slides fill the browser window, not the whole screen, so your other tabs and demos stay one click away.">
          <SelectField label="Theme" value={s.theme} onChange={(v) => set("theme", v as DeckSettings["theme"])} choices={{ light: "Light: white slides, dark bands for emphasis", dark: "Dark: dark slides, light bands for emphasis" }} />
          <SelectField label="Type size" value={s.scale} onChange={(v) => set("scale", v as DeckSettings["scale"])} choices={{ standard: "Standard: compact type", large: "Large: big headings and cards, as in the brand slides" }} />
          <SelectField label="Transition" value={s.transition} onChange={(v) => set("transition", v as DeckSettings["transition"])} choices={{ fade: "Fade", slide: "Slide sideways", none: "None" }} />
          <SelectField label="Footer" value={s.footer} onChange={(v) => set("footer", v as DeckSettings["footer"])} choices={{ brand: "The B* mark and the slide number", minimal: "The slide number only", none: "Nothing" }} />
          <SelectField label="Language" value={s.lang} onChange={(v) => set("lang", v as DeckSettings["lang"])} choices={{ en: "English", bg: "Bulgarian" }} />
          <TextField label="Accordion subtitle" wide value={s.subtitle} onChange={(v) => set("subtitle", v)} placeholder="Open a section to read it." help="A light line under the title in accordion mode and on the password screen." />
          <TextField label="Auto-advance (seconds, 0 = off)" type="number" value={s.autoplay} onChange={(v) => set("autoplay", Number(v) || 0)} min={0} max={300} />
          <div className="bbfa-field bbfa-field--wide">
            <Toggle label="Progress line" checked={flag("progress")} onChange={setFlag("progress")} help="A thin red line along the bottom edge." />
            <Toggle label="Slide counter" checked={flag("counter")} onChange={setFlag("counter")} />
            <Toggle label="Previous and next buttons" checked={flag("arrows")} onChange={setFlag("arrows")} />
            <Toggle label="Contents button" checked={flag("outline")} onChange={setFlag("outline")} />
            <Toggle label="Viewers can switch between Slides and Accordion" checked={flag("allow_switch")} onChange={setFlag("allow_switch")} help="Adds a button and the M key. A link can also open a mode with ?mode=accordion." />
            <Toggle label="Accordion: several sections may stay open" checked={flag("accordion_multi")} onChange={setFlag("accordion_multi")} />
            <Toggle label="Start again after the last slide" checked={flag("loop")} onChange={setFlag("loop")} />
          </div>
        </Card>

        <Card id="sec-access" eyebrow="Access" title="Who can open it" desc="Active decks are open to anyone with the link, unless you set a password.">
          <div className="bbfa-field bbfa-field--wide">
            <TextField
              label={hasPassword && !clearPassword ? "Change the password" : "Password"}
              type="password"
              value={password}
              onChange={(v) => {
                setPassword(v);
                if (v) setClearPassword(false);
              }}
              placeholder={hasPassword && !clearPassword ? "Leave empty to keep the current one" : "At least 4 characters"}
              help={
                hasPassword && !clearPassword ? (
                  <>
                    This deck is password protected. The slides are not in the page until the right password is entered.{" "}
                    <button type="button" className="bbfa-tag" onClick={() => (setClearPassword(true), setPassword(""))}>
                      Remove the password
                    </button>
                  </>
                ) : clearPassword ? (
                  "The password will be removed when you save."
                ) : (
                  "Viewers see a lock screen first. Share the password separately from the link. A new password signs everyone out."
                )
              }
            />
          </div>
          <TextField label="Message while inactive" wide value={s.closed_message} onChange={(v) => set("closed_message", v)} placeholder="This presentation is switched off. Ask the sender for a new link." help="Shown at the link when the status is Inactive." />
          <TextField label="Send visitors to (draft and archived)" value={s.closed_redirect} onChange={(v) => set("closed_redirect", v)} placeholder="/sessions" help="A path of this site or a full address. Empty shows a 404 page." />
        </Card>

        <Card id="sec-seo" eyebrow="Search & sharing" title="How the deck appears in results and shared links">
          <TextField label="Title" value={s.seo_title} onChange={(v) => set("seo_title", v)} placeholder={title} help="Empty uses the name. The site name is added." />
          <TextArea label="Description" value={s.seo_description} onChange={(v) => set("seo_description", v)} rows={3} help="One or two sentences, up to ~160 characters." />
          <div className="bbfa-field bbfa-field--wide">
            <ImageControl label="Share image (1200 × 630)" value={{ id: 0, url: s.og_image }} uploadUrl="/api/admin/presentations/media" onChange={(v) => set("og_image", v.url)} />
          </div>
          <div className="bbfa-field bbfa-field--wide">
            <Toggle label="Let search engines list this deck" checked={flag("indexable")} onChange={setFlag("indexable")} help="Off: the deck carries a noindex tag, right for client and event links. Password-protected decks are never listed. The site must be launched as indexable too." />
          </div>
        </Card>

        <Card id="sec-tracking" eyebrow="Statistics" title="Openings, reach and time" desc="No cookies, no IP address stored, no third party. Viewers are counted from a random id kept in their browser.">
          <div className="bbfa-field bbfa-field--wide">
            <Toggle label="Count openings, furthest slide and time" checked={flag("track")} onChange={setFlag("track")} />
            <Toggle label="Do not count signed-in admins" checked={flag("exclude_staff")} onChange={setFlag("exclude_staff")} help="Your own views while you are signed in stay out of the numbers. The Present view is never counted." />
          </div>
        </Card>

        <Card id="sec-history" eyebrow="Version history" title="Earlier versions" desc="Every save keeps a copy. The last 30 are kept.">
          {revisions === null ? (
            <p className="bbfa-muted">Loading...</p>
          ) : revisions.length ? (
            <ul className="bbfa-rev bbfa-field--wide" style={{ gridColumn: "1 / -1" }}>
              {revisions.map((r) => (
                <li key={r.id}>
                  <span>
                    <strong>{r.label || "Saved"}</strong> <em>· {r.slides} slides</em>
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
