"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Cover } from "./catalog";
import { api } from "./client-api";
import { BankPanel } from "./enrol";
import type { BankDetails } from "./types";
import type { Img } from "../lib/course-settings";
import "./school.css";

type Item = { id: number; slug: string; title: string; summary: string; image: Img; status: "pending" | "active"; total: number; done: number; href: string; reference: string | null; priceLabel: string };
type Me = { signedIn: boolean; user?: { name: string; email: string; staff: boolean }; courses?: Item[]; bank?: BankDetails | null };

export function MyCourses() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    api<Me>("me").then(setMe, () => setMe({ signedIn: false }));
  }, []);

  if (!me) return <p className="t-body-lg" aria-busy="true">Loading</p>;
  if (!me.signedIn) {
    return (
      <div className="cr-empty">
        <h2 className="t-h2">Sign in to see your courses.</h2>
        <p className="t-body-sm mt-2">Your progress, notes and questions are saved to your account.</p>
        <p className="mt-5">
          <Link className="bb-btn bb-btn-primary" href="/school/sign-in?next=/school/my">
            Sign in
          </Link>
        </p>
      </div>
    );
  }
  const courses = me.courses ?? [];
  const signOut = async () => {
    await fetch("/api/school/auth/sign-out", { method: "POST", credentials: "same-origin" });
    router.push("/school");
    router.refresh();
  };
  return (
    <div>
      <p className="cr-who">
        Signed in as <strong>{me.user?.name || me.user?.email}</strong>.{" "}
        <button type="button" className="cr-link" onClick={signOut}>
          Sign out
        </button>
        {me.user?.staff ? (
          <>
            {" "}
            <Link className="cr-link" href="/admin/school">
              Open the admin
            </Link>
          </>
        ) : null}
      </p>
      {courses.length ? (
        <div className="cr-grid-cards">
          {courses.map((c) => (
            <div key={c.id} className="card cr-tile">
              <Cover img={c.image} alt="" />
              <div className="cr-tile__body">
                <h3 className="t-h3">{c.title}</h3>
                {c.status === "pending" ? (
                  <>
                    <p className="cr-enrol__status">Waiting for your payment</p>
                    <BankPanel bank={me.bank ?? null} reference={c.reference} price={c.priceLabel} />
                  </>
                ) : (
                  <>
                    <div className="cr-progress" role="progressbar" aria-valuenow={c.total ? Math.round((c.done / c.total) * 100) : 0} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress in ${c.title}`}>
                      <span style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} />
                    </div>
                    <p className="cr-meta">
                      {c.done} of {c.total} lessons done
                    </p>
                    <Link className="bb-btn bb-btn-primary" href={c.href}>
                      {c.done ? "Continue learning" : "Start learning"}
                    </Link>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="cr-empty">
          <h2 className="t-h2">You are not enrolled in a course yet.</h2>
          <p className="mt-5">
            <Link className="bb-btn bb-btn-primary" href="/school">
              Browse the courses
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
