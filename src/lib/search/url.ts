const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
]);

/**
 * Canonicalize a result URL for storage and de-duplication.
 * Hostname is lowercased, default ports and fragments dropped, trailing
 * slash stripped (except `/`), and common tracking params removed.
 */
export function normalizeSearchUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();

  if (
    (parsed.protocol === "https:" && parsed.port === "443") ||
    (parsed.protocol === "http:" && parsed.port === "80")
  ) {
    parsed.port = "";
  }

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  const kept = new URLSearchParams();
  const keys = [...new Set(parsed.searchParams.keys())].sort();
  for (const key of keys) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      continue;
    }
    for (const value of parsed.searchParams.getAll(key)) {
      kept.append(key, value);
    }
  }
  parsed.search = kept.toString();

  return parsed.toString();
}

export function dedupeSearchUrls<T>(
  items: T[],
  getUrl: (item: T) => string,
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const item of items) {
    const normalized = normalizeSearchUrl(getUrl(item));
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(item);
  }

  return unique;
}
