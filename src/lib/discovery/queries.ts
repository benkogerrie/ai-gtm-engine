import type { DiscoveryInput } from "./types";

const MAX_QUERIES = 6;
const MIN_QUERIES = 3;
const LISTICLE_MINUS = "-best -top -listicle -roundup";

function first(values: string[] | undefined): string {
  return values?.find((value) => value.trim())?.trim() ?? "";
}

function compact(parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isHealthcareIcp(input: DiscoveryInput): boolean {
  const blob = [input.productSummary, ...input.industries, ...(input.personas ?? [])]
    .join(" ")
    .toLowerCase();
  return /hospital|health.?system|clinic|nurs|inpatient|acute care|healthcare|medical center|shift.?schedul/.test(
    blob,
  );
}

/**
 * Deterministic 3–6 Brave queries that seek named buyer organizations
 * (hospitals, health systems, clinics) — not vendor listicles.
 */
export function buildDiscoveryQueries(input: DiscoveryInput): string[] {
  const industry = first(input.industries) || "B2B";
  const geo = first(input.geographies) || "United States";
  const persona = first(input.personas);
  const trigger = first(input.triggers);
  const size = first(input.companySizes);
  const productHint = input.productSummary.trim().split(/\s+/).slice(0, 6).join(" ");

  const queries = isHealthcareIcp(input)
    ? [
        compact([
          "hospital announces nurse staffing OR scheduling",
          geo,
          LISTICLE_MINUS,
        ]),
        compact([
          "health system implementing nurse scheduling OR shift scheduling",
          geo,
        ]),
        compact([
          '"medical center" OR hospital',
          trigger || "workforce shortage",
          geo,
          LISTICLE_MINUS,
        ]),
        compact([
          persona || "chief nursing officer",
          "hospital hiring workforce",
          geo,
          "-list",
        ]),
        compact([
          "hospital EHR scheduling change press release",
          geo,
        ]),
        compact([
          industry,
          "hospital OR clinic",
          productHint,
          geo,
          LISTICLE_MINUS,
        ]),
      ]
    : [
        compact([
          `"${industry}"`,
          "announces",
          trigger || productHint,
          geo,
          LISTICLE_MINUS,
        ]),
        compact([
          persona,
          industry,
          "hiring",
          geo,
          "-list",
        ]),
        compact([
          `"${industry}"`,
          "company press release",
          size,
          geo,
        ]),
        compact([
          industry,
          trigger || "expansion",
          "official site",
          geo,
          LISTICLE_MINUS,
        ]),
        compact([
          productHint,
          industry,
          "implements",
          geo,
        ]),
        compact([
          industry,
          "organization",
          geo,
          LISTICLE_MINUS,
        ]),
      ];

  const unique = queries.filter(
    (query, index, all) => query.length > 0 && all.indexOf(query) === index,
  );
  const clamped = unique.slice(0, MAX_QUERIES);
  while (clamped.length < MIN_QUERIES) {
    clamped.push(compact([industry, "organization", geo, String(clamped.length + 1)]));
  }
  return clamped;
}

export function buildCompetitorQuery(input: DiscoveryInput): string {
  const industry = first(input.industries) || "B2B";
  const geo = first(input.geographies);
  const productHint = input.productSummary.trim().split(/\s+/).slice(0, 6).join(" ");
  if (isHealthcareIcp(input)) {
    return compact([
      "hospital nurse scheduling software competitors",
      "Kronos UKG",
      geo,
    ]);
  }
  return compact([productHint, industry, "competitors alternatives categories", geo]);
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
