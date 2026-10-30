import { countryFromGeographies } from "./queries";

const NON_US_MARKERS =
  /\b(south korea|korea|seoul|incheon|inha university|\.kr\b|tokyo|osaka|nhs england)\b/i;

/**
 * Cheap reject for orgs that are clearly not in a US-only ICP
 * (e.g. Inha University Hospital, South Korea).
 */
export function isOutsideIcpGeography(
  prospect: { name: string; domain?: string | null; whyFit?: string; region?: string | null },
  geographies?: string[],
): boolean {
  const country = countryFromGeographies(geographies);
  if (country !== "US") {
    return false;
  }
  const blob = [prospect.name, prospect.domain ?? "", prospect.whyFit ?? "", prospect.region ?? ""].join(" ");
  if (/\.kr\b/i.test(prospect.domain ?? "") || /\.kr\b/i.test(blob)) {
    return true;
  }
  return NON_US_MARKERS.test(blob);
}
