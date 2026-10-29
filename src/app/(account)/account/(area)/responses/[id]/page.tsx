import Link from "next/link";
import { notFound } from "next/navigation";
import { accountResponse } from "@/modules/account/lib/data";
import { requireAccountUser } from "@/modules/account/lib/session";
import { fmtDateTime, PageHead } from "@/modules/account/components/ui";

export const metadata = { title: "My response" };

export default async function ResponsePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccountUser();
  const r = await accountResponse(user.id, user.email, Number((await params).id));
  if (!r) notFound();
  return (
    <>
      <p style={{ marginBottom: 16 }}>
        <Link href={`/account/responses?form=${r.formId}`} className="ac-link">
          ← All my responses
        </Link>
      </p>
      <PageHead eyebrow={r.formTitle} title="My answers" intro={`Sent on ${fmtDateTime(r.createdAt)}.`} />
      <div className="ac-panel">
        {r.answers.length ? (
          <dl style={{ margin: 0 }}>
            {r.answers.map((a) => (
              <div key={a.key} className="ac-answer">
                <dt>{a.label}</dt>
                <dd>{a.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="ac-muted" style={{ margin: 0 }}>This response has no answers.</p>
        )}
      </div>
    </>
  );
}
