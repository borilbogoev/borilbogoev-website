import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section">
      <div className="container-bb">
        <p className="eyebrow">Error 404</p>
        <h1 className="t-display-lg mt-3">
          This page does not exist<span className="accent">.</span>
        </h1>
        <p className="t-body-lg mt-4 max-w-[48ch]">The link may be old or mistyped. Start from the home page or pick an offer.</p>
        <Link href="/" className="bb-btn bb-btn-primary mt-8">
          Go Home
        </Link>
      </div>
    </section>
  );
}
