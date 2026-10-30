import { connection } from "next/server";
import { getLlmHealth } from "@/lib/llm";

export async function GET() {
  await connection();
  return Response.json(getLlmHealth());
}
