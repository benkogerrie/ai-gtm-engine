import { normalizeSearchUrl } from "@/lib/search/url";

const DIRECTORY_HOSTS = new Set([
  "wikipedia.org",
  "en.wikipedia.org",
  "linkedin.com",
  "www.linkedin.com",
  "g2.com",
  "www.g2.com",
  "crunchbase.com",
  "www.crunchbase.com",
  "capterra.com",
  "www.capterra.com",
  "trustradius.com",
  "www.trustradius.com",
  "producthunt.com",
  "www.producthunt.com",
  "glassdoor.com",
  "www.glassdoor.com",
  "yelp.com",
  "www.yelp.com",
  "clutch.co",
  "www.clutch.co",
  "builtin.com",
  "www.builtin.com",
]);

const NEWS_ROUNDUP_HOSTS = new Set([
  "techcrunch.com",
  "www.techcrunch.com",
  "forbes.com",
  "www.forbes.com",
  "businessinsider.com",
  "www.businessinsider.com",
  "reuters.com",
  "www.reuters.com",
  "bloomberg.com",
  "www.bloomberg.com",
  "wsj.com",
  "www.wsj.com",
  "nytimes.com",
  "www.nytimes.com",
  "cnbc.com",
  "www.cnbc.com",
  "yahoo.com",
  "news.yahoo.com",
  "theverge.com",
  "www.theverge.com",
  "wired.com",
  "www.wired.com",
  "beckershospitalreview.com",
  "www.beckershospitalreview.com",
  "healthcareitnews.com",
  "www.healthcareitnews.com",
  "modernhealthcare.com",
  "www.modernhealthcare.com",
  "fiercehealthcare.com",
  "www.fiercehealthcare.com",
  "reddit.com",
  "www.reddit.com",
  "news.ycombinator.com",
  "medium.com",
  "www.medium.com",
  "quora.com",
  "www.quora.com",
  "youtube.com",
  "www.youtube.com",
  "facebook.com",
  "www.facebook.com",
  "x.com",
  "twitter.com",
  "www.twitter.com",
]);

const LISTICLE_PATH = [
  /\/lists?\//i,
  /\/hub\//i,
  /\/discover\//i,
  /best-\d+/i,
  /top-\d+/i,
  /round-?up/i,
  /list-of/i,
];

const LISTICLE_TEXT = [
  /\btop\s+\d+/i,
  /\bbest\s+\d+/i,
  /\bround-?up\b/i,
  /\blist of\b/i,
];

export function normalizeDomain(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  let hostname: string;
  try {
    hostname = new URL(candidate).hostname;
  } catch {
    hostname = trimmed.split("/")[0]?.split(":")[0] ?? "";
  }

  const host = hostname.replace(/^www\./, "");
  if (!host || !host.includes(".")) {
    return null;
  }
  return host;
}

export function hostFromUrl(raw: string): string | null {
  const normalized = normalizeSearchUrl(raw) ?? raw;
  try {
    return new URL(normalized).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return normalizeDomain(raw);
  }
}

function isDirectoryHost(host: string): boolean {
  return DIRECTORY_HOSTS.has(host) || DIRECTORY_HOSTS.has(`www.${host}`);
}

function isNewsRoundupHost(host: string): boolean {
  return NEWS_ROUNDUP_HOSTS.has(host) || NEWS_ROUNDUP_HOSTS.has(`www.${host}`);
}

export function isBlockedCompanyDomain(
  domain: string,
  excludeDomains: string[] = [],
): boolean {
  const host = normalizeDomain(domain);
  if (!host) {
    return true;
  }
  if (isDirectoryHost(host) || isNewsRoundupHost(host)) {
    return true;
  }
  return excludeDomains.some((excluded) => {
    const normalized = normalizeDomain(excluded);
    return normalized !== null && (host === normalized || host.endsWith(`.${normalized}`));
  });
}

export function isRejectedSourceUrl(url: string): boolean {
  const host = hostFromUrl(url);
  if (!host) {
    return true;
  }
  if (isDirectoryHost(host)) {
    return true;
  }
  if (LISTICLE_PATH.some((pattern) => pattern.test(url))) {
    return true;
  }
  return false;
}

export function isListicleText(text: string): boolean {
  return LISTICLE_TEXT.some((pattern) => pattern.test(text));
}

export function isRejectedCompanySource(input: {
  domain: string;
  name?: string;
  whyFit?: string;
  sourceUrl?: string;
  excludeDomains?: string[];
}): boolean {
  if (isBlockedCompanyDomain(input.domain, input.excludeDomains)) {
    return true;
  }
  if (input.sourceUrl && isRejectedSourceUrl(input.sourceUrl)) {
    return true;
  }
  const title = `${input.name ?? ""} ${input.whyFit ?? ""}`;
  if (isListicleText(title) && input.sourceUrl && isRejectedSourceUrl(input.sourceUrl)) {
    return true;
  }
  return false;
}

export function dedupeByDomain<T extends { domain: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    const domain = normalizeDomain(item.domain);
    if (!domain || seen.has(domain)) {
      continue;
    }
    seen.add(domain);
    unique.push({ ...item, domain });
  }
  return unique;
}
