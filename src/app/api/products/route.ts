import { createProductApiSchema } from "@/domain";
import { getDb } from "@/db/client";
import { createProduct, listProducts } from "@/db/repository";
import {
  handleRouteError,
  parseJson,
  requireAuth,
  toJsonSafe,
} from "@/lib/http";

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const db = await getDb();
  const rows = await listProducts(db, auth.auth.orgId);
  return Response.json(toJsonSafe(rows));
}

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = await parseJson(request, createProductApiSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const db = await getDb();
    const created = await createProduct(
      db,
      { ...parsed.data, orgId: auth.auth.orgId },
      auth.auth.actor,
    );
    return Response.json(toJsonSafe(created), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
