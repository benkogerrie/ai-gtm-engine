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

Open [http://localhost:3000](http://localhost:3000). Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health).

`.env.example` lists empty, commented placeholders for future integrations (LLM provider, Tavily, Serper, Neo4j / Kùzu, Hunter, Apollo, SendGrid, Flexprice). Do not put real secrets in the repository.

## Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `pnpm dev` | Next.js development server |
| `build` | `pnpm build` | Production build |
| `start` | `pnpm start` | Serve the production build |
| `lint` | `pnpm lint` | ESLint |
| `typecheck` | `pnpm typecheck` | `tsc --noEmit` |
| `test` | `pnpm test` | Vitest (single run) |

## CI

`.github/workflows/ci.yml` runs on every `push` and `pull_request`:

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm test`
5. `pnpm build`

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
