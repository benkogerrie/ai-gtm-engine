# Live discovery

Evidence-backed prospect discovery for the AI GTM Engine. From an approved ICP (or a standalone form), the engine builds Brave queries that look for **named buyer organizations**, extracts companies **only** from returned hits, drops unsupported claims, and persists `Company` + `Citation` + `FieldAssertion` rows through the B002 repository.

`DiscoveryInput` stays a small adapter shape. B003 maps onto it via `discoveryInputFromIcp` (`src/lib/discovery/adapter.ts`): industries + NAICS names, headcount labels, persona titles, trigger summaries, and the product description.

## Pipeline

1. Build 3–6 deterministic Brave queries aimed at concrete orgs (hospitals announcing staffing / scheduling / EHR changes). Healthcare ICPs get a hospital/health-system pack and `-best -top -listicle` exclusions.
2. Search via `SearchClient`. The Brave client already serializes calls through `SearchRateLimiter` (~1 req/s).
3. **LIVE** (`BRAVE` + DeepSeek): extract + score with DeepSeek. The prompt includes a concrete JSON example and B003-style normalization. If that call fails, the run **fails** — no silent heuristic fallback. **MOCK**: heuristic extract/score only, labeled in the UI.
4. Names are **organization names** (Ochsner Health, UCHealth), never article titles. A `news.ochsner.org` or PR Newswire URL is a citation for the hospital in the article.
5. Each candidate is classified `buyer | vendor_competitor | media_research`. Only buyers become prospects. Vendors are routed to competitor categories. Media/research (PubMed, newswires as the subject) are dropped. Dedupe is by organization, not URL.
6. Server-side validation drops claims whose URL is not in the result set, then drops companies with no remaining claim. HTML tags/entities are stripped from names, rationales, and snippets.
7. Negative filters: aggregators / listicles / directories (Wikipedia, LinkedIn lists, G2, Crunchbase hubs), `excludeDomains`.
8. Fit score `0..100` with a rationale grounded in the cited signal (DeepSeek on LIVE).
9. Persist companies, citations, and field assertions with audit events. Claims are stored as `INFERRED`.
10. Competitor categories need a real, relevant citation (junk hosts like wpauthorbox / simplescheduleai are dropped).

Demo ICP: **ShiftPilot** (AI shift scheduling for hospitals/clinics) → US hospitals and health systems.

## Mock vs live

The run is labeled **LIVE** or **MOCK** in the UI, plus the extraction/scoring path (`DeepSeek` vs heuristic). MOCK when the search provider is `mock` **or** the LLM is missing/mock. Mock search hits never become citations (`toCitationCandidate` / `isRealSearchEvidence`).

Live mode needs `BRAVE_SEARCH_API_KEY` and `DEEPSEEK_API_KEY`. `pnpm test:live` includes `src/lib/discovery/discovery.live.test.ts` (skipped without both keys).

## Persistence (no new table)

No `0003_*` migration. Run snapshots live in `audit_events.after` (`discovery.run.*`, `entityId = runId`) and carry optional `icpId` so `/prospects?icp=` can filter. Companies and evidence still go through the existing repository.

## Auth

- API `POST/GET /api/discovery/runs` still use `getAuthContext` (bearer `APP_API_TOKEN` or the session cookie). **401** without either.
- `/prospects` and discovery server actions use `getDiscoveryPageAuth` → B003 `getPageAuth` (`src/lib/session.ts`). Unauthenticated users redirect to `/login?next=…`. `src/proxy.ts` also gates `/prospects`.

## UI

- `/login` → `/intake` → `/icp/[id]`. When the ICP is **APPROVED**, **Find prospects** builds `DiscoveryInput` from that ICP and starts a run.
- Results land on `/prospects?icp=<id>&runId=<run>`.
- Each persisted buyer has a **Draft outreach** link to `/outreach/new?companyId=`. Real (non-TEST) companies use live DeepSeek and never get a MOCK label.
- `/prospects` also has a manual ShiftPilot-prefilled form.

## Tests

Unit (no network): query building (hospital org queries, not listicles), ICP adapter, claim-URL validation, negative filters, dedupe, MOCK labeling, API 401, page auth via session cookie.

Live: ShiftPilot-style ICP, `>= 3` companies each with `>= 1` real `https` citation.
