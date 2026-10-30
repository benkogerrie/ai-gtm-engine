/**
 * Compact NAICS 2022 sector / selected-subsector lookup.
 * Source: U.S. Census Bureau, North American Industry Classification System (2022)
 * https://www.census.gov/naics/
 * Titles transcribed from the 2022 NAICS structure (2-digit sectors and a
 * small set of common 3-digit subsectors). Unknown codes are flagged, never invented.
 */
export const NAICS_2022_SOURCE_URL = "https://www.census.gov/naics/";

export type NaicsEntry = {
  code: string;
  title: string;
};

export const NAICS_2022_SECTORS: readonly NaicsEntry[] = [
  { code: "11", title: "Agriculture, Forestry, Fishing and Hunting" },
  { code: "21", title: "Mining, Quarrying, and Oil and Gas Extraction" },
  { code: "22", title: "Utilities" },
  { code: "23", title: "Construction" },
  { code: "31", title: "Manufacturing" },
  { code: "32", title: "Manufacturing" },
  { code: "33", title: "Manufacturing" },
  { code: "42", title: "Wholesale Trade" },
  { code: "44", title: "Retail Trade" },
  { code: "45", title: "Retail Trade" },
  { code: "48", title: "Transportation and Warehousing" },
  { code: "49", title: "Transportation and Warehousing" },
  { code: "51", title: "Information" },
  { code: "52", title: "Finance and Insurance" },
  { code: "53", title: "Real Estate and Rental and Leasing" },
  { code: "54", title: "Professional, Scientific, and Technical Services" },
  { code: "55", title: "Management of Companies and Enterprises" },
  {
    code: "56",
    title:
      "Administrative and Support and Waste Management and Remediation Services",
  },
  { code: "61", title: "Educational Services" },
  { code: "62", title: "Health Care and Social Assistance" },
  { code: "71", title: "Arts, Entertainment, and Recreation" },
  { code: "72", title: "Accommodation and Food Services" },
  { code: "81", title: "Other Services (except Public Administration)" },
  { code: "92", title: "Public Administration" },
];

export const NAICS_2022_SUBSECTORS: readonly NaicsEntry[] = [
  { code: "334", title: "Computer and Electronic Product Manufacturing" },
  { code: "423", title: "Merchant Wholesalers, Durable Goods" },
  { code: "484", title: "Truck Transportation" },
  { code: "488", title: "Support Activities for Transportation" },
  { code: "511", title: "Publishing Industries" },
  { code: "513", title: "Publishing Industries" },
  { code: "518", title: "Computing Infrastructure Providers, Data Processing, Web Hosting, and Related Services" },
  { code: "522", title: "Credit Intermediation and Related Activities" },
  { code: "524", title: "Insurance Carriers and Related Activities" },
  { code: "541", title: "Professional, Scientific, and Technical Services" },
  { code: "561", title: "Administrative and Support Services" },
  { code: "611", title: "Educational Services" },
  { code: "621", title: "Ambulatory Health Care Services" },
  { code: "622", title: "Hospitals" },
];
