import { JsonLd } from "@/components/json-ld";
import { SiteChrome } from "@/components/site-chrome";
import { personLd, websiteLd } from "@/lib/seo";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteChrome>
      {children}
      <JsonLd data={[personLd(), websiteLd()]} />
    </SiteChrome>
  );
}
