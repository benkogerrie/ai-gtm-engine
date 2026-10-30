import { headers } from "next/headers";
import { isPublicDemoMode } from "./demo-mode";

export type DemoRateAction = "discovery" | "icp" | "outreach_draft" | "intake";

export const DEMO_HOURLY_LIMIT_MESSAGE =
  "This demo allows a limited number of runs per hour from one network. Please try again later.";
export const DEMO_DAILY_LIMIT_MESSAGE =
  "The shared daily demo limit has been reached. Please try again tomorrow.";

const DEFAULT_PER_IP_PER_HOUR = 10;
const DEFAULT_DAILY_CAP = 60;
const HOUR_MS = 60 * 60 * 1000;

const hourlyCounts = new Map<string, { count: number; expiresAt: number }>();
const dailyCounts = new Map<string, { count: number; day: string }>();

export function demoMaxRunsPerDay(): number {
  const raw = Number(process.env.DEMO_MAX_RUNS_PER_DAY);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_DAILY_CAP;
}

export function demoMaxPerIpPerHour(): number {
  const raw = Number(process.env.DEMO_MAX_PER_IP_PER_HOUR);
  return Number.isFinite(raw) && raw > 0
    ? Math.floor(raw)
    : DEFAULT_PER_IP_PER_HOUR;
}

export function resetDemoRateLimitStore(): void {
  hourlyCounts.clear();
  dailyCounts.clear();
}

export function clientIpFromRequest(request: Request): string {
  return normalizeIp(
    request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      request.headers.get("cf-connecting-ip"),
  );
}

export async function readClientIp(): Promise<string> {
  try {
    const h = await headers();
    return normalizeIp(
      h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? h.get("cf-connecting-ip"),
    );
  } catch {
    return "unknown";
  }
}

function normalizeIp(raw: string | null): string {
  if (!raw) {
    return "unknown";
  }
  const first = raw.split(",")[0]?.trim();
  return first || "unknown";
}

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function prune(now: number): void {
  if (hourlyCounts.size + dailyCounts.size < 2_000) {
    return;
  }
  for (const [key, entry] of hourlyCounts) {
    if (entry.expiresAt <= now) {
      hourlyCounts.delete(key);
    }
  }
  const today = utcDay(now);
  for (const [key, entry] of dailyCounts) {
    if (entry.day !== today) {
      dailyCounts.delete(key);
    }
  }
}

export function checkDemoRateLimit(input: {
  action: DemoRateAction;
  ip: string;
  now?: number;
}): { ok: true } | { ok: false; error: string } {
  const now = input.now ?? Date.now();
  prune(now);

  const day = utcDay(now);
  const dailyKey = "global";
  const daily = dailyCounts.get(dailyKey);
  const dailyCount = daily && daily.day === day ? daily.count : 0;
  if (dailyCount >= demoMaxRunsPerDay()) {
    return { ok: false, error: DEMO_DAILY_LIMIT_MESSAGE };
  }

  const hourBucket = Math.floor(now / HOUR_MS);
  const hourlyKey = `${input.action}:${input.ip}:${hourBucket}`;
  const hourly = hourlyCounts.get(hourlyKey);
  const hourlyCount = hourly && hourly.expiresAt > now ? hourly.count : 0;
  if (hourlyCount >= demoMaxPerIpPerHour()) {
    return { ok: false, error: DEMO_HOURLY_LIMIT_MESSAGE };
  }

  hourlyCounts.set(hourlyKey, {
    count: hourlyCount + 1,
    expiresAt: (hourBucket + 1) * HOUR_MS,
  });
  dailyCounts.set(dailyKey, { count: dailyCount + 1, day });
  return { ok: true };
}

export function enforceDemoRateLimit(
  action: DemoRateAction,
  ip: string,
): { ok: true } | { ok: false; error: string } {
  if (!isPublicDemoMode()) {
    return { ok: true };
  }
  return checkDemoRateLimit({ action, ip });
}

export async function demoActionRateLimit(
  action: DemoRateAction,
): Promise<{ error: string } | null> {
  const result = enforceDemoRateLimit(action, await readClientIp());
  return result.ok ? null : { error: result.error };
}

export function demoRequestRateLimit(
  action: DemoRateAction,
  request: Request,
): { error: string } | null {
  const result = enforceDemoRateLimit(action, clientIpFromRequest(request));
  return result.ok ? null : { error: result.error };
}
