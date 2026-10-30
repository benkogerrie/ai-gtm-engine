import {
  MAX_PAGES,
  MAX_REDIRECTS,
  PAGE_MAX_BYTES,
  PAGE_TIMEOUT_MS,
  SITE_READER_USER_AGENT,
} from "./constants";
import { SiteIntakeError } from "./errors";
import {
  extractPageContent,
  pickExtraPageUrls,
  type ExtractedPage,
} from "./html-to-text";
import {
  assertPublicResolvedHost,
  parseAndNormalizeWebsiteUrl,
  resolveRedirectUrl,
  type LookupFn,
} from "./url-safety";

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type FetchPagesOptions = {
  fetchFn?: FetchLike;
  lookupFn?: LookupFn;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = "name" in error ? String(error.name) : "";
  return name === "AbortError" || name === "TimeoutError";
}

function isHtmlContentType(contentType: string | null): boolean {
  if (!contentType) {
    return true;
  }
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return (
    type === "text/html" ||
    type === "application/xhtml+xml" ||
    type === "text/plain"
  );
}

async function readLimitedBody(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader) {
    const length = Number.parseInt(lengthHeader, 10);
    if (Number.isFinite(length) && length > maxBytes) {
      throw new SiteIntakeError(
        "PAGE_TOO_LARGE",
        "A page was larger than the 1.5 MB limit.",
      );
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new SiteIntakeError(
        "PAGE_TOO_LARGE",
        "A page was larger than the 1.5 MB limit.",
      );
    }
    return text;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new SiteIntakeError(
        "PAGE_TOO_LARGE",
        "A page was larger than the 1.5 MB limit.",
      );
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged);
}

async function fetchOnce(
  url: URL,
  options: Required<Pick<FetchPagesOptions, "timeoutMs" | "maxBytes">> & {
    fetchFn: FetchLike;
    lookupFn?: LookupFn;
  },
): Promise<{ response: Response; url: URL }> {
  await assertPublicResolvedHost(url, options.lookupFn);
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs);

  try {
    const response = await options.fetchFn(url.toString(), {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "User-Agent": SITE_READER_USER_AGENT,
      },
    });
    return { response, url };
  } catch (error) {
    if (isAbortError(error)) {
      throw new SiteIntakeError(
        "TIMEOUT",
        `Timed out after ${options.timeoutMs / 1000}s while reading the site.`,
        { cause: error },
      );
    }
    throw new SiteIntakeError(
      "FETCH_FAILED",
      "Could not reach that website.",
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSafeHtmlPage(
  start: URL,
  options: FetchPagesOptions = {},
): Promise<{ url: URL; html: string }> {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? PAGE_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? PAGE_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;

  let current = start;
  const visited = new Set<string>();

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const key = current.toString();
    if (visited.has(key)) {
      throw new SiteIntakeError(
        "REDIRECT_LIMIT",
        "The site redirected in a loop.",
      );
    }
    visited.add(key);

    const { response } = await fetchOnce(current, {
      fetchFn,
      lookupFn: options.lookupFn,
      timeoutMs,
      maxBytes,
    });

    if (response.status >= 300 && response.status < 400) {
      if (hop === maxRedirects) {
        throw new SiteIntakeError(
          "REDIRECT_LIMIT",
          "The site redirected too many times.",
        );
      }
      const location = response.headers.get("location");
      if (!location) {
        throw new SiteIntakeError(
          "FETCH_FAILED",
          "The site redirected without a Location header.",
        );
      }
      current = resolveRedirectUrl(current, location);
      continue;
    }

    if (!response.ok) {
      throw new SiteIntakeError(
        "FETCH_FAILED",
        `The site returned HTTP ${response.status}.`,
      );
    }

    if (!isHtmlContentType(response.headers.get("content-type"))) {
      throw new SiteIntakeError(
        "UNSUPPORTED_CONTENT",
        "That URL did not return HTML we can read.",
      );
    }

    const html = await readLimitedBody(response, maxBytes);
    return { url: current, html };
  }

  throw new SiteIntakeError(
    "REDIRECT_LIMIT",
    "The site redirected too many times.",
  );
}

export async function fetchSitePages(
  rawUrl: string,
  options: FetchPagesOptions = {},
): Promise<ExtractedPage[]> {
  const start = parseAndNormalizeWebsiteUrl(rawUrl);
  const homepage = await fetchSafeHtmlPage(start, options);
  const pages: ExtractedPage[] = [
    extractPageContent(homepage.html, homepage.url),
  ];

  const extraUrls = pickExtraPageUrls(
    homepage.url,
    homepage.html,
    MAX_PAGES - 1,
  );
  const extras = await Promise.all(
    extraUrls.map(async (extra) => {
      try {
        const page = await fetchSafeHtmlPage(extra, options);
        if (page.url.origin !== homepage.url.origin) {
          return null;
        }
        return extractPageContent(page.html, page.url);
      } catch {
        return null;
      }
    }),
  );
  for (const extra of extras) {
    if (extra) {
      pages.push(extra);
    }
  }

  if (!pages.length) {
    throw new SiteIntakeError("NO_PAGES", "No readable pages were found.");
  }
  return pages;
}
