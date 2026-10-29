import Link from "next/link";
import { accountForms, accountResponsesOf } from "@/modules/account/lib/data";
import { requireAccountUser } from "@/modules/account/lib/session";
import { Empty, fmtDateTime, PageHead, Row } from "@/modules/account/components/ui";

export const metadata = { title: "My Responses" };

export default async function ResponsesPage({ searchParams }: { searchParams: Promise<{ form?: string }> }) {
  const user = await requireAccountUser();
  const forms = await accountForms(user.id, user.email);
  const open = Number((await searchParams).form);
  const lists = await Promise.all(forms.map(async (f) => ({ f, items: await accountResponsesOf(user.id, user.email, f.formId) })));
  const shown = Number.isInteger(open) && open > 0 && lists.some((l) => l.f.formId === open) ? lists.filter((l) => l.f.formId === open) : lists;
  return (
    <>
      <PageHead eyebrow="Forms" title="My responses" intro="Every form you filled in with your email address, and each answer you gave." />
      {shown.length ? (
        shown.map(({ f, items }) => (
          <section key={f.formId} className="ac-section" style={{ marginTop: 0, marginBottom: 36 }}>
            <div className="ac-section__head">
              <div>
                <p className="eyebrow">Form</p>
                <h2>{f.title}</h2>
              </div>
              {f.href ? (
                <Link href={f.href} className="ac-link">
                  Open the form →
                </Link>
              ) : null}
            </div>
            <ul className="ac-list">
              {items.map((r, i) => (
                <Row
                  key={r.id}
                  action={
                    <Link href={`/account/responses/${r.id}`} className="bb-btn bb-btn-outline ac-btn-sm">
                      View answers
                    </Link>
                  }
                >
                  <h3>{items.length > 1 ? `Response ${items.length - i}` : "My response"}</h3>
                  <p>{fmtDateTime(r.createdAt)}</p>
                </Row>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <Empty title="No responses yet" text="Forms you fill in with your email address show up here." />
      )}
      {Number.isInteger(open) && open > 0 && shown.length < lists.length ? (
        <Link href="/account/responses" className="ac-link">
          Show every form →
        </Link>
      ) : null}
    </>
  );
}
