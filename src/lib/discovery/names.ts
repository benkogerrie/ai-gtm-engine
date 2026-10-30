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

export function organizationMatchKeys(input: {
  name: string;
  domain?: string | null;
}): string[] {
  const keys: string[] = [];
  const nameKey = normalizeOrgKey(input.name);
  if (nameKey) {
    keys.push(`name:${nameKey}`);
  }
  const domainKey = input.domain ? normalizeDomain(input.domain) : null;
  if (domainKey) {
    keys.push(`domain:${domainKey}`);
  }
  return keys;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function preferOrgName(kept: string, incoming: string): string {
  if (isLikelyArticleTitle(kept) && !isLikelyArticleTitle(incoming)) {
    return incoming;
  }
  if (kept.length < incoming.length && incoming.length <= 48 && !isLikelyArticleTitle(incoming)) {
    return incoming;
  }
  return kept;
}

function preferOrgDomain(kept?: string, incoming?: string): string | undefined {
  const a = kept ? normalizeDomain(kept) ?? kept : "";
  const b = incoming ? normalizeDomain(incoming) ?? incoming : "";
  if (a && b) {
    const aNews = /^(news|blog|magazine|press)\./.test(a);
    const bNews = /^(news|blog|magazine|press)\./.test(b);
    if (aNews && !bNews) {
      return b;
    }
    return a;
  }
  return a || b || kept || incoming;
}

function mergeOrganizationItems<T extends { name: string; domain?: string }>(
  kept: T,
  incoming: T,
): T {
  const next: T = {
    ...kept,
    name: preferOrgName(kept.name, incoming.name),
  };
  const domain = preferOrgDomain(kept.domain, incoming.domain);
  if (domain) {
    next.domain = domain;
  }

  const keptRecord = isRecord(kept) ? (kept as Record<string, unknown>) : null;
  const incomingRecord = isRecord(incoming)
    ? (incoming as Record<string, unknown>)
    : null;
  if (keptRecord && incomingRecord) {
    if (Array.isArray(keptRecord.claims) || Array.isArray(incomingRecord.claims)) {
      const claims = [
        ...(Array.isArray(keptRecord.claims) ? keptRecord.claims : []),
        ...(Array.isArray(incomingRecord.claims) ? incomingRecord.claims : []),
      ];
      (next as T & { claims: unknown[] }).claims = uniqueBy(claims, (claim) => {
        if (!isRecord(claim)) {
          return JSON.stringify(claim);
        }
        return `${String(claim.field ?? "")}|${String(claim.sourceUrl ?? "")}|${String(claim.quote ?? "")}`;
      });
    }
    if (Array.isArray(keptRecord.signals) || Array.isArray(incomingRecord.signals)) {
      const signals = [
        ...(Array.isArray(keptRecord.signals) ? keptRecord.signals : []),
        ...(Array.isArray(incomingRecord.signals) ? incomingRecord.signals : []),
      ];
      (next as T & { signals: unknown[] }).signals = uniqueBy(signals, (signal) => {
        if (!isRecord(signal)) {
          return JSON.stringify(signal);
        }
        return `${String(signal.sourceUrl ?? "")}|${String(signal.summary ?? "")}`;
      });
    }
    const keptScore =
      typeof keptRecord.fitScore === "number" ? keptRecord.fitScore : undefined;
    const incomingScore =
      typeof incomingRecord.fitScore === "number" ? incomingRecord.fitScore : undefined;
    if (keptScore != null || incomingScore != null) {
      (next as T & { fitScore: number }).fitScore = Math.max(
        keptScore ?? 0,
        incomingScore ?? 0,
      );
    }
  }

  return next;
}

/**
 * Collapse the same buyer org (normalized name or domain) into one row
 * and merge cited claims / signals when present.
 */
export function aggregateByOrganization<
  T extends { name: string; domain?: string },
>(items: T[]): T[] {
  const indexByKey = new Map<string, number>();
  const unique: T[] = [];

  for (const item of items) {
    const keys = organizationMatchKeys(item);
    if (keys.length === 0) {
      continue;
    }
    const existingIndex = keys
      .map((key) => indexByKey.get(key))
      .find((index): index is number => index !== undefined);
    if (existingIndex === undefined) {
      const nextIndex = unique.length;
      unique.push(item);
      for (const key of keys) {
        indexByKey.set(key, nextIndex);
      }
      continue;
    }
    unique[existingIndex] = mergeOrganizationItems(unique[existingIndex] as T, item);
    for (const key of organizationMatchKeys(unique[existingIndex] as T)) {
      indexByKey.set(key, existingIndex);
    }
  }

  return unique;
}

export function dedupeByOrganization<T extends { name: string; domain?: string }>(
  items: T[],
): T[] {
  return aggregateByOrganization(items);
}

export function companiesMatchOrganization(
  left: { name: string; domain?: string | null },
  right: { name: string; domain?: string | null },
): boolean {
  const leftKeys = new Set(organizationMatchKeys(left));
  if (leftKeys.size === 0) {
    return false;
  }
  return organizationMatchKeys(right).some((key) => leftKeys.has(key));
}
