import { hostFromUrl, normalizeDomain } from "./filters";
import { cleanText } from "./html";
import { extractOrganizationName, isLikelyArticleTitle } from "./names";
import type {
  CandidateRole,
  CompetitorCategoryInsight,
  DiscoveryCandidate,
} from "./types";

const MEDIA_RESEARCH_HOSTS = new Set([
  "prnewswire.com",
  "www.prnewswire.com",
  "businesswire.com",
  "globenewswire.com",
  "newswire.com",
  "einnews.com",
  "tmcnet.com",
  "hrtechedge.com",
  "digitalhealthnews.com",
  "pubmed.ncbi.nlm.nih.gov",
  "ncbi.nlm.nih.gov",
  "nih.gov",
  "arxiv.org",
  "ssrn.com",
  "medium.com",
  "substack.com",
]);

const VENDOR_HOSTS = new Set([
  "symplr.com",
  "m7health.com",
  "shiftmed.com",
  "healthstream.com",
  "ukg.com",
  "kronos.com",
  "workday.com",
  "oracle.com",
  "cerner.com",
  "epic.com",
  "apihealthcare.com",
  "avantas.com",
  "qgenda.com",
  "amion.com",
  "tigerscheduling.com",
  "simplescheduleai.com",
]);

const JUNK_COMPETITOR_HOSTS = new Set([
  "wpauthorbox.com",
  "simplescheduleai.com",
  "blogspot.com",
  "wordpress.com",
  "wixsite.com",
  "squarespace.com",
]);

const BUYER_NAME =
  /\b(hospital|health system|healthcare|medical center|medical centre|clinic|health)\b/i;

const BUYER_BRAND =
  /^(ochsner|uchealth|mercy|hca|mayo|ascension|providence|intermountain|kaiser|northwell|adventhealth|banner|commonspirit|cleveland clinic)\b/i;

const BUYER_HOSTS = new Set([
  "uchealth.org",
  "ochsner.org",
  "mercy.net",
  "hcahealthcare.com",
  "mayoclinic.org",
  "clevelandclinic.org",
  "adventhealth.com",
  "intermountainhealthcare.org",
  "kaiserpermanente.org",
  "providence.org",
  "ascension.org",
  "bannerhealth.com",
  "northwell.edu",
]);

function looksLikeBuyerOrg(name: string, host: string, blob: string): boolean {
  if (BUYER_NAME.test(name) || BUYER_NAME.test(blob) || /health/i.test(name)) {
    return true;
  }
  if (BUYER_BRAND.test(name)) {
    return true;
  }
  if (host && BUYER_HOSTS.has(host.replace(/^www\./, ""))) {
    return true;
  }
  if (
    host &&
    /\.(org|net)$/.test(host) &&
    !isVendorHost(host) &&
    !isMediaOrResearchHost(host) &&
    !VENDOR_NAME.test(name)
  ) {
    return true;
  }
  return false;
}

const VENDOR_NAME =
  /\b(software|platform|vendor|solution|workforce management platform|scheduling software|ai[- ]powered)\b/i;

export function isMediaOrResearchHost(host: string): boolean {
  const normalized = host.replace(/^www\./, "").toLowerCase();
  if (MEDIA_RESEARCH_HOSTS.has(normalized) || MEDIA_RESEARCH_HOSTS.has(host)) {
    return true;
  }
  return (
    normalized.endsWith(".nih.gov") ||
    normalized.includes("pubmed") ||
    normalized.endsWith(".edu") && /pmc|pubmed|scholar/.test(normalized)
  );
}

export function isVendorHost(host: string): boolean {
  const normalized = host.replace(/^www\./, "").toLowerCase();
  return VENDOR_HOSTS.has(normalized) || VENDOR_HOSTS.has(`www.${normalized}`);
}

export function isJunkCompetitorHost(host: string): boolean {
  const normalized = host.replace(/^www\./, "").toLowerCase();
  if (JUNK_COMPETITOR_HOSTS.has(normalized)) {
    return true;
  }
  return /wordpress|wpauthor|blogspot|wixsite|squarespace|weebly/.test(
    normalized,
  );
}

