import { timingSafeEqual } from "node:crypto";
import { actorTypeSchema, uuidSchema, type MutationActor } from "@/domain";

export type AuthContext = {
  orgId: string;
  actor: MutationActor;
};

function bearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  if (!header) {
    return undefined;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1];
}

function safeEqual(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) {
    timingSafeEqual(leftBuf, leftBuf);
    return false;
  }
  return timingSafeEqual(leftBuf, rightBuf);
}

function readConfiguredSecret():
  | { token: string; orgId: string; actor: MutationActor }
  | null {
  const token = process.env.APP_API_TOKEN?.trim();
  const orgId = process.env.APP_ORG_ID?.trim();
  if (!token || !orgId) {
    return null;
  }
  if (!uuidSchema.safeParse(orgId).success) {
    return null;
  }
  const actorType = actorTypeSchema.safeParse(
    process.env.APP_ACTOR_TYPE?.trim() || "agent",
  );
  const actorId = process.env.APP_ACTOR_ID?.trim() || "configured-actor";
  if (!actorType.success || !actorId) {
    return null;
  }
  return {
    token,
    orgId,
    actor: { actorType: actorType.data, actorId },
  };
}

/**
 * Derives org + actor only from server-side env (APP_API_TOKEN → APP_ORG_ID /
 * APP_ACTOR_*). Caller orgId, x-actor-id, x-actor-type, and query/body values
 * are ignored.
 */
export function getAuthContext(request: Request): AuthContext | null {
  const configured = readConfiguredSecret();
  if (!configured) {
    return null;
  }
  const presented = bearerToken(request);
  if (!presented || !safeEqual(presented, configured.token)) {
    return null;
  }
  return { orgId: configured.orgId, actor: configured.actor };
}
