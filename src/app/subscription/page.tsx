import { OfferPage } from "@/components/offer-page";
import { offerBySlug } from "@/content/offers";
import { pageMetadata } from "@/lib/seo";

const offer = offerBySlug.subscription;

export const metadata = pageMetadata({ title: offer.metaTitle, description: offer.metaDescription, path: "/subscription" });

export default function SubscriptionPage() {
  return <OfferPage offer={offer} />;
}
