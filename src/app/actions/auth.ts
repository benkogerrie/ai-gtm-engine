"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  readConfiguredSecret,
  safeEqual,
  signSessionValue,
} from "@/lib/auth";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const configured = readConfiguredSecret();
  if (!configured) {
    return {
      error:
        "Server auth is not configured. Set APP_API_TOKEN and APP_ORG_ID.",
    };
  }

  const token = String(formData.get("token") ?? "");
  if (!token || !safeEqual(token, configured.token)) {
    return { error: "Invalid token." };
  }

  const jar = await cookies();
  jar.set(
    SESSION_COOKIE,
    signSessionValue(configured.token),
    sessionCookieOptions(),
  );

  const next = String(formData.get("next") ?? "/intake");
  redirect(next.startsWith("/") ? next : "/intake");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
