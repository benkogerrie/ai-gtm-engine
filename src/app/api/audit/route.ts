import { auditListQuerySchema } from "@/domain";
import { getDb } from "@/db/client";
import { listAuditEvents } from "@/db/repository";
import { parseSearchParams, requireAuth, toJsonSafe } from "@/lib/http";

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const query = parseSearchParams(request, auditListQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  const db = await getDb();
  const rows = await listAuditEvents(db, {
    ...query.data,
    orgId: auth.auth.orgId,
  });
  return Response.json(toJsonSafe(rows));
}
