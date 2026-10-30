import { describe, expect, it } from "vitest";
import { cleanText, stripHtmlAndDecode } from "./html";

describe("stripHtmlAndDecode", () => {
  it("strips tags and decodes hex/named entities", () => {
    expect(
      stripHtmlAndDecode(
        "<strong>UCHealth</strong> is making nurse scheduling easier &#x27;overnight&#x27; &amp; safer",
      ),
    ).toBe("UCHealth is making nurse scheduling easier 'overnight' & safer");
  });

  it("decodes decimal entities and nbsp", () => {
    expect(stripHtmlAndDecode("Mercy&#39;s&nbsp;clinic")).toBe("Mercy's clinic");
  });

  it("collapses leftover whitespace", () => {
    expect(cleanText("  <p>Ochsner   Health</p>  ")).toBe("Ochsner Health");
  });
});
