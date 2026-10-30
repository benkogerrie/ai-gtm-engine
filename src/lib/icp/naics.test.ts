import { describe, expect, it } from "vitest";
import { NAICS_2022_SOURCE_URL } from "./naics-2022";
import { validateNaics } from "./naics";

describe("NAICS validation", () => {
  it("cites the Census NAICS 2022 source", () => {
    expect(NAICS_2022_SOURCE_URL).toBe("https://www.census.gov/naics/");
  });

  it("accepts known 2-digit sectors and longer codes under them", () => {
    expect(validateNaics("54")).toMatchObject({
      formatValid: true,
      known: true,
    });
    expect(validateNaics("541511")).toMatchObject({
      formatValid: true,
      known: true,
    });
    expect(validateNaics("488")).toMatchObject({
      formatValid: true,
      known: true,
    });
  });

  it("flags unknown but well-formed codes instead of inventing a replacement", () => {
    expect(validateNaics("99")).toEqual({
      formatValid: true,
      known: false,
      label: null,
    });
  });

  it("rejects malformed codes", () => {
    expect(validateNaics("1")).toMatchObject({ formatValid: false, known: false });
    expect(validateNaics("abc")).toMatchObject({
      formatValid: false,
      known: false,
    });
    expect(validateNaics(null)).toMatchObject({
      formatValid: false,
      known: false,
    });
  });
});
