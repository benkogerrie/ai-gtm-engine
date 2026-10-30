import { uuidSchema, type MutationActor } from "@/domain";

/** Same fallback org seed-demo uses when APP_ORG_ID is unset. */
export const DEMO_FALLBACK_ORG_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_ACTOR_ID = "demo-judge";

function truthy(value: string): boolean {
  return value === "true" || value === "1" || value === "on" || value === "yes";
}

function falsy(value: string): boolean {
  return value === "false" || value === "0" || value === "off" || value === "no";
}

/**
 * Public demo: pages and APIs skip the bearer token / login cookie and map
 * to the server-configured org. Explicit PUBLIC_DEMO_MODE wins. Unset
 * defaults to ON on Vercel Preview so judges need no dashboard env change.
 * Tests stay off unless PUBLIC_DEMO_MODE is set.
 */
export function resolvePublicDemoMode(env: {
  PUBLIC_DEMO_MODE?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
}): boolean {
  const raw = env.PUBLIC_DEMO_MODE?.trim().toLowerCase();
  if (raw && truthy(raw)) {
    return true;
  }
  if (raw && falsy(raw)) {
    return false;
  }
  if (env.NODE_ENV === "test") {
    return false;
  }
  return env.VERCEL_ENV === "preview";
}

export function isPublicDemoMode(): boolean {
  return resolvePublicDemoMode({
    PUBLIC_DEMO_MODE: process.env.PUBLIC_DEMO_MODE,
    VERCEL_ENV: process.env.VERCEL_ENV,
    NODE_ENV: process.env.NODE_ENV,
  });
}

export function readDemoAuth(): {
  orgId: string;
  actor: MutationActor;
} | null {
  if (!isPublicDemoMode()) {
    return null;
  }
  const configured = process.env.APP_ORG_ID?.trim();
  const orgId =
    configured && uuidSchema.safeParse(configured).success
      ? configured
      : DEMO_FALLBACK_ORG_ID;
  const actorId = process.env.APP_ACTOR_ID?.trim() || DEMO_ACTOR_ID;
  const actor: MutationActor = { actorType: "human", actorId };
  return { orgId, actor };
}
