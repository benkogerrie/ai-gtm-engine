import { connection } from "next/server";
import { getSearchHealth } from "@/lib/search";

export async function GET() {
  await connection();
  return Response.json(getSearchHealth());
}
