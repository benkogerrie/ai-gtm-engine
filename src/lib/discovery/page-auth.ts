import { getPageAuth } from "@/lib/session";

/**
 * Page auth for /prospects and discovery server actions.
 * Delegates to the B003 cookie session (`getPageAuth`). Redirect to /login
 * when this returns null.
 */
export async function getDiscoveryPageAuth() {
  return getPageAuth();
}
