import { cleanText } from "./html";
import { normalizeDomain } from "./filters";

const ANNOUNCE_VERB =
  /\s+(?:announces|announced|launches|launched|unveils|unveiled|implements|implemented|partners|partnered|selects|selected|adopts|adopted|rolls out|introduces|introduced|deploys|deployed|names|named)\b/i;

const HEADLINE_PREFIX =
  /^(making|how|why|what|when|where|the|a|an|perceived|trends?|innovative|transforming|nurse scheduling|staffing|scheduling|workforce|ai[- ]powered)\b/i;

const KNOWN_BRANDS: Record<string, string> = {
  uchealth: "UCHealth",
  ochsner: "Ochsner Health",
  mercy: "Mercy",
  hca: "HCA Healthcare",
  hcahealthcare: "HCA Healthcare",
  m7health: "M7 Health",
  symplr: "symplr",
  shiftmed: "ShiftMed",
  healthstream: "HealthStream",
  mayo: "Mayo Clinic",
  clevelandclinic: "Cleveland Clinic",
  adventhealth: "AdventHealth",
  intermountain: "Intermountain Health",
  kaiser: "Kaiser Permanente",
  kaiserpermanente: "Kaiser Permanente",
  providence: "Providence",
  commonspirit: "CommonSpirit Health",
  ascension: "Ascension",
  bannerhealth: "Banner Health",
  northwell: "Northwell Health",
};

export function isLikelyArticleTitle(name: string): boolean {
  const text = cleanText(name);
  if (text.length > 48) {
    return true;
  }
  if (ANNOUNCE_VERB.test(text)) {
    return true;
  }
  if (HEADLINE_PREFIX.test(text)) {
    return true;
  }
  if (/[.…]|!\s|\?\s/.test(text)) {
    return true;
  }
  return false;
}

export function brandFromDomain(domain: string): string | null {
  const host = normalizeDomain(domain) ?? domain.toLowerCase().replace(/^www\./, "");
  const stripped = host.replace(
    /^(news|blog|magazine|press|go|info|ir|investors|careers|www)\./,
    "",
  );
  const slug = stripped.split(".")[0] ?? "";
  if (!slug) {
    return null;
  }
  if (KNOWN_BRANDS[slug]) {
    return KNOWN_BRANDS[slug];
  }
  if (slug.length < 3 || /^\d+$/.test(slug)) {
    return null;
  }
  return titleCaseSlug(slug);
}

function titleCaseSlug(slug: string): string {
  const spaced = slug
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/([0-9])([a-zA-Z])/g, "$1 $2");
  return spaced
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function trimOrgName(name: string): string {
  return cleanText(name)
    .replace(/\s+[|\-–—].*$/, "")
    .replace(/['’]s$/i, "")
    .replace(/\s+\((?:official|home|website)\)/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Turn a page/article title into the organization name.
 * A news.ochsner.org headline is a citation, not the company name.
 */
export function extractOrganizationName(
  title: string,
  domain?: string,
): string {
  const cleaned = trimOrgName(title);
  const announced = cleaned.split(ANNOUNCE_VERB)[0]?.trim();
  if (announced && announced.length >= 2 && announced.length <= 48) {
    return announced;
  }

  if (HEADLINE_PREFIX.test(cleaned) || isLikelyArticleTitle(cleaned)) {
    const fromDomain = domain ? brandFromDomain(domain) : null;
    if (fromDomain) {
      return fromDomain;
    }
  }

  if (cleaned.length > 0 && cleaned.length <= 48 && !HEADLINE_PREFIX.test(cleaned)) {
    return cleaned;
  }

  const fromDomain = domain ? brandFromDomain(domain) : null;
  return fromDomain ?? cleaned.slice(0, 48).trim();
}

const ORG_STOP = new Set([
  "inc",
  "llc",
  "ltd",
  "corp",
  "corporation",
  "co",
  "the",
  "health",
  "healthcare",
  "hospital",
  "hospitals",
  "system",
  "systems",
  "medical",
  "center",
  "clinic",
  "clinics",
]);

/** Stable key so "Ochsner Health" and "Ochsner" collapse. */
export function normalizeOrgKey(name: string): string {
  return cleanText(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !ORG_STOP.has(token))
    .join("");
}

export function dedupeByOrganization<T extends { name: string; domain?: string }>(
  items: T[],
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    const nameKey = normalizeOrgKey(item.name);
    const domainKey = item.domain ? normalizeDomain(item.domain) : null;
    const key = nameKey || domainKey;
    if (!key || seen.has(key) || (domainKey && seen.has(domainKey))) {
      continue;
    }
    seen.add(key);
    if (domainKey) {
      seen.add(domainKey);
    }
    unique.push(item);
  }
  return unique;
}
