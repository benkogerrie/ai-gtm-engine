import { describe, expect, it } from "vitest";
import { SiteIntakeError } from "./errors";
import {
  assertPublicResolvedHost,
  isBlockedAddress,
  isBlockedHostname,
  isBlockedIPv4,
  isBlockedIPv6,
  parseAndNormalizeWebsiteUrl,
  resolveRedirectUrl,
} from "./url-safety";

describe("parseAndNormalizeWebsiteUrl", () => {
  it("upgrades http to https and accepts a bare host", () => {
    expect(parseAndNormalizeWebsiteUrl("http://example.com/about").toString()).toBe(
      "https://example.com/about",
    );
    expect(parseAndNormalizeWebsiteUrl("example.com").toString()).toBe(
      "https://example.com/",
    );
  });

  it("rejects non-https schemes", () => {
    expect(() => parseAndNormalizeWebsiteUrl("javascript:alert(1)")).toThrow(
      SiteIntakeError,
    );
    expect(() => parseAndNormalizeWebsiteUrl("ftp://example.com")).toThrow(
      /https/,
    );
  });

  it("rejects credentials and empty input", () => {
    expect(() =>
      parseAndNormalizeWebsiteUrl("https://user:pass@example.com"),
    ).toThrow(/credentials/);
    expect(() => parseAndNormalizeWebsiteUrl("   ")).toThrow(/Enter a website/);
  });

  it("rejects localhost and private hostnames before DNS", () => {
    expect(() => parseAndNormalizeWebsiteUrl("https://localhost")).toThrow(
      /not a public website/,
    );
    expect(() => parseAndNormalizeWebsiteUrl("https://app.localhost")).toThrow(
      SiteIntakeError,
    );
    expect(() => parseAndNormalizeWebsiteUrl("https://router.local")).toThrow(
      SiteIntakeError,
    );
    expect(() => parseAndNormalizeWebsiteUrl("https://127.0.0.1")).toThrow(
      SiteIntakeError,
    );
    expect(() => parseAndNormalizeWebsiteUrl("https://[::1]")).toThrow(
      SiteIntakeError,
    );
  });
});

describe("blocked addresses", () => {
  it("blocks private, loopback, link-local, and reserved IPv4 ranges", () => {
    expect(isBlockedIPv4("10.0.0.8")).toBe(true);
    expect(isBlockedIPv4("192.168.1.20")).toBe(true);
    expect(isBlockedIPv4("172.16.0.1")).toBe(true);
    expect(isBlockedIPv4("127.0.0.1")).toBe(true);
    expect(isBlockedIPv4("169.254.1.1")).toBe(true);
    expect(isBlockedIPv4("100.64.0.1")).toBe(true);
    expect(isBlockedIPv4("192.0.2.10")).toBe(true);
    expect(isBlockedIPv4("198.51.100.10")).toBe(true);
    expect(isBlockedIPv4("203.0.113.10")).toBe(true);
    expect(isBlockedIPv4("0.0.0.0")).toBe(true);
    expect(isBlockedIPv4("224.0.0.1")).toBe(true);
    expect(isBlockedIPv4("8.8.8.8")).toBe(false);
    expect(isBlockedIPv4("1.1.1.1")).toBe(false);
  });

  it("blocks loopback, ULA, link-local IPv6 and mapped private IPv4", () => {
    expect(isBlockedIPv6("::1")).toBe(true);
    expect(isBlockedIPv6("::")).toBe(true);
    expect(isBlockedIPv6("fe80::1")).toBe(true);
    expect(isBlockedIPv6("fd12:3456:789a:1::1")).toBe(true);
    expect(isBlockedIPv6("2001:db8::1")).toBe(true);
    expect(isBlockedIPv6("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIPv6("::ffff:192.168.0.1")).toBe(true);
    expect(isBlockedIPv6("2001:4860:4860::8888")).toBe(false);
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
  });

  it("blocks localhost-style hostnames", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("Foo.Localhost.")).toBe(true);
    expect(isBlockedHostname("intranet.internal")).toBe(true);
    expect(isBlockedHostname("example.com")).toBe(false);
  });
});

describe("redirect re-validation", () => {
  it("upgrades http Location to https and resolves relative hops", () => {
    const current = new URL("https://example.com");
    expect(resolveRedirectUrl(current, "http://example.com/about").toString()).toBe(
      "https://example.com/about",
    );
    expect(resolveRedirectUrl(current, "/pricing").toString()).toBe(
      "https://example.com/pricing",
    );
  });

  it("rejects redirects to localhost or private IPs", () => {
    const current = new URL("https://example.com");
    expect(() => resolveRedirectUrl(current, "https://localhost/admin")).toThrow(
      /not public/,
    );
    expect(() => resolveRedirectUrl(current, "https://192.168.0.5/")).toThrow(
      SiteIntakeError,
    );
    expect(() => resolveRedirectUrl(current, "https://[::1]/")).toThrow(
      SiteIntakeError,
    );
  });
});

describe("assertPublicResolvedHost", () => {
  it("rejects a public hostname that resolves to a private IP", async () => {
    await expect(
      assertPublicResolvedHost(new URL("https://example.com"), async () => [
        { address: "10.1.2.3", family: 4 },
      ]),
    ).rejects.toMatchObject({ code: "BLOCKED_IP" });
  });

  it("rejects when any resolved address is reserved IPv6", async () => {
    await expect(
      assertPublicResolvedHost(new URL("https://example.com"), async () => [
        { address: "2001:4860:4860::8888", family: 6 },
        { address: "fe80::1", family: 6 },
      ]),
    ).rejects.toMatchObject({ code: "BLOCKED_IP" });
  });

  it("accepts only public resolved addresses", async () => {
    const resolved = await assertPublicResolvedHost(
      new URL("https://example.com"),
      async () => [{ address: "93.184.216.34", family: 4 }],
    );
    expect(resolved).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });
});
