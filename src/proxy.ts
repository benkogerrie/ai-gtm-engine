import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  readConfiguredSecret,
  verifySessionValue,
} from "@/lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth =
    pathname === "/intake" ||
    pathname.startsWith("/intake/") ||
    pathname === "/icp" ||
    pathname.startsWith("/icp/") ||
    pathname === "/prospects" ||
    pathname.startsWith("/prospects/") ||
    pathname === "/outreach" ||
    pathname.startsWith("/outreach/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/");
  if (!needsAuth) {
    return NextResponse.next();
  }

  const configured = readConfiguredSecret();
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (configured && raw && verifySessionValue(configured.token, raw)) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/intake",
    "/intake/:path*",
    "/icp",
    "/icp/:path*",
    "/prospects",
    "/prospects/:path*",
    "/outreach",
    "/outreach/:path*",
    "/dashboard",
    "/dashboard/:path*",
  ],
};
