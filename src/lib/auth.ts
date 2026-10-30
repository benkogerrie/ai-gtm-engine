import { createHmac, timingSafeEqual } from "node:crypto";
import { actorTypeSchema, uuidSchema, type MutationActor } from "@/domain";
import { readDemoAuth } from "@/lib/demo-mode";

export type AuthContext = {
  orgId: string;
  actor: MutationActor;
};

export const SESSION_COOKIE = "gtm_session";

function bearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  if (!header) {
    return undefined;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1];
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) {
    timingSafeEqual(leftBuf, leftBuf);
    return false;
  }
  return timingSafeEqual(leftBuf, rightBuf);
}

export function readConfiguredSecret():
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

export function signSessionValue(
  secret: string,
  issuedAtMs: number = Date.now(),
): string {
  const payload = `v1.${issuedAtMs}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionValue(secret: string, raw: string): boolean {
  const lastDot = raw.lastIndexOf(".");
  if (lastDot <= 0) {
    return false;
  }
  const payload = raw.slice(0, lastDot);
  const sig = raw.slice(lastDot + 1);
  if (!payload.startsWith("v1.")) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  if (expected.length !== sig.length) {
    timingSafeEqual(Buffer.from(expected), Buffer.from(expected));
    return false;
  }
  return safeEqual(sig, expected);
}

export function readCookieValue(
  request: Request,
  name: string,
): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) {
      continue;
    }
    if (trimmed.slice(0, eq) === name) {
      return decodeURIComponent(trimmed.slice(eq + 1));
    }
  }
  return undefined;
}

export function authFromSessionCookie(
  raw: string | undefined,
): AuthContext | null {
  const configured = readConfiguredSecret();
  if (!configured || !raw || !verifySessionValue(configured.token, raw)) {
    return null;
  }
  return {
    orgId: configured.orgId,
    actor: {
      actorType: "human",
      actorId: configured.actor.actorId,
    },
  };
}

/**
 * Derives org + actor only from server-side env (APP_API_TOKEN → APP_ORG_ID /
 * APP_ACTOR_*). Caller orgId, x-actor-id, x-actor-type, and query/body values
 * are ignored. A signed session cookie is accepted for browser pages; the
 * cookie never carries orgId. Public demo mode maps to the same server org
 * without a token or cookie.
 */
export function getAuthContext(request: Request): AuthContext | null {
  const demo = readDemoAuth();
  if (demo) {
    return demo;
  }
  const configured = readConfiguredSecret();
  if (!configured) {
    return null;
  }
  const presented = bearerToken(request);
  if (presented && safeEqual(presented, configured.token)) {
    return { orgId: configured.orgId, actor: configured.actor };
  }
  return authFromSessionCookie(readCookieValue(request, SESSION_COOKIE));
}
