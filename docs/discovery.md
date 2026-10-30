# Live discovery

Evidence-backed prospect discovery for the AI GTM Engine. From a standalone ICP slice, the engine builds Brave queries, extracts companies **only** from returned hits, drops unsupported claims, and persists `Company` + `Citation` + `FieldAssertion` rows through the B002 repository.

This slice does **not** import B003 intake/ICP (that work lands on `b003-intake-icp`). `DiscoveryInput` is a tiny adapter-friendly shape: `productSummary`, `industries[]`, plus optional `companySizes`, `geographies`, `personas`, `triggers`, `excludeDomains`.

## Pipeline

1. Build 3–6 deterministic Brave queries (optional LLM refine when a live LLM is configured).
2. Search via `SearchClient`. The Brave client already serializes calls through `SearchRateLimiter` (~1 req/s).
3. Extract candidate companies from those results (LLM when available, plus a deterministic title/domain fallback). Every claim must cite a result URL from **this** run.
4. Server-side validation drops claims whose URL is not in the result set, then drops companies with no remaining claim.
5. Negative filters: aggregators / listicles / directories (Wikipedia, LinkedIn lists, G2, Crunchbase hubs, news-roundup hosts), the seller `excludeDomains`, and the user's own domain.
6. Deduplicate by registrable domain.
7. Fit score `0..100` with a short rationale (light heuristic; B005 owns full scoring).
8. Persist companies, citations, and field assertions with audit events. Claims are stored as `INFERRED` (a URL is necessary but not sufficient for `VERIFIED`).
9. Separate competitor-category step, also citation-required.

## Mock vs live

The run is labeled **MOCK** when the search provider is `mock` **or** no live LLM key is configured (`DEEPSEEK_API_KEY`). Mock search hits never become citations (`toCitationCandidate` / `isRealSearchEvidence`). The engine does not fabricate companies, URLs, or signals: a MOCK search run persists no citations and shows an empty prospect table plus a MOCK badge.

Live mode needs `BRAVE_SEARCH_API_KEY` and `DEEPSEEK_API_KEY`. `pnpm test:live` includes `src/lib/discovery/discovery.live.test.ts` (skipped without both keys). Do not run live tests in CI.

## Persistence (no new table)

No schema migration. Shared Neon already applies B002 + B003 `0002_icp_engine.sql`. Discovery run snapshots are stored in `audit_events.after` with actions `discovery.run.started|completed|failed` and `entityId = runId` (entity type `organization`). Companies and evidence still go through the existing repository.

## API

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/discovery/runs` | `Authorization: Bearer $APP_API_TOKEN` via `getAuthContext` (401 without token) |
| GET | `/api/discovery/runs/[id]` | same |

Org and actor come only from `APP_ORG_ID` / `APP_ACTOR_*`. Body `orgId` is ignored.

## UI

`/prospects` — product summary + industries + geography form, prospect table (fit score, rationale, signals, clickable source URLs), run status, MOCK badge.

Page auth lives in **one helper**: `src/lib/discovery/page-auth.ts` (`getDiscoveryPageAuth`). It uses `APP_*` env (no login page). After B003 cookie login (`/login`, `src/lib/session.ts`) merges, swap that helper only.

## Tests

Unit (no network): query building, claim-URL validation, negative filters, domain dedupe, MOCK labeling, API 401.

Live: `pnpm test:live` — sample HRIS ICP, `>= 3` companies each with `>= 1` real `https` citation.
