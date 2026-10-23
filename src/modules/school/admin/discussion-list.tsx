"use client";

import Link from "next/link";
import { useFormatters } from "@/modules/forms/admin/ui";
import "@/modules/landing/admin/landing-admin.css";
import "./school-admin.css";

export type QuestionRow = { id: number; lessonTitle: string; courseTitle: string; href: string; author: string; body: string; visibility: string; resolved: boolean; hidden: boolean; answered: boolean; createdAt: string };
export type AnswerRow = { blockId: number; lessonTitle: string; courseTitle: string; href: string; prompt: string; answer: string; author: string; updatedAt: string };

export function DiscussionList({ questions, answers }: { questions: QuestionRow[]; answers: AnswerRow[] }) {
  const f = useFormatters();
  return (
    <div>
      <div className="bbfa-section__head">
        <div>
          <div className="bbfa-eyebrow">Questions</div>
          <h2>Under the lessons</h2>
        </div>
      </div>
      {questions.length ? (
        <ul className="bbc-inbox">
          {questions.map((q) => (
            <li key={q.id} className={!q.answered && !q.resolved ? "is-open" : ""}>
              <div className="bbfa-sub">
                <strong>{q.author}</strong> · {q.courseTitle} · {q.lessonTitle} · {f.ago(q.createdAt)}
                {q.visibility === "instructor" ? " · only the instructor" : ""}
                {q.hidden ? " · hidden" : ""}
              </div>
              <blockquote>{q.body}</blockquote>
              <small>
                {q.resolved ? "Marked answered" : q.answered ? "An instructor replied" : "Waiting for an answer"} ·{" "}
                <Link href={q.href} target="_blank" rel="noopener noreferrer">
                  Open the lesson to reply ↗
                </Link>
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <div className="bbfa-empty">
          <h3>No questions yet.</h3>
          <p>Students ask under each lesson. Their questions appear here, unanswered first.</p>
        </div>
      )}

      <div className="bbfa-section__head" style={{ marginTop: 40 }}>
        <div>
          <div className="bbfa-eyebrow">Question boxes</div>
          <h2>Answers sent to you</h2>
        </div>
      </div>
      {answers.length ? (
        <ul className="bbc-inbox">
          {answers.map((a, i) => (
            <li key={`${a.blockId}-${i}`}>
              <div className="bbfa-sub">
                <strong>{a.author}</strong> · {a.courseTitle} · {a.lessonTitle} · {f.ago(a.updatedAt)}
              </div>
              <small>{a.prompt}</small>
              <blockquote>{a.answer}</blockquote>
              <small>
                <Link href={a.href} target="_blank" rel="noopener noreferrer">
                  Open the lesson ↗
                </Link>
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bbfa-muted">No answers have been sent to you yet. A Question box sends answers here when its option Send the answer to the instructor is on.</p>
      )}
    </div>
  );
}
