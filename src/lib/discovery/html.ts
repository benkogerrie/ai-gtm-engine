/**
 * Strip tags and decode common HTML entities from search snippets / LLM text.
 * Brave snippets sometimes include `<strong>` and `&#x27;`.
 */
export function stripHtmlAndDecode(input: string): string {
  const withoutTags = input.replace(/<\/?[^>]+>/g, " ");
  const decoded = withoutTags.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (entity) => decodeEntity(entity),
  );
  return decoded.replace(/\s+/g, " ").trim();
}

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

export function cleanText(input: string, maxLength?: number): string {
  const cleaned = stripHtmlAndDecode(input);
  if (maxLength && cleaned.length > maxLength) {
    return cleaned.slice(0, maxLength).trim();
  }
  return cleaned;
}
