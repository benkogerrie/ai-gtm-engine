// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fetchSafeHtmlPage, fetchSitePages } from "./fetch-pages";
import { SiteIntakeError } from "./errors";
import type { LookupFn } from "./url-safety";

const PUBLIC_LOOKUP: LookupFn = async () => [
  { address: "93.184.216.34", family: 4 },
];

function htmlResponse(
  html: string,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });
}

describe("fetchSafeHtmlPage", () => {
  it("follows up to three safe redirects and re-validates each hop", async () => {
    const hops: string[] = [];
    const page = await fetchSafeHtmlPage(new URL("https://example.com/"), {
      lookupFn: PUBLIC_LOOKUP,
      fetchFn: async (input) => {
        hops.push(input);
        if (input === "https://example.com/") {
          return htmlResponse("", 302, { location: "https://example.com/a" });
        }
        if (input === "https://example.com/a") {
          return htmlResponse("", 301, { location: "/b" });
        }
        if (input === "https://example.com/b") {
          return htmlResponse("<html><title>Done</title><p>About the product</p></html>");
        }
        throw new Error(`unexpected ${input}`);
      },
    });
    expect(page.url.toString()).toBe("https://example.com/b");
    expect(page.html).toContain("About the product");
    expect(hops).toEqual([
      "https://example.com/",
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("rejects a redirect to localhost", async () => {
    await expect(
      fetchSafeHtmlPage(new URL("https://example.com/"), {
        lookupFn: PUBLIC_LOOKUP,
        fetchFn: async () =>
          htmlResponse("", 302, { location: "https://localhost/admin" }),
      }),
    ).rejects.toMatchObject({ code: "BLOCKED_HOST" });
  });

  it("rejects a redirect to a private IP", async () => {
    await expect(
      fetchSafeHtmlPage(new URL("https://example.com/"), {
        lookupFn: PUBLIC_LOOKUP,
        fetchFn: async () =>
          htmlResponse("", 302, { location: "https://192.168.0.8/meta" }),
      }),
    ).rejects.toMatchObject({ code: "BLOCKED_HOST" });
  });

  it("rejects more than three redirects", async () => {
    await expect(
      fetchSafeHtmlPage(new URL("https://example.com/"), {
        lookupFn: PUBLIC_LOOKUP,
        fetchFn: async (input) => {
          const url = new URL(input);
          const next = Number(url.pathname.slice(1) || "0") + 1;
          return htmlResponse("", 302, { location: `/${next}` });
        },
      }),
    ).rejects.toMatchObject({ code: "REDIRECT_LIMIT" });
  });

  it("rejects pages over 1.5 MB", async () => {
    await expect(
      fetchSafeHtmlPage(new URL("https://example.com/"), {
        lookupFn: PUBLIC_LOOKUP,
        fetchFn: async () =>
          htmlResponse("too-big", 200, { "content-length": String(2_000_000) }),
      }),
    ).rejects.toMatchObject({ code: "PAGE_TOO_LARGE" });
  });

  it("times out a hanging fetch", async () => {
    await expect(
      fetchSafeHtmlPage(new URL("https://example.com/"), {
        lookupFn: PUBLIC_LOOKUP,
        timeoutMs: 20,
        fetchFn: async (_input, init) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            });
          }),
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});

describe("fetchSitePages", () => {
  it("reads the homepage plus two preferred same-origin links", async () => {
    const pages = await fetchSitePages("example.com", {
      lookupFn: PUBLIC_LOOKUP,
      fetchFn: async (input) => {
        if (input === "https://example.com/") {
          return htmlResponse(`
            <html>
              <title>Acme</title>
              <body>
                <p>Acme sells rostering software to hospital operations teams worldwide.</p>
                <a href="/about">About</a>
                <a href="/pricing">Pricing</a>
                <a href="/blog">Blog</a>
              </body>
            </html>
          `);
        }
        if (input === "https://example.com/about") {
          return htmlResponse("<html><title>About</title><p>About Acme</p></html>");
        }
        if (input === "https://example.com/pricing") {
          return htmlResponse("<html><title>Pricing</title><p>Talk to sales</p></html>");
        }
        throw new Error(`unexpected ${input}`);
      },
    });
    expect(pages.map((page) => page.url)).toEqual([
      "https://example.com/",
      "https://example.com/about",
      "https://example.com/pricing",
    ]);
  });

  it("rejects a non-https raw URL that cannot be upgraded safely", async () => {
    await expect(
      fetchSitePages("javascript:alert(1)", { lookupFn: PUBLIC_LOOKUP }),
    ).rejects.toBeInstanceOf(SiteIntakeError);
  });
});
