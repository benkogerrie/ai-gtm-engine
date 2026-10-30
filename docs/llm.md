# LLM provider layer

Provider-agnostic chat and structured JSON for the AI GTM Engine. The first implementation talks to DeepSeek over its OpenAI-compatible HTTP API.

## Why plain `fetch`

This layer uses the platform `fetch` plus Zod, not the Vercel AI SDK.

- Unit tests must mock `fetch` and assert exact retry / timeout / repair behavior.
- Retries are limited to HTTP 429 and 5xx. The AI SDK retry helpers are broader and harder to pin down in tests.
- The only new runtime dependency is Zod, which later ICP/schema work already needs.

Swap providers by implementing `LlmClient` (`chat` + `json`). Callers should depend on the interface, not on DeepSeek types.

## Environment

Copy `.env.example` to `.env.local`. Never commit a real key.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DEEPSEEK_API_KEY` | for live calls | — | Bearer token. Missing key throws `LlmMissingApiKeyError`. |
| `LLM_MODEL` | no | `deepseek-chat` | Model id sent to `/chat/completions`. |
| `LLM_BASE_URL` | no | `https://api.deepseek.com` | OpenAI-compatible base. `/chat/completions` is appended. |
| `LLM_TIMEOUT_MS` | no | `30000` | Per-attempt timeout. |
| `LLM_MAX_ATTEMPTS` | no | `3` | Total attempts, including the first. |

DeepSeek's current docs list `deepseek-flash` and `deepseek-v4-pro` as the active model ids. This layer keeps the task default `deepseek-chat`. If that alias is retired in your account, set `LLM_MODEL`.

## Usage

```ts
import { createDeepSeekLlmClient, createLlmClient, createMockLlmClient } from "@/lib/llm";
import { z } from "zod";

const client = createDeepSeekLlmClient();
const chat = await client.chat([{ role: "user", content: "Summarize this ICP." }]);

const schema = z.object({ name: z.string(), score: z.number() });
const structured = await client.json(schema, [
  { role: "user", content: "Return the ICP as JSON." },
]);

// Tests / local without a key:
const mock = createMockLlmClient({ chatContent: "ok", jsonValue: { name: "ACME", score: 80 } });
const fallback = createLlmClient({ allowMockIfUnconfigured: true });
```

`createLlmClient()` and `createDeepSeekLlmClient()` fail closed when `DEEPSEEK_API_KEY` is missing. Pass `allowMockIfUnconfigured: true` only when a fake client is acceptable.

Each call returns token usage (`promptTokens`, `completionTokens`, `totalTokens`), `latencyMs`, and an `usageRecord` that later tasks can persist. Costs are not computed here.

## Reliability

- Timeout via `AbortController` (typed `LlmTimeoutError`). Timeouts are not retried.
- Retry with exponential backoff (200ms, 400ms, … capped at 2s) on **429 and 5xx only**.
- Other 4xx errors fail immediately (`LlmHttpError`).

## Structured output

`json()` sends `response_format: { type: "json_object" }`, parses the content with `JSON.parse`, then validates with the given Zod schema. One repair turn is sent if parsing or validation fails. A second failure throws `LlmInvalidJsonError`. There is no silent default object.

## Health

`GET /api/llm/health` returns `{ configured, model }` from env only. It awaits Next.js `connection()` so the flag is read at request time, does not call DeepSeek, and never returns the key.

## Live smoke

`pnpm test:live` runs `src/lib/llm/deepseek.live.test.ts`. It skips cleanly when `DEEPSEEK_API_KEY` is unset. It is excluded from `pnpm test` and from CI.

## Pricing (not applied)

Official price list: https://api-docs.deepseek.com/quick_start/pricing

This layer does **not** hardcode a USD cost. DeepSeek prices vary by model, cache hit/miss, and peak vs off-peak windows. `deepseek-chat` is not listed on that page as of 2026-10-30 (listed models: `deepseek-flash`, `deepseek-v4-pro`). Any future price table should cite that URL and mark unverified rows as `UNVERIFIED`.
