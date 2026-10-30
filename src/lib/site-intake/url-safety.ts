import { BlockList, isIPv4, isIPv6, isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";
import { SiteIntakeError } from "./errors";

export type ResolvedAddress = { address: string; family: 4 | 6 };

export type LookupFn = (hostname: string) => Promise<ResolvedAddress[]>;

const BLOCKED_IPV4 = new BlockList();
BLOCKED_IPV4.addSubnet("0.0.0.0", 8, "ipv4");
BLOCKED_IPV4.addSubnet("10.0.0.0", 8, "ipv4");
BLOCKED_IPV4.addSubnet("127.0.0.0", 8, "ipv4");
BLOCKED_IPV4.addSubnet("169.254.0.0", 16, "ipv4");
BLOCKED_IPV4.addSubnet("172.16.0.0", 12, "ipv4");
BLOCKED_IPV4.addSubnet("192.168.0.0", 16, "ipv4");
BLOCKED_IPV4.addSubnet("100.64.0.0", 10, "ipv4");
BLOCKED_IPV4.addSubnet("192.0.0.0", 24, "ipv4");
BLOCKED_IPV4.addSubnet("192.0.2.0", 24, "ipv4");
BLOCKED_IPV4.addSubnet("198.51.100.0", 24, "ipv4");
BLOCKED_IPV4.addSubnet("203.0.113.0", 24, "ipv4");
BLOCKED_IPV4.addSubnet("198.18.0.0", 15, "ipv4");
BLOCKED_IPV4.addSubnet("224.0.0.0", 4, "ipv4");
BLOCKED_IPV4.addSubnet("240.0.0.0", 4, "ipv4");
BLOCKED_IPV4.addAddress("255.255.255.255", "ipv4");

const BLOCKED_IPV6 = new BlockList();
BLOCKED_IPV6.addAddress("::", "ipv6");
BLOCKED_IPV6.addAddress("::1", "ipv6");
BLOCKED_IPV6.addSubnet("fe80::", 10, "ipv6");
BLOCKED_IPV6.addSubnet("fc00::", 7, "ipv6");
BLOCKED_IPV6.addSubnet("ff00::", 8, "ipv6");
BLOCKED_IPV6.addSubnet("2001:db8::", 32, "ipv6");

const BLOCKED_TLDS = new Set([
  "local",
  "internal",
  "intranet",
  "lan",
  "home",
  "corp",
  "private",
]);

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
]);

export function isBlockedIPv4(address: string): boolean {
  return isIPv4(address) && BLOCKED_IPV4.check(address, "ipv4");
}

export function mappedIPv4FromIPv6(address: string): string | null {
  const lower = address.toLowerCase();
  const dotted = /(?::ffff:|:ffff:0:)?((?:\d{1,3}\.){3}\d{1,3})$/i.exec(lower);
  if (dotted?.[1] && isIPv4(dotted[1])) {
    return dotted[1];
  }

  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(lower);
  if (hex?.[1] && hex[2]) {
    const high = Number.parseInt(hex[1], 16);
    const low = Number.parseInt(hex[2], 16);
    const mapped = `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
    return isIPv4(mapped) ? mapped : null;
  }
  return null;
}

export function isBlockedIPv6(address: string): boolean {
  if (!isIPv6(address)) {
    return false;
  }
  if (BLOCKED_IPV6.check(address, "ipv6")) {
    return true;
  }
  const mapped = mappedIPv4FromIPv6(address);
  return mapped ? isBlockedIPv4(mapped) : false;
}

export function isBlockedAddress(address: string): boolean {
  if (isIPv4(address)) {
    return isBlockedIPv4(address);
  }
  if (isIPv6(address)) {
    return isBlockedIPv6(address);
  }
  return true;
}

export function unwrapHostname(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = unwrapHostname(hostname);
  if (!host) {
    return true;
  }
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost")) {
    return true;
  }
  const tld = host.split(".").at(-1);
  if (tld && BLOCKED_TLDS.has(tld)) {
    return true;
  }
  if (isIP(host) && isBlockedAddress(host)) {
    return true;
  }
  return false;
}

export function parseAndNormalizeWebsiteUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new SiteIntakeError("INVALID_URL", "Enter a website URL.");
  }

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z+\-.]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new SiteIntakeError("INVALID_URL", "That does not look like a website URL.");
  }

  if (url.protocol === "http:") {
    url.protocol = "https:";
  }
  if (url.protocol !== "https:") {
    throw new SiteIntakeError(
      "INVALID_URL",
      "Only https websites are allowed.",
    );
  }
  if (url.username || url.password) {
    throw new SiteIntakeError(
      "INVALID_URL",
      "URLs with credentials are not allowed.",
    );
  }
  if (!url.hostname) {
    throw new SiteIntakeError("INVALID_URL", "That URL is missing a hostname.");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new SiteIntakeError(
      "BLOCKED_HOST",
      "That host is not a public website.",
    );
  }
  return url;
}

export function resolveRedirectUrl(current: URL, location: string): URL {
  let next: URL;
  try {
    next = new URL(location, current);
  } catch {
    throw new SiteIntakeError("INVALID_URL", "The site redirected to an invalid URL.");
  }
  if (next.protocol === "http:") {
    next.protocol = "https:";
  }
  if (next.protocol !== "https:") {
    throw new SiteIntakeError(
      "INVALID_URL",
      "The site redirected to a non-https URL.",
    );
  }
  if (next.username || next.password) {
    throw new SiteIntakeError(
      "INVALID_URL",
      "The site redirected to a URL with credentials.",
    );
  }
  if (isBlockedHostname(next.hostname)) {
    throw new SiteIntakeError(
      "BLOCKED_HOST",
      "The site redirected to a host that is not public.",
    );
  }
  return next;
}

export async function defaultLookup(hostname: string): Promise<ResolvedAddress[]> {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({
    address: record.address,
    family: record.family === 6 ? 6 : 4,
  }));
}

export async function assertPublicResolvedHost(
  url: URL,
  lookupFn: LookupFn = defaultLookup,
): Promise<ResolvedAddress[]> {
  const hostname = unwrapHostname(url.hostname);
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new SiteIntakeError(
        "BLOCKED_IP",
        "That address is not a public website.",
      );
    }
    return [
      {
        address: hostname,
        family: isIPv6(hostname) ? 6 : 4,
      },
    ];
  }

  let resolved: ResolvedAddress[];
  try {
    resolved = await lookupFn(hostname);
  } catch (error) {
    throw new SiteIntakeError(
      "DNS_FAILED",
      "Could not resolve that website hostname.",
      { cause: error },
    );
  }

  if (!resolved.length) {
    throw new SiteIntakeError(
      "DNS_FAILED",
      "Could not resolve that website hostname.",
    );
  }

  const blocked = resolved.find((record) => isBlockedAddress(record.address));
  if (blocked) {
    throw new SiteIntakeError(
      "BLOCKED_IP",
      "That website resolved to a private or reserved address.",
    );
  }
  return resolved;
}

export async function assertSafePublicUrl(
  raw: string,
  lookupFn: LookupFn = defaultLookup,
): Promise<URL> {
  const url = parseAndNormalizeWebsiteUrl(raw);
  await assertPublicResolvedHost(url, lookupFn);
  return url;
}
