import { PREFERRED_EXTRA_PATHS } from "./constants";

function decodeEntity(entity: string): string {
  const lower = entity.toLowerCase();
  if (lower === "&amp;") return "&";
  if (lower === "&lt;") return "<";
  if (lower === "&gt;") return ">";
  if (lower === "&quot;") return '"';
  if (lower === "&apos;") return "'";
  if (lower === "&nbsp;") return " ";

  const hex = /^&#x([0-9a-f]+);$/i.exec(entity);
  if (hex?.[1]) {
    const code = Number.parseInt(hex[1], 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  }
  const dec = /^&#(\d+);$/.exec(entity);
  if (dec?.[1]) {
    const code = Number.parseInt(dec[1], 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  }
  return "";
}

export function decodeHtmlEntities(input: string): string {
  return input.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (entity) => decodeEntity(entity),
  );
}

export function htmlToText(html: string): string {
  let text = html;
  text = text.replace(/<script\b[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");
  text = text.replace(/<svg\b[\s\S]*?<\/svg>/gi, " ");
  text = text.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, " ");
  text = text.replace(/<template\b[\s\S]*?<\/template>/gi, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|section|article|header|footer|br)>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = decodeHtmlEntities(text);
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function extractDocumentTitle(html: string): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match?.[1]) {
    return null;
  }
  const title = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return title || null;
}

export function extractMetaDescription(html: string): string | null {
  const match =
    /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(
      html,
    ) ??
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i.exec(
      html,
    );
  if (!match?.[1]) {
    return null;
  }
  const description = decodeHtmlEntities(match[1]).replace(/\s+/g, " ").trim();
  return description || null;
}

function sameOriginHref(pageUrl: URL, href: string): URL | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("mailto:")) {
    return null;
  }
  if (/^(javascript|data|file|blob):/i.test(trimmed)) {
    return null;
  }
  let next: URL;
  try {
    next = new URL(trimmed, pageUrl);
  } catch {
    return null;
  }
  if (next.protocol === "http:") {
    next.protocol = "https:";
  }
  if (next.protocol !== "https:") {
    return null;
  }
  if (next.hostname !== pageUrl.hostname) {
    return null;
  }
  next.hash = "";
  return next;
}

export function extractSameOriginLinks(html: string, pageUrl: URL): URL[] {
  const found: URL[] = [];
  const seen = new Set<string>();
  const hrefRe = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(html))) {
    const href = match[1];
    if (!href) {
      continue;
    }
    const url = sameOriginHref(pageUrl, href);
    if (!url) {
      continue;
    }
    const key = `${url.origin}${url.pathname}`.replace(/\/$/, "") || url.origin;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    found.push(url);
  }
  return found;
}

function pathScore(pathname: string): number {
  const path = pathname.replace(/\/$/, "") || "/";
  const index = PREFERRED_EXTRA_PATHS.findIndex((preferred) => {
    return path === preferred || path.startsWith(`${preferred}/`);
  });
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

export function pickExtraPageUrls(
  homepageUrl: URL,
  html: string,
  maxExtra: number,
): URL[] {
  const homeKey =
    `${homepageUrl.origin}${homepageUrl.pathname}`.replace(/\/$/, "") ||
    homepageUrl.origin;
  const ranked = extractSameOriginLinks(html, homepageUrl)
    .filter((url) => {
      const key = `${url.origin}${url.pathname}`.replace(/\/$/, "") || url.origin;
      return key !== homeKey;
    })
    .map((url) => ({ url, score: pathScore(url.pathname) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score);

  const picked: URL[] = [];
  const seen = new Set<string>();
  for (const item of ranked) {
    const key = `${item.url.origin}${item.url.pathname}`.replace(/\/$/, "");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    picked.push(item.url);
    if (picked.length >= maxExtra) {
      break;
    }
  }
  return picked;
}

export type ExtractedPage = {
  url: string;
  title: string | null;
  text: string;
};

export function extractPageContent(html: string, pageUrl: URL): ExtractedPage {
  const title = extractDocumentTitle(html);
  const description = extractMetaDescription(html);
  const body = htmlToText(html);
  const parts = [title, description, body].filter(Boolean);
  return {
    url: pageUrl.toString(),
    title,
    text: parts.join("\n\n"),
  };
}
