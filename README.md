# AI GTM Engine

Standalone closed-loop go-to-market engine for early-stage and mid-market B2B teams. It turns a plain-language product description into a scored ICP, evidence-backed discovery, a living knowledge graph, verified multi-channel outreach with a human approval gate, and a unified pipeline dashboard.

This repository is a **completely independent** application. It does not share code, branding, secrets, or data with any other product.

## Stack

- [Next.js](https://nextjs.org) App Router
- TypeScript (strict)
- Tailwind CSS
- Radix / [shadcn/ui](https://ui.shadcn.com)-ready (`components.json`, `cn()` helper)
- pnpm
- Vitest + Testing Library
- GitHub Actions CI
- Drizzle ORM + Postgres (PGlite in-process when `DATABASE_URL` is empty)

## Prerequisites

- Node.js 22 (see `.nvmrc`; Node 20 LTS also satisfies `engines`)
- [pnpm](https://pnpm.io) 10+

## Local setup

```bash
git clone https://github.com/benkogerrie/ai-gtm-engine.git
cd ai-gtm-engine
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health). Search provider health (env only, no Brave call): [http://localhost:3000/api/search/health](http://localhost:3000/api/search/health). LLM provider health: [http://localhost:3000/api/llm/health](http://localhost:3000/api/llm/health).

`.env.example` lists empty placeholders. `DATABASE_URL=` is intentionally blank so local/dev/test use in-process [PGlite](https://pglite.dev) (no Docker, no secrets). Set `DATABASE_URL` later for a real Postgres (for example on Vercel). Optional `PGLITE_DATA_DIR` overrides the default `.pglite/` data directory used by `pnpm db:migrate`.

Data APIs (`/api/products`, `/api/companies/*`, `/api/citations`, `/api/audit`, `/api/discovery/runs`) require `Authorization: Bearer $APP_API_TOKEN` unless public demo mode is on. Org and actor are mapped server-side from `APP_ORG_ID` / `APP_ACTOR_ID` / `APP_ACTOR_TYPE` — never from the request. Leave those placeholders empty in the repo. `/api/health` stays public.

**Public demo:** set `PUBLIC_DEMO_MODE=true` to skip the token/login gate and map every request to the server org / demo actor. Unset defaults to **on** for Vercel Preview (`VERCEL_ENV=preview`) so judges can open `/intake` without a key. `PUBLIC_DEMO_MODE=false` keeps the existing token auth. Expensive actions (intake/ICP, discovery, outreach draft) are rate-limited (`DEMO_MAX_RUNS_PER_DAY`, default 60, plus ~10 per IP per hour). Outreach stays dry-run only.

Do not put real secrets in the repository.

## Docs

Start here for judges and new contributors. Slice docs stay the source of truth for that layer.

| Doc | Scope |
| --- | --- |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System map: request path, auth, evidence rules, modules, HTTP surfaces |
| [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md) | ShiftPilot judge walkthrough (LIVE and MOCK) |
| [docs/domain-model.md](./docs/domain-model.md) | Entities, ER diagram, verification, HITL outreach states |
| [docs/icp-engine.md](./docs/icp-engine.md) | Product intake and ICP review (`/login`, `/intake`, `/icp/[id]`) |
| [docs/discovery.md](./docs/discovery.md) | Live Brave discovery (`/prospects`) |
| [docs/outreach.md](./docs/outreach.md) | Citation-grounded drafts and the approval gate (`/outreach`) |
| [docs/llm.md](./docs/llm.md) | DeepSeek `LlmClient` (plain `fetch`, retries, health) |
| [docs/search.md](./docs/search.md) | Brave `SearchClient` and the synthetic-evidence guard |

## Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `pnpm dev` | Next.js development server |
| `build` | `pnpm build` | Production build |
| `start` | `pnpm start` | Serve the production build |
| `lint` | `pnpm lint` | ESLint |
| `typecheck` | `pnpm typecheck` | `tsc --noEmit` |
| `test` | `pnpm test` | Vitest (single run; excludes live smoke) |
| `test:live` | `pnpm test:live` | Optional DeepSeek / Brave smoke; skips when the matching API key is unset |
| `db:generate` | `pnpm db:generate` | Create a Drizzle SQL migration from `src/db/schema.ts` |
| `db:migrate` | `pnpm db:migrate` | Apply committed migrations (PGlite if `DATABASE_URL` is empty) |
| `db:seed` | `pnpm db:seed` | Insert clearly labeled EXAMPLE data only |
| `db:seed:demo` | `pnpm db:seed:demo` | Insert one labeled TEST hospital prospect (`example.com`) for ShiftPilot outreach |

## CI

`.github/workflows/ci.yml` runs on every `push` and `pull_request`:

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm test`
5. `pnpm build`

## Deploy

Preview deployments are created automatically by [Vercel](https://vercel.com)’s GitHub integration for every pull-request branch. Opening or updating a PR is enough; do not run `vercel` CLI deploy commands from this repository.

There is **no production deploy** until a merge to `main` is approved. Preview functions without `DATABASE_URL` boot an empty in-memory PGlite database (non-persistent). Do not configure Vercel secrets from this repository.

## Roadmap

| ID | Scope |
| --- | --- |
| **B001** | Public-ready repo skeleton, hello-world UI, health API, tests, CI |
| **B002** | Domain model and evidence ledger |
| **B003** | Intake and ICP engine |
| **B004** | Discovery and competitors |
| **B005** | Scoring and tiers |
| **B006** | Knowledge graph |
| **B007** | Enrichment with verification |
| **B008** | Outreach + HITL approval gate |
| **B009** | Kanban and analytics |
| **B010** | Band Desktop bonus |
| **B011** | Flexprice and Snyk bonuses |
| **B012** | End-to-end validation and submission |

## License

[MIT](./LICENSE)
