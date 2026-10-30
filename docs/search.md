# Web search provider layer

Provider-agnostic web search for the AI GTM Engine. The first implementation talks to the [Brave Search API](https://api-dashboard.search.brave.com/documentation/services/web-search) over plain `fetch`.

Search hits are **evidence candidates**. They can later become Citations in the B002 evidence ledger. A result is never VERIFIED by itself.

## Why plain `fetch`

This layer uses the platform `fetch`, not a Brave SDK.

- Unit tests mock `fetch` and assert mapping, retry, timeout, and de-duplication.
- Retries are limited to HTTP 429 and 5xx, and honor `Retry-After`.
- No extra runtime dependency.

Swap providers by implementing `SearchClient`. Callers should depend on the interface, not on Brave types.

## Environment

Copy `.env.example` to `.env.local`. Never commit a real key.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `BRAVE_SEARCH_API_KEY` | for live calls | — | Sent as `X-Subscription-Token`. Missing key throws `SearchMissingApiKeyError`. |

Optional overrides (constructor or env): `SEARCH_TIMEOUT_MS` (15000), `SEARCH_MAX_ATTEMPTS` (3), `SEARCH_MIN_INTERVAL_MS` (1000).

## Usage

```ts
import {
  createBraveSearchClient,
  createMockSearchClient,
  createSearchClient,
} from "@/lib/search";

const client = createBraveSearchClient();
const results = await client.search("mid-market HRIS competitors", {
  count: 10,
  offset: 0,
  country: "US",
  freshness: "pm",
});

// Tests / local without a key:
const mock = createMockSearchClient();
const fallback = createSearchClient({ allowMockIfUnconfigured: true });
```

`createSearchClient()` and `createBraveSearchClient()` fail closed when `BRAVE_SEARCH_API_KEY` is missing. Pass `allowMockIfUnconfigured: true` only when a fake client is acceptable.

Each result is `{ title, url, snippet, publishedAt?, source, retrievedAt }`. Brave hits use `source: "brave"`. The mock client always stamps `source: "mock"` (even if a fixture claimed `"brave"`). `retrievedAt` is set at fetch time.

Only `source: "brave"` may become a citation. Use `isRealSearchEvidence` / `toCitationCandidate` — mock hits are rejected (`SearchSyntheticEvidenceError`) and must never be persisted as Brave evidence.

## Brave request

- Endpoint: `GET https://api.search.brave.com/res/v1/web/search`
- Auth: `X-Subscription-Token` ([authentication guide](https://api-dashboard.search.brave.com/documentation/guides/authentication))
- Query params used here: `q`, `count` (1–20), `offset` (0–9, page offset), `country`, `freshness`
- Mapped fields: `web.results[].title`, `.url`, `.description` → `snippet`, `.page_age` → `publishedAt` when parseable

Docs cited while implementing:

- https://api-dashboard.search.brave.com/documentation/services/web-search
- https://api-dashboard.search.brave.com/api-reference/web/search/post
- https://api-dashboard.search.brave.com/documentation/guides/rate-limiting

The OpenAPI reference lists POST; official service examples use GET with query params. This client uses GET.

## Reliability

- Timeout via `AbortController` (typed `SearchTimeoutError`). Timeouts are not retried.
- Retry with exponential backoff (200ms, 400ms, … capped at 2s) on **429 and 5xx only**.
- `Retry-After` (delta-seconds or HTTP-date) is honored when present.
- Other 4xx errors fail immediately (`SearchHttpError`).
- Client-side rate limit: serialize calls and wait ≥1s between them.

### Rate limit note (UNVERIFIED free-tier quota)

Brave documents a **1-second sliding window** and example headers of `X-RateLimit-Limit: 1, 15000` (1 req/s). The public [plans](https://api-dashboard.search.brave.com/app/plans) page is login-gated, so the exact current free-tier monthly quota is **UNVERIFIED**. This layer defaults to 1 req/s as a conservative client-side floor.

## URL normalization

Results are de-duplicated after normalizing URLs: lowercase host, drop default ports and fragments, strip a trailing slash (except `/`), drop common `utm_*` params. Invalid or non-http(s) URLs are dropped.

## Health

`GET /api/search/health` returns `{ configured, provider }` from env only. It awaits Next.js `connection()` so the flag is read at request time, does not call Brave, and never returns the key.

## Live smoke

`pnpm test:live` runs `src/**/*.live.test.ts` via `vitest.live.config.mts`. The Brave smoke (`src/lib/search/brave.live.test.ts`) skips cleanly when `BRAVE_SEARCH_API_KEY` is unset. Live tests are excluded from `pnpm test` and from CI.

**Merge note:** parallel PR #4 (`b003a-llm-layer`) also adds `vitest.live.config.mts` and a `test:live` script. The intended merged file includes `src/**/*.live.test.ts` (both LLM and search smokes). Expect a trivial content conflict if both land; keep the broader include glob.
