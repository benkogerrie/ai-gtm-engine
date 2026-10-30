# Demo script

Judge walkthrough for the AI GTM Engine. The closed loop is:

**ShiftPilot intake → approve ICP → cited hospital prospects → outreach draft → human approval → Send (dry run) → dashboard.**

There is no real send. Nobody is emailed or messaged. Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Modes

| Mode | Keys | What you should see |
| --- | --- | --- |
| **LIVE** | `DEEPSEEK_API_KEY` + `BRAVE_SEARCH_API_KEY` | Green **LIVE** badge, DeepSeek extraction/scoring, real `https` citations, drafts **without** a MOCK / TEST sign-off on real companies |
| **MOCK** | keys unset | Amber **MOCK output** banners, heuristic discovery, labeled TEST copy. Still walkable; do not treat mock hits as evidence |

LIVE is the intended judge path. MOCK is a labeled fallback so the UI still works without secrets.

## Setup (once)

```bash
git clone https://github.com/benkogerrie/ai-gtm-engine.git
cd ai-gtm-engine
pnpm install
cp .env.example .env.local
```

In `.env.local` set at least:

```bash
APP_API_TOKEN=<any long random string>
APP_ORG_ID=11111111-1111-4111-8111-111111111111
APP_ACTOR_ID=judge
APP_ACTOR_TYPE=human
```

Leave `DATABASE_URL=` empty (in-process PGlite). For LIVE also set `DEEPSEEK_API_KEY` and `BRAVE_SEARCH_API_KEY`. Do not commit those values.

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Optional health:

