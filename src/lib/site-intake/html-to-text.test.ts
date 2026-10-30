import { describe, expect, it } from "vitest";
import {
  extractSameOriginLinks,
  htmlToText,
  pickExtraPageUrls,
} from "./html-to-text";

const HOME = new URL("https://example.com/");

describe("htmlToText", () => {
  it("strips scripts, styles, and tags down to readable text", () => {
    const html = `
      <html>
        <head>
          <title>ShiftPilot</title>
          <style>body { color: red }</style>
          <script>window.secret = "nope"</script>
        </head>
        <body>
          <h1>AI shift scheduling</h1>
          <p>We help hospitals cover night shifts &amp; float pools.</p>
          <script>document.write("injected")</script>
        </body>
      </html>
    `;
    const text = htmlToText(html);
    expect(text).toContain("AI shift scheduling");
    expect(text).toContain("We help hospitals cover night shifts & float pools.");
    expect(text).not.toContain("window.secret");
    expect(text).not.toContain("document.write");
    expect(text).not.toContain("color: red");
  });
});

describe("extractSameOriginLinks", () => {
  it("keeps same-origin https links and drops external or unsafe hrefs", () => {
    const html = `
      <a href="/about">About</a>
      <a href="https://example.com/pricing">Pricing</a>
      <a href="http://example.com/product">Product</a>
      <a href="https://other.test/about">Other</a>
      <a href="javascript:alert(1)">Nope</a>
      <a href="mailto:hi@example.com">Mail</a>
    `;
    const hrefs = extractSameOriginLinks(html, HOME).map((url) => url.pathname);
    expect(hrefs).toEqual(["/about", "/pricing", "/product"]);
  });
});

describe("pickExtraPageUrls", () => {
  it("prefers about, product, solutions, and pricing, max two", () => {
    const html = `
      <a href="/blog">Blog</a>
      <a href="/pricing">Pricing</a>
      <a href="/about">About</a>
      <a href="/solutions">Solutions</a>
      <a href="/product">Product</a>
    `;
    const picked = pickExtraPageUrls(HOME, html, 2).map((url) => url.pathname);
    expect(picked).toEqual(["/about", "/product"]);
  });
});
