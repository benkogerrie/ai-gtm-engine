import { defaultSleep, type NowFn, type SleepFn } from "./http";

/**
 * Serializes outbound calls and spaces them by `minIntervalMs`.
 * Default 1000ms matches Brave's documented 1-second sliding window
 * (https://api-dashboard.search.brave.com/documentation/guides/rate-limiting).
 * Exact current free-tier quota is UNVERIFIED (plans page is login-gated).
 */
export class SearchRateLimiter {
  private chain: Promise<void> = Promise.resolve();
  private nextAllowedAt = 0;

  constructor(
    private readonly minIntervalMs: number,
    private readonly sleepFn: SleepFn = defaultSleep,
    private readonly nowFn: NowFn = Date.now,
  ) {}

  schedule(): Promise<void> {
    const run = this.chain.then(async () => {
      const waitMs = Math.max(0, this.nextAllowedAt - this.nowFn());
      if (waitMs > 0) {
        await this.sleepFn(waitMs);
      }
      this.nextAllowedAt = this.nowFn() + this.minIntervalMs;
    });

    this.chain = run.catch(() => undefined);
    return run;
  }
}
