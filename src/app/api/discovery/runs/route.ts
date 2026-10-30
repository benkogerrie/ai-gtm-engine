import { getDb } from "@/db/client";
import {
  discoveryInputSchema,
  runDiscovery,
} from "@/lib/discovery";
import { parseJson, requireAuth, toJsonSafe } from "@/lib/http";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = await parseJson(request, discoveryInputSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const db = await getDb();
  const run = await runDiscovery(parsed.data, {
    db,
    orgId: auth.auth.orgId,
    actor: auth.auth.actor,
  });

  return Response.json(toJsonSafe(run), { status: 201 });
}
