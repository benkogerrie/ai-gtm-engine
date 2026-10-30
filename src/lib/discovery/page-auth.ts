import { actorTypeSchema, uuidSchema, type MutationActor } from "@/domain";
import type { AuthContext } from "@/lib/auth";

/** Stable demo org when APP_ORG_ID is unset so /prospects stays clickable. */
export const DISCOVERY_DEMO_ORG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/**
 * Page-only auth for /prospects.
 *
 * Uses APP_ORG_ID / APP_ACTOR_* (no bearer token, no login page).
 * After B003 (PR #6: /login + src/lib/session.ts) merges, swap the body
 * of this helper to read the cookie session. API routes keep getAuthContext.
 */
export function getDiscoveryPageAuth(
  env: NodeJS.ProcessEnv = process.env,
): AuthContext {
  const configuredOrg = env.APP_ORG_ID?.trim();
  const orgId =
    configuredOrg && uuidSchema.safeParse(configuredOrg).success
      ? configuredOrg
      : DISCOVERY_DEMO_ORG_ID;

  const actorType = actorTypeSchema.safeParse(
    env.APP_ACTOR_TYPE?.trim() || "agent",
  );
  const actor: MutationActor = {
    actorType: actorType.success ? actorType.data : "agent",
    actorId: env.APP_ACTOR_ID?.trim() || "discovery-page",
  };

  return { orgId, actor };
}
