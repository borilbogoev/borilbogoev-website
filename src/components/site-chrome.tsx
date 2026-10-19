import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** The public site frame: skip link, header, main landmark and footer. Standalone pages (forms, admin) skip it. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
