import { OfferPage } from "@/components/offer-page";
import { offerBySlug } from "@/content/offers";
import { pageMetadata } from "@/lib/seo";

const offer = offerBySlug.sessions;

export const metadata = pageMetadata({ title: offer.metaTitle, description: offer.metaDescription, path: "/sessions" });

export default function SessionsPage() {
  return <OfferPage offer={offer} />;
}
