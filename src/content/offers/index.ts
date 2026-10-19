import { sessions } from "./sessions";
import { screening } from "./screening";
import { sprint } from "./sprint";
import { shift } from "./shift";
import { subscription } from "./subscription";
import type { Offer } from "../types";

/** The paid ladder, in money-model order. */
export const offers: Offer[] = [sessions, screening, sprint, shift, subscription];

export const offerBySlug = Object.fromEntries(offers.map((o) => [o.slug, o])) as Record<Offer["slug"], Offer>;
