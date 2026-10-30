# Signal-grounded outreach and approval gate

B008 drafts a personalized email plus a short LinkedIn message from **cited** company signals, then blocks any dry-run completion until a human approves.

Demo target: **ShiftPilot** (AI shift scheduling for hospitals) → a labeled hospital prospect with cited signals → draft → approve / edit / reject → **Send (dry run)** only. There is no real send path.

## Flow

1. Sign in at `/login` with `APP_API_TOKEN` (B003 cookie session). Org and actor stay server-side.
2. Open `/outreach`. Seed **TEST — Example General Hospital** if the list is empty (`pnpm db:seed:demo` or Seed TEST company).
3. Draft from a company id. Dedicated entry for later `/prospects` links: `/outreach/new?companyId=<uuid>` (the **Draft outreach** button). Tone: `professional | friendly | direct`. CTA: `book a call | reply | learn more`.
4. If the company has no citation-backed signal or claim, drafting is refused.
5. Review `/outreach/[id]`: edit, regenerate, **Approve** / **Reject**, then **Send (dry run)** only when status is `APPROVED`.

Dry-run records `DRY_RUN_COMPLETED`, leaves `sentAt` empty, and contacts nobody.

## Evidence rule

Only FieldAssertions that already have a `sourceUrl` citation count as cited signals/claims. The model is told those facts only. Returned `sourceUrls` are intersected with the provided citation URLs.

B004 (live discovery) may later persist real Company + Citation rows and use migration `0003`. This slice adds no migration; if one is required later it must be `0004_*`.

## LLM

- `LlmClient.json` + Zod (`src/lib/outreach/normalize.ts`). The prompt includes a filled example object and literal enum values (`src/lib/outreach/prompts/v1.ts`).
- Seller product is always ShiftPilot. Tolerant alias normalization, then one repair (DeepSeek client).
- No `DEEPSEEK_API_KEY` → labeled **MOCK** client.

## Persistence

Reuses the B002 `outreach` + `outreach_approvals` tables. Extra draft fields (LinkedIn copy, tone, CTA, source URLs, cited signals, mock/live) live in `variant` as JSON. No new migration.

Legal transitions stay B002: `DRAFT → PENDING_APPROVAL → APPROVED → DRY_RUN_COMPLETED`. Approve from DRAFT does the pending hop internally. Approve / reject / dry-run require `actorType: "human"`.

## Auth

Pages: session cookie or redirect to `/login`. Mutations check auth + org. Unauthenticated API calls return **401**. Send without `APPROVED` returns **400** `OUTREACH_NOT_APPROVED`.

## Demo data

One hospital prospect: `TEST — Example General Hospital`, domain `example.com`, citation `https://example.com`, job-posting signal about night-shift scheduling. Visibly marked TEST/MOCK. No fabricated people or emails. B004 can replace this row with a live hospital + real citations.

## Tests

`pnpm test` covers no-citation refuse, approval gate, reject, edit audit, dry-run completion, 401/redirect, and messy LLM normalization.

`pnpm test:live` drafts once against DeepSeek when `DEEPSEEK_API_KEY` is set.
