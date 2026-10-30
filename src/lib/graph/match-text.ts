const STOPWORDS = new Set([
  "and",
  "the",
  "of",
  "for",
  "a",
  "an",
  "in",
  "to",
  "or",
  "on",
  "with",
  "general",
  "other",
]);

function foldToken(token: string): string {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("ses") && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith("s") && token.length > 3 && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

export function foldText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(foldToken)
    .join(" ");
}

export function significantTokens(value: string): string[] {
  return foldText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 8 && !STOPWORDS.has(token));
}

export function textMentions(haystack: string, needle: string): boolean {
  const raw = needle.trim();
  if (!raw) {
    return false;
  }
  if (/^\d{2,6}$/.test(raw)) {
    return new RegExp(`(^|\\D)${raw}(\\D|$)`).test(haystack);
  }
  const foldedNeedle = foldText(raw);
  if (foldedNeedle.length < 4) {
    return false;
  }
  const foldedHay = foldText(haystack);
  if (foldedHay.includes(foldedNeedle)) {
    return true;
  }
  if (foldedNeedle.includes(" ") && foldedHay.includes(foldedNeedle)) {
    return true;
  }
  const tokens = significantTokens(raw);
  return tokens.some((token) => foldedHay.includes(token));
}

export function textMentionsAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => textMentions(haystack, needle));
}
