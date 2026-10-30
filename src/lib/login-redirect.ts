const FALLBACK = "/intake";
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const ENCODED_SLASH_OR_BSLASH = /%(?:2f|5c)/i;

function tryDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function looksLikeInternalPath(value: string): boolean {
  if (!value.startsWith("/")) {
    return false;
  }
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return false;
  }
  if (value.includes("\\") || CONTROL_CHARS.test(value)) {
    return false;
  }
  if (ENCODED_SLASH_OR_BSLASH.test(value)) {
    return false;
  }
  if (/^[a-zA-Z][a-zA-Z+\-.]*:/.test(value)) {
    return false;
  }
  return true;
}

function isAllowlisted(pathname: string): boolean {
  if (pathname === "/intake" || pathname.startsWith("/intake/")) {
    return true;
  }
  if (pathname === "/icp" || pathname.startsWith("/icp/")) {
    return true;
  }
  if (pathname === "/prospects" || pathname.startsWith("/prospects/")) {
    return true;
  }
  if (pathname === "/outreach" || pathname.startsWith("/outreach/")) {
    return true;
  }
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return true;
  }
  if (pathname === "/pipeline" || pathname.startsWith("/pipeline/")) {
    return true;
  }
  if (pathname === "/graph" || pathname.startsWith("/graph/")) {
    return true;
  }
  return false;
}

/**
 * Same-origin internal post-login path only. Protocol-relative, schemes,
 * backslashes, control characters, and encoded `//` / `\` fall back to /intake.
 */
export function safeLoginRedirect(next: unknown): string {
  if (typeof next !== "string" || next.length === 0) {
    return FALLBACK;
  }
  if (!looksLikeInternalPath(next)) {
    return FALLBACK;
  }

  const decoded = tryDecode(next);
  if (decoded === null || !looksLikeInternalPath(decoded)) {
    return FALLBACK;
  }

  let url: URL;
  try {
    url = new URL(next, "http://local");
  } catch {
    return FALLBACK;
  }
  if (url.origin !== "http://local" || url.username || url.password) {
    return FALLBACK;
  }
  if (!looksLikeInternalPath(url.pathname)) {
    return FALLBACK;
  }

  const decodedPath = tryDecode(url.pathname);
  if (decodedPath === null || !looksLikeInternalPath(decodedPath)) {
    return FALLBACK;
  }

  if (!isAllowlisted(url.pathname)) {
    return FALLBACK;
  }

  return `${url.pathname}${url.search}`;
}
