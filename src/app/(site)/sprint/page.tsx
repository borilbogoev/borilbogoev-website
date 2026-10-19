import { OfferPage } from "@/components/offer-page";
import { offerBySlug } from "@/content/offers";
import { pageMetadata } from "@/lib/seo";

const offer = offerBySlug.sprint;

export const metadata = pageMetadata({ title: offer.metaTitle, description: offer.metaDescription, path: "/sprint" });

export default function SprintPage() {
  return <OfferPage offer={offer} />;
}
