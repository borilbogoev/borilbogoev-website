import { OfferPage } from "@/components/offer-page";
import { offerBySlug } from "@/content/offers";
import { pageMetadata } from "@/lib/seo";

const offer = offerBySlug.shift;

export const metadata = pageMetadata({ title: offer.metaTitle, description: offer.metaDescription, path: "/shift" });

export default function ShiftPage() {
  return <OfferPage offer={offer} />;
}
