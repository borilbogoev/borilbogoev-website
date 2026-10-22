"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ControlField, ImageControl, type ControlCtx, type ImageValue } from "@/modules/forms/admin/controls";
import { api, ApiError, Card, SelectField, TextArea, TextField, useCopy, useToast } from "@/modules/forms/admin/ui";
import { cleanSlug } from "@/modules/forms/lib/sanitize";
import { ACCESS_LABELS, ACCESS_MODES, COURSE_CONTROLS, COURSE_STATUSES, LANGUAGES, STATUS_LABELS, type CourseSettings } from "../lib/course-settings";
import "@/modules/landing/admin/landing-admin.css";
import "./classroom-admin.css";

type Props = {
  courseId: number;
  title: string;
  status: string;
  slug: string;
  categoryId: number | null;
  summary: string;
  image: { url?: string; width?: number; height?: number; variants?: { w: number; url: string }[] };
  language: string;
  access: string;
  price: number;
  currency: string;
  settings: CourseSettings;
  siteUrl: string;
  categories: { id: number; name: string }[];
  currencies: readonly string[];
  readOnly: boolean;
};

const NAV = [
  ["general", "General"],
  ["catalog", "Catalog card"],
  ["access", "Access and price"],
  ["details", "Details and questions"],
  ["seo", "Search and sharing"],
] as const;

const DETAIL_KEYS = new Set(["level", "duration", "outcomes", "instructor", "instructor_role", "comments"]);

export function CourseSettingsEditor(p: Props) {
  const router = useRouter();
  const toast = useToast();
  const copy = useCopy();
  const [title, setTitle] = useState(p.title);
  const [status, setStatus] = useState(p.status);
  const [slug, setSlug] = useState(p.slug);
  const [categoryId, setCategoryId] = useState(p.categoryId ? String(p.categoryId) : "");
  const [summary, setSummary] = useState(p.summary);
  const [image, setImage] = useState<ImageValue>({ id: 0, url: p.image.url ?? "", width: p.image.width, height: p.image.height, variants: p.image.variants });
  const [language, setLanguage] = useState(p.language);
  const [access, setAccess] = useState(p.access);
  const [price, setPrice] = useState(String(p.price || ""));
  const [currency, setCurrency] = useState(p.currency);
  const [s, setS] = useState<CourseSettings>(p.settings);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState("general");
  const ctx: ControlCtx = { uploadUrl: "/api/admin/classroom/media" };
  const set = (key: string, value: unknown) => setS((cur) => ({ ...cur, [key]: value }) as CourseSettings);

  useEffect(() => {
    const els = NAV.map(([id]) => document.getElementById(`sec-${id}`)).filter(Boolean) as HTMLElement[];
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((en) => en.forEach((x) => x.isIntersecting && setActive(x.target.id.replace("sec-", ""))), { rootMargin: "-30% 0px -60% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const res = await api<{ course: { slug: string } }>(`classroom/courses/${p.courseId}`, {
        method: "PUT",
        body: { title, status, slug: cleanSlug(slug), categoryId: categoryId ? Number(categoryId) : null, summary, image, language, access, price: price === "" ? 0 : Number(price), currency, settings: s },
      });
      setSlug(res.course.slug);
      toast("Saved");
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const url = `${p.siteUrl}/classroom/${cleanSlug(slug)}`;
  const detail = COURSE_CONTROLS.filter((c) => DETAIL_KEYS.has(c.key));
  const seo = COURSE_CONTROLS.filter((c) => !DETAIL_KEYS.has(c.key));

  return (
    <div className="bbfa-settings">
      <aside className="bbfa-settings__nav">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#sec-${id}`} className={active === id ? "is-active" : ""}>
            {label}
          </a>
        ))}
        {!p.readOnly ? (
          <button type="button" className={`bbfa-btn${busy ? " is-loading" : ""}`} onClick={save}>
            Save settings
          </button>
        ) : null}
      </aside>
      <fieldset className="bbfa-settings__body" disabled={p.readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <Card id="sec-general" eyebrow="General" title="Course basics">
          <TextField label="Name" value={title} onChange={setTitle} />
          <SelectField label="Status" value={status} onChange={setStatus} choices={Object.fromEntries(COURSE_STATUSES.map((k) => [k, STATUS_LABELS[k] + (k === "active" ? ": visible in the catalog, students can learn" : k === "draft" ? ": only staff see it" : k === "inactive" ? ": switched off for everyone but staff" : ": hidden, kept for the record")]))} />
          <TextField
            label="Address"
            value={slug}
            onChange={(v) => setSlug(v.toLowerCase())}
            help={
              <>
                The course lives at{" "}
                <button type="button" className="bbfa-tag" onClick={() => copy(url)}>
                  {url}
                </button>
                {status === "active" ? " Changing the address of a live course breaks links already shared." : ""}
              </>
            }
          />
          <SelectField label="Category" value={categoryId} onChange={setCategoryId} choices={{ "": "No category", ...Object.fromEntries(p.categories.map((c) => [String(c.id), c.name])) }} help="Manage categories under Categories." />
          <SelectField label="Language of the content" value={language} onChange={setLanguage} choices={LANGUAGES} help="The interface is English for now. This field prepares the multi-language upgrade." />
        </Card>

        <Card id="sec-catalog" eyebrow="Catalog card" title="How the course looks in the catalog" desc="Shown on the Classroom page, in its category and at the top of the course page.">
          <TextArea label="Short description" value={summary} onChange={setSummary} rows={3} help="One or two sentences, up to 300 characters." />
          <div className="bbfa-field bbfa-field--wide">
            <ImageControl label="Course image (16:9 works best)" value={image} uploadUrl="/api/admin/classroom/media" onChange={setImage} />
          </div>
        </Card>

        <Card id="sec-access" eyebrow="Access and price" title="Who can join, and what it costs" desc="Paid courses are paid by bank transfer. The student gets your bank details and a payment reference, and you confirm the transfer under Students.">
          <SelectField label="Who can join" wide value={access} onChange={setAccess} choices={Object.fromEntries(ACCESS_MODES.map((m) => [m, ACCESS_LABELS[m]]))} />
          {access === "paid" ? (
            <>
              <TextField label="Price" type="number" min={0} value={price} onChange={setPrice} help="In major units, such as 800." />
              <SelectField label="Currency" value={currency} onChange={setCurrency} choices={Object.fromEntries(p.currencies.map((c) => [c, c]))} />
            </>
          ) : null}
        </Card>

        <Card id="sec-details" eyebrow="Details" title="What students see on the course page">
          {detail.map((c) => (
            <div key={c.key} className={c.type === "options" ? "bbfa-field bbfa-field--wide" : "bbfa-field"}>
              <ControlField control={c} settings={s} set={set} ctx={ctx} />
            </div>
          ))}
        </Card>

        <Card id="sec-seo" eyebrow="Search and sharing" title="How the course appears in results and shared links">
          {seo.map((c) => (
            <div key={c.key} className="bbfa-field bbfa-field--wide">
              <ControlField control={c} settings={s} set={set} ctx={ctx} />
            </div>
          ))}
        </Card>

        {!p.readOnly ? (
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
