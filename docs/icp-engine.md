# Product intake and ICP engine

B003 turns a founder’s product description into a draft Ideal Customer Profile that a human can edit, expand, and approve.

## Flow

1. Sign in at `/login` with `APP_API_TOKEN`. The server compares the token in constant time and sets a signed httpOnly cookie. Org and actor come only from `APP_ORG_ID` / `APP_ACTOR_*` — never from the browser.
2. Submit a product on `/intake` (structured fields plus optional free text).
3. `LlmClient.json` returns a typed ICP. One repair retry is allowed. Invalid JSON is rejected; nothing is silently accepted.
4. Review on `/icp/[id]`: confidence badges, inline name edit, accept / adjust / dismiss expansions, **Approve**.

Inferred fields are always `INFERRED`. They are never written as `VERIFIED`.

## Schemas

- Intake and LLM output: `src/domain/intake.ts`
- Persisted Product / ICP rows: B002 tables plus `version`, `parentIcpId`, `approvedAt`, `approvedBy`, `inferenceMode`, `structured` (`drizzle/0002_icp_engine.sql`)

Every inferred object carries `confidence` in `0.00–1.00` and `status: "INFERRED"`.

## Inference

- Prompts: `src/lib/icp/prompts/v1.ts` (`ICP_PROMPT_VERSION = "v1"`)
- Client: DeepSeek when `DEEPSEEK_API_KEY` is set; otherwise the mock client (`allowMockIfUnconfigured` path via `createIcpLlmClient`)
- The UI labels mock results as **MOCK output**

## NAICS

Codes must be 2–6 digits. They are checked against a small committed NAICS 2022 sector/subsector list in `src/lib/icp/naics-2022.ts`, sourced from [census.gov/naics](https://www.census.gov/naics/). Unknown codes are flagged (`known: false`), not replaced with a guessed code.

## Approval and expansions

- Draft → Approved is an explicit user action (`icp.approve` audit event).
- An edit after approval creates a new DRAFT version (`version + 1`, `parentIcpId`).
- Each expansion suggestion stores `decision`, `decidedBy`, `decidedAt`, and an optional note.

## Tests

`pnpm test` covers schema bounds, mock inference + repair failure, NAICS, state transitions, cross-org denial, session cookies, and the review screen.

`pnpm test:live` runs one real DeepSeek inference when `DEEPSEEK_API_KEY` is set. CI does not run it.