- [http://localhost:3000/api/health](http://localhost:3000/api/health)
- [http://localhost:3000/api/llm/health](http://localhost:3000/api/llm/health) — `{ configured: true }` when DeepSeek is set
- [http://localhost:3000/api/search/health](http://localhost:3000/api/search/health) — `{ configured: true }` when Brave is set

A Vercel preview of this branch is equivalent: sign in with the preview `APP_API_TOKEN`. Preview uses Postgres via `DATABASE_URL` (Neon), not in-memory PGlite.

## Sample copy (ShiftPilot)

Use this on `/intake` so discovery queries hospitals, not a generic industry:

| Field | Value |
| --- | --- |
| Product name | `ShiftPilot` |
| Short description | `AI shift scheduling for hospitals and clinics that need nurse staffing coverage` |
| Features | `shift scheduling, overtime reduction, nurse staffing coverage` |
| Capabilities | `AI rostering for night-shift and float-pool teams` |

Free text is optional. The prospects form is prefilled with the same product summary if you start discovery by hand.

## Happy path (LIVE)

Nav is **Intake · ICP · Prospects · Outreach · Dashboard** on every gated page.

### 1. Sign in — `/login`

1. Open `/intake` (or click **Intake** on the home page). You are redirected to `/login?next=/intake`.
2. Paste `APP_API_TOKEN`. Org and actor stay on the server.
3. You land on `/intake`.

Expect: no org id, actor id, or secret in the page source.

### 2. Intake — `/intake`

1. Optional: paste a public product website and click **Read my site**. Wait for **Reading your site…**. Review the prefilled fields (INFERRED / suggested from the host). Pages read appear as links. Fields the site did not support stay empty and are highlighted yellow (**Nog invullen · Needs input**) until you type. If the reader fails, the form stays usable — fill ShiftPilot by hand.
2. Fill or correct the ShiftPilot fields above. Submit.
3. The engine calls DeepSeek, validates JSON, and redirects to `/icp/<id>`.

Expect: no **MOCK output** banner when the key is set. Site autofill also says **MOCK** when DeepSeek is unset. If inference fails (invalid JSON after one repair), you stay on intake with an error — nothing is silently accepted.

### 3. Approve the ICP — `/icp/<id>`

1. Review industries (hospitals / health systems), size bands, personas, triggers. Each field shows a confidence badge and **INFERRED**.
2. Optional: edit the name, accept / adjust / dismiss expansion suggestions.
3. Click **Approve ICP**. Status becomes `APPROVED`.
4. Click **Find prospects**.

Expect: inferred fields are never labeled **VERIFIED**. Approve is an explicit human action (`icp.approve` audit).

### 4. Discovery — `/prospects?icp=<id>&runId=<run>`

1. Wait for the run (Brave is rate-limited to ~1 req/s; budget about a minute).
2. Confirm the **LIVE** badge and `Path: DeepSeek extraction + scoring`.
3. Confirm **≥ 3** distinct **organization** names — not article titles or “Top 10 hospitals” listicles. Results vary per live run; a recent run returned Mercy, HCA Healthcare, and Nebraska Methodist Health System.
4. Each row has a fit score (**INFERRED**), a rationale (**INFERRED**), and at least one `https` source. Labels: **VERIFIED** = backed by a real, retrieved, cited source URL — not independently verified by a human or a second source; claim text is extracted by DeepSeek; a URL and timestamp do not by themselves prove the claim is true. **INFERRED** = model judgement without a source treated as proof (fit score, rationale, ICP fields). **source-candidate** = a hit or claim whose URL is not among the verified retrieved results.
5. Duplicates of the same system (HCA-style) collapse to one org with aggregated evidence.

Expect: vendor/competitor names and media/research subjects are not in the buyer table. MOCK search hits never appear as citations.

### 5. Draft outreach — `/outreach/new?companyId=<uuid>`

1. On a real hospital row click **Draft outreach** (same control on `/dashboard`).
2. Choose tone (`professional` / `friendly` / `direct`) and CTA (`book a call` / `reply` / `learn more`) if offered; submit.
3. Open `/outreach/<id>`.

Expect: email subject + body and a short LinkedIn message that mention a **cited** staffing / scheduling signal and a source URL that appears on the prospect. No `(labeled TEST draft)` sign-off. No invented contact names or emails. If the company has no cited signal, drafting is refused.

### 6. Human gate — same draft page

1. Optional: edit subject/body/LinkedIn and save, or regenerate tone + CTA.
2. Click **Approve**. Status → `APPROVED`.
3. **Send (dry run)** is enabled only now. Click it.

Expect: status → `DRY_RUN_COMPLETED`. `sentAt` stays empty. The hospital is not contacted. **Send (dry run)** stays disabled on `DRAFT` / `PENDING_APPROVAL`. **Reject** is terminal.

### 7. Dashboard — `/dashboard`

1. Confirm the selected ICP and the latest completed run (id, timestamp, org count). Older completed runs stay selectable.
2. Prospect table: one row per organization, same evidence labels, **Draft outreach**.
3. Pipeline board: the hospital you just dry-ran sits in **Dry-run sent**. Counts per stage and per channel (email / LinkedIn) match the cards.
4. Optional: move a card to **Replied** / **Meeting booked** / **Closed/Lost**. The card shows `manual` + actor + timestamp.

Expect: you cannot move a card into **Approved** or **Dry-run sent** without the matching record. Manual stages (Replied / Meeting booked / Closed/Lost) are human-asserted and audited with actor + timestamp; they are not system-verified.

## Fallback when keys are missing

The loop still works; treat everything as labeled fixture data.

1. Sign in and submit ShiftPilot intake. Expect **MOCK output** on `/intake` and `/icp/<id>`. Approve anyway.
2. **Find prospects** runs the heuristic path (`Path: heuristic (MOCK)`). Results are not live evidence.
3. Or skip discovery: open `/outreach` → **Seed TEST company** (or `pnpm db:seed:demo`). That inserts **TEST — Example General Hospital** (`example.com`, citation `https://example.com`, night-shift job-posting signal).
4. Draft → Approve → **Send (dry run)**. The draft is marked TEST / MOCK.
5. Dashboard will be empty of live orgs unless a MOCK discovery run completed; the TEST hospital is an outreach seed, not a discovery prospect.

## What is not a bug

- Local data lives in PGlite only while `DATABASE_URL` is unset (default `.pglite/` on disk). Vercel Preview uses Postgres (Neon) via `DATABASE_URL`.
- Discovery taking ~30–60s (Brave at most 1 req/s × several queries + DeepSeek extract/score).
- Peripheral-only evidence (nursing/hospital mention without scheduling or staffing operations) is capped at a fit score of **54**.
- **Knowledge Graph** on the home page still **Coming soon** (B006). `relationship_edges` exist in Postgres only.
- No real email, LinkedIn, or SMS send. `SENT` is a domain state; the UI only offers dry-run.
- `pnpm test:live` skipping in CI or this environment when keys are unset.

## Known limitations

- If Brave is configured but DeepSeek is not, a heuristic **MOCK** discovery run may still persist prospects (`src/lib/discovery/pipeline.ts` ~L300). Tracked as follow-up; not fixed during freeze.

## Timing

| Segment | LIVE | MOCK |
| --- | --- | --- |
| Login + intake + approve | ~2 min | ~2 min |
| Discovery run | ~1 min | seconds |
| Draft + approve + dry-run | ~2 min | ~2 min |
| Dashboard review | ~1 min | ~1 min |
