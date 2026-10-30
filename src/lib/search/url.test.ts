import { describe, expect, it } from "vitest";
import { dedupeSearchUrls, normalizeSearchUrl } from "./url";

describe("normalizeSearchUrl", () => {
  it("lowercases the host, strips default ports, fragments, trailing slashes, and utm params", () => {
    expect(
      normalizeSearchUrl(
        "HTTPS://Example.COM:443/Path/?utm_source=x&b=2&a=1#hash",
      ),
    ).toBe("https://example.com/Path?a=1&b=2");
  });

  it("returns null for invalid or non-http URLs", () => {
    expect(normalizeSearchUrl("not a url")).toBeNull();
    expect(normalizeSearchUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("dedupeSearchUrls", () => {
  it("keeps the first hit for URLs that normalize to the same key", () => {
    const unique = dedupeSearchUrls(
      [
        { url: "https://Example.com/a/" },
        { url: "https://example.com/a?utm_campaign=x" },
        { url: "https://other.example/b" },
      ],
      (item) => item.url,
    );

    expect(unique).toEqual([
      { url: "https://Example.com/a/" },
      { url: "https://other.example/b" },
    ]);
  });
});
