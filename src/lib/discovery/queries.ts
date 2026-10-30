import type { DiscoveryInput } from "./types";

const MAX_QUERIES = 6;
const MIN_QUERIES = 3;

function joinList(values: string[] | undefined): string {
  return (values ?? []).map((value) => value.trim()).filter(Boolean).join(" ");
}

function first(values: string[] | undefined): string {
  return values?.find((value) => value.trim())?.trim() ?? "";
}

/**
 * Deterministic 3–6 Brave query templates from the ICP slice.
 * LLM refinement is optional and applied by the pipeline, not here.
 */
export function buildDiscoveryQueries(input: DiscoveryInput): string[] {
  const industries = joinList(input.industries) || "B2B software";
  const geo = joinList(input.geographies);
  const size = first(input.companySizes);
  const persona = first(input.personas);
  const trigger = first(input.triggers);
  const productHint = input.productSummary.trim().split(/\s+/).slice(0, 8).join(" ");

  const queries = [
    [industries, "companies", size, geo].filter(Boolean).join(" "),
    [productHint, industries, "customers", geo].filter(Boolean).join(" "),
    persona
      ? [persona, industries, "hiring", geo].filter(Boolean).join(" ")
      : [industries, "software vendors official site", geo]
          .filter(Boolean)
          .join(" "),
    trigger
      ? [trigger, industries, "companies", geo].filter(Boolean).join(" ")
      : [industries, size, "mid-market companies", geo].filter(Boolean).join(" "),
    [industries, "company careers jobs", geo].filter(Boolean).join(" "),
    [productHint, "alternatives competitors", industries, geo]
      .filter(Boolean)
      .join(" "),
  ]
    .map((query) => query.replace(/\s+/g, " ").trim())
    .filter((query, index, all) => query.length > 0 && all.indexOf(query) === index);

  const clamped = queries.slice(0, MAX_QUERIES);
  if (clamped.length >= MIN_QUERIES) {
    return clamped;
  }

  while (clamped.length < MIN_QUERIES) {
    clamped.push(`${industries} companies ${clamped.length + 1}`.trim());
  }
  return clamped;
}

export function buildCompetitorQuery(input: DiscoveryInput): string {
  const industries = joinList(input.industries) || "B2B software";
  const geo = joinList(input.geographies);
  const productHint = input.productSummary.trim().split(/\s+/).slice(0, 6).join(" ");
  return [productHint, industries, "competitors alternatives categories", geo]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const COUNTRY_ALIASES: Record<string, string> = {
  us: "US",
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  uk: "GB",
  "united kingdom": "GB",
  gb: "GB",
  netherlands: "NL",
  nl: "NL",
  germany: "DE",
  de: "DE",
  france: "FR",
  fr: "FR",
};

export function countryFromGeographies(
  geographies: string[] | undefined,
): string | undefined {
  for (const value of geographies ?? []) {
    const mapped = COUNTRY_ALIASES[value.trim().toLowerCase()];
    if (mapped) {
      return mapped;
    }
  }
  return undefined;
}
