import { z } from "zod";
import { isDomainError } from "@/domain/errors";
import { getAuthContext, type AuthContext } from "@/lib/auth";

export function jsonError(
  status: number,
  message: string,
  details?: unknown,
): Response {
  return Response.json({ error: message, details: details ?? null }, { status });
}

export async function parseJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: jsonError(400, "Invalid JSON") };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError(400, "Invalid input", z.flattenError(parsed.error)),
    };
  }

  return { ok: true, data: parsed.data };
}

export function parseSearchParams<T>(
  request: Request,
  schema: z.ZodType<T>,
): { ok: true; data: T } | { ok: false; response: Response } {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError(400, "Invalid query", z.flattenError(parsed.error)),
    };
  }
  return { ok: true, data: parsed.data };
}

export function requireAuth(
  request: Request,
): { ok: true; auth: AuthContext } | { ok: false; response: Response } {
  const auth = getAuthContext(request);
  if (!auth) {
    return { ok: false, response: jsonError(401, "Unauthorized") };
  }
  return { ok: true, auth };
}

export function handleRouteError(error: unknown): Response {
  if (isDomainError(error)) {
    return jsonError(400, error.message, { code: error.code });
  }
  throw error;
}

export function toJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
