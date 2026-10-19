import { toInt } from "./sanitize";
import type { ResponseQuery } from "./responses";
import type { RawAnswers } from "./submit";

/** Reads the responses list / export filters from a URL's query string. */
export function responseQueryFrom(url: URL): ResponseQuery {
  const p = url.searchParams;
  let filters: Record<string, string> = {};
  const raw = p.get("filters");
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object") filters = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]));
    } catch {
      // ignore broken filters
    }
  }
  return {
    page: toInt(p.get("page"), 1),
    perPage: toInt(p.get("per_page"), 25),
    orderby: p.get("orderby") ?? "id",
    order: p.get("order") ?? "desc",
    search: p.get("search") ?? "",
    from: p.get("from") ?? "",
    to: p.get("to") ?? "",
    filters,
  };
}

/** Values typed by an admin: each answer is a string or a list of strings. */
export function rawFromValues(values: unknown): RawAnswers {
  const raw: RawAnswers = {};
  if (values && typeof values === "object") {
    for (const [k, v] of Object.entries(values)) raw[k] = Array.isArray(v) ? v.map(String) : [String(v ?? "")];
  }
  return raw;
}
