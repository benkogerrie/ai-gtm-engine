import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  authFromSessionCookie,
  readConfiguredSecret,
  type AuthContext,
} from "@/lib/auth";
import { readDemoAuth } from "@/lib/demo-mode";

export { SESSION_COOKIE };

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL),
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function getPageAuth(): Promise<AuthContext | null> {
  const demo = readDemoAuth();
  if (demo) {
    return demo;
  }
  const jar = await cookies();
  return authFromSessionCookie(jar.get(SESSION_COOKIE)?.value);
}

export function isAuthConfigured(): boolean {
  return readConfiguredSecret() !== null;
}