export function stripContentSubdomain(host: string): string {
  return host.replace(
    /^(news|blog|magazine|press|go|info|ir|investors|careers|www)\./,
    "",
  );
}

export function inferOrgDomain(
  rawDomain: string | undefined,
  citationUrl?: string,
): string {
  const fromRaw = registrableBuyerDomain(rawDomain);
  if (fromRaw) {
    return fromRaw;
  }
  const fromCitation = hostFromUrl(citationUrl ?? "");
  return registrableBuyerDomain(fromCitation ?? undefined) ?? "";
}

function registrableBuyerDomain(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  const host = normalizeDomain(raw) ?? (raw.includes(".") ? raw.replace(/^www\./, "") : null);
  if (!host) {
    return null;
  }
  if (isMediaOrResearchHost(host) || isJunkCompetitorHost(host)) {
    return null;
  }
  return stripContentSubdomain(host);
}

export function classifyCandidate(candidate: DiscoveryCandidate): CandidateRole {
  if (candidate.role) {
    return candidate.role;
  }

  const host = normalizeDomain(candidate.domain) ?? "";
  const citationHosts = candidate.claims
    .map((claim) => hostFromUrl(claim.sourceUrl))
    .filter((value): value is string => Boolean(value));
  const blob = cleanText(
    [candidate.name, candidate.whyFit, ...candidate.claims.map((claim) => claim.quote)].join(" "),
  );

  if (host && isVendorHost(host)) {
    return "vendor_competitor";
  }
  if (citationHosts.some((item) => isVendorHost(item)) && VENDOR_NAME.test(blob) && !BUYER_NAME.test(candidate.name)) {
    return "vendor_competitor";
  }
  if (host && isMediaOrResearchHost(host) && !looksLikeBuyerOrg(candidate.name, host, blob)) {
    return "media_research";
  }
  if (
    citationHosts.length > 0 &&
    citationHosts.every((item) => isMediaOrResearchHost(item)) &&
    !looksLikeBuyerOrg(candidate.name, host, blob) &&
    isLikelyArticleTitle(candidate.name)
  ) {
    return "media_research";
  }
  if (looksLikeBuyerOrg(candidate.name, host, blob)) {
    return "buyer";
  }
  if (VENDOR_NAME.test(candidate.name) && !looksLikeBuyerOrg(candidate.name, host, blob)) {
    return "vendor_competitor";
  }
  if (host && isMediaOrResearchHost(host)) {
    return "media_research";
  }
  return "media_research";
}

export function filterBuyers(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
  return candidates.filter((candidate) => classifyCandidate(candidate) === "buyer");
}

export function collectVendors(
  candidates: DiscoveryCandidate[],
): DiscoveryCandidate[] {
  return candidates.filter(
    (candidate) => classifyCandidate(candidate) === "vendor_competitor",
  );
}

export function vendorsToCompetitorCategory(
  vendors: DiscoveryCandidate[],
): CompetitorCategoryInsight | null {
  if (vendors.length === 0) {
    return null;
  }
  const firstClaim = vendors[0]?.claims[0];
  if (!firstClaim) {
    return null;
  }
  return {
    category: "Workforce scheduling vendors",
    examples: [...new Set(vendors.map((vendor) => extractOrganizationName(vendor.name, vendor.domain)))],
    sourceUrl: firstClaim.sourceUrl,
    quote: cleanText(vendors[0]?.whyFit ?? firstClaim.quote, 280),
  };
}

const COMPETITOR_SIGNAL =
  /competitor|alternative|versus|\bvs\.?\b|scheduling software|workforce management|nurse scheduling|kronos|ukg|symplr|shift/i;

export function isCredibleCompetitorCitation(input: {
  sourceUrl: string;
  quote: string;
  category?: string;
}): boolean {
  const host = hostFromUrl(input.sourceUrl);
  if (!host || isJunkCompetitorHost(host)) {
    return false;
  }
  if (isMediaOrResearchHost(host) && !COMPETITOR_SIGNAL.test(input.quote)) {
    return false;
  }
  const blob = `${input.category ?? ""} ${input.quote}`;
  return COMPETITOR_SIGNAL.test(blob);
}
