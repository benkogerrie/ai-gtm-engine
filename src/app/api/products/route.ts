import { createProductInputSchema, listQuerySchema } from "@/domain";
import { getDb } from "@/db/client";
import { createProduct, listProducts } from "@/db/repository";
import {
  actorFromHeaders,
  handleRouteError,
  parseJson,
  parseSearchParams,
  toJsonSafe,
} from "@/lib/http";

export async function GET(request: Request) {
  const query = parseSearchParams(request, listQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  const db = await getDb();
  const rows = await listProducts(db, query.data.orgId);
  return Response.json(toJsonSafe(rows));
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, createProductInputSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const db = await getDb();
    const created = await createProduct(
      db,
      parsed.data,
      actorFromHeaders(request),
    );
    return Response.json(toJsonSafe(created), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
