export const PAGE_TIMEOUT_MS = 8_000;
export const PAGE_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);
export const MAX_REDIRECTS = 3;
export const MAX_PAGES = 3;
export const MAX_PAGE_TEXT_CHARS = 8_000;
export const MAX_TOTAL_TEXT_CHARS = 16_000;

export const PREFERRED_EXTRA_PATHS = [
  "/about",
  "/about-us",
  "/product",
  "/products",
  "/solutions",
  "/pricing",
] as const;

export const SITE_READER_USER_AGENT = "SeedToSagaSiteReader/1.0";
