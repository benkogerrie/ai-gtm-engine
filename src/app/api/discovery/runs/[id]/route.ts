import { uuidSchema } from "@/domain";
import { getDb } from "@/db/client";
import { getDiscoveryRun } from "@/lib/discovery";
import { jsonError, requireAuth, toJsonSafe } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return jsonError(400, "Invalid discovery run id");
  }

  const db = await getDb();
  const run = await getDiscoveryRun(db, auth.auth.orgId, parsed.data);
  if (!run) {
    return jsonError(404, "Discovery run not found");
  }

  return Response.json(toJsonSafe(run));
}
