import { InquiryForm } from "@/components/inquiry-form";
import { JsonLd } from "@/components/json-ld";
import { Section } from "@/components/ui";
import { offers } from "@/content/offers";
import { site } from "@/content/site";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Contact Boril Bogoev, Ph.D.",
  description: "Send an inquiry about Sessions, Screening, Sprint, Shift, Subscription, speaking, training or roles. Boril Bogoev replies personally.",
  path: "/contact",
});

const options = [
  ...offers.map((o) => ({ value: o.slug, label: o.eyebrow })),
  { value: "training", label: "Corporate training or speaking" },
  { value: "role", label: "A role or partnership" },
  { value: "other", label: "Something else" },
];

export default function ContactPage() {
  return (
    <>
      <section className="section pb-6 pt-12 md:pb-10 md:pt-20">
        <div className="container-bb">
          <p className="eyebrow">Contact</p>
          <h1 className="t-display-lg mt-3">
            Let&apos;s work together<span className="accent">.</span>
          </h1>
          <p className="t-subtitle mt-5 max-w-[52ch]">Tell me what you want to achieve. I reply personally with next steps.</p>
        </div>
      </section>
      <Section id="inquiry" className="!pt-6 md:!pt-8">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_280px] lg:gap-16">
          <InquiryForm topic="contact" optionsLabel="What is this about?" options={options} messageLabel="Your message" />
          <aside className="t-body-sm text-muted">
            <p className="label mb-2">Elsewhere</p>
            <p className="m-0">
              <a className="font-semibold text-ink underline decoration-brand underline-offset-4" href={site.linkedin} target="_blank" rel="noopener">
                LinkedIn
              </a>
              {" · "}
              <a className="font-semibold text-ink underline decoration-brand underline-offset-4" href={site.streamliner} target="_blank" rel="noopener">
                The Streamliner
              </a>
            </p>
          </aside>
        </div>
      </Section>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />
    </>
  );
}
