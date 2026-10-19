import { OfferPage } from "@/components/offer-page";
import { offerBySlug } from "@/content/offers";
import { pageMetadata } from "@/lib/seo";

const offer = offerBySlug.screening;

export const metadata = pageMetadata({ title: offer.metaTitle, description: offer.metaDescription, path: "/screening" });

export default function ScreeningPage() {
  return <OfferPage offer={offer} />;
}
