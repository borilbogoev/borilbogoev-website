// The server-rendered top of a module and of a lesson: shared by the public pages and the staff preview.
import type { LessonMeta, ModuleNode } from "../lib/courses";
import { Cover } from "./catalog";
import { LessonBody, ModuleLessons } from "./player";

export function ModuleArticle({ module: m, index, total }: { module: ModuleNode; index: number; total: number }) {
  return (
    <article className="cr-article">
      <header className="cr-module-head">
        <p className="cr-eyebrow">
          Module {index + 1} of {total}
        </p>
        <h1>
          {m.title.replace(/\.$/, "")}
          <span className="cr-dot">.</span>
        </h1>
        {m.summary ? <p className="cr-sub cr-sub--lg">{m.summary}</p> : null}
        {m.image.url ? <Cover img={m.image} alt="" ratio="21 / 9" priority sizes="(min-width: 1100px) 760px, 100vw" /> : null}
      </header>
      <ModuleLessons moduleSlug={m.slug} />
    </article>
  );
}

export function LessonArticle({ moduleTitle, lesson: l }: { moduleTitle: string; lesson: LessonMeta }) {
  return (
    <article className="cr-article">
      <header className="cr-lesson-head">
        <p className="cr-eyebrow">
          {moduleTitle}
          {l.minutes ? ` · ${l.minutes} min` : ""}
        </p>
        <h1>
          {l.title.replace(/\.$/, "")}
          <span className="cr-dot">.</span>
        </h1>
        {l.summary ? <p className="cr-sub cr-sub--lg">{l.summary}</p> : null}
        {l.image.url ? <Cover img={l.image} alt="" ratio="21 / 9" priority sizes="(min-width: 1100px) 760px, 100vw" /> : null}
      </header>
      <LessonBody />
    </article>
  );
}
