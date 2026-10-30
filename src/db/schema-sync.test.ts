import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  auditEventSchema,
  citationSchema,
  companySchema,
  competitorSchema,
  fieldAssertionSchema,
  icpSchema,
  leadSchema,
  organizationSchema,
  outreachSchema,
  personSchema,
  productSchema,
  relationshipEdgeSchema,
  signalSchema,
} from "@/domain";
import {
  auditEvents,
  citations,
  companies,
  competitors,
  fieldAssertions,
  icps,
  leads,
  organizations,
  outreach,
  people,
  products,
  relationshipEdges,
  signals,
} from "./schema";

function keysOfSchema(schema: { shape: Record<string, unknown> }) {
  return Object.keys(schema.shape).sort();
}

function keysOfTable(table: Parameters<typeof getTableColumns>[0]) {
  return Object.keys(getTableColumns(table)).sort();
}

describe("Zod schemas stay in sync with Drizzle tables", () => {
  it.each([
    ["organization", organizationSchema, organizations],
    ["product", productSchema, products],
    ["icp", icpSchema, icps],
    ["company", companySchema, companies],
    ["person", personSchema, people],
    ["competitor", competitorSchema, competitors],
    ["signal", signalSchema, signals],
    ["lead", leadSchema, leads],
    ["outreach", outreachSchema, outreach],
    ["citation", citationSchema, citations],
    ["field_assertion", fieldAssertionSchema, fieldAssertions],
    ["audit_event", auditEventSchema, auditEvents],
    ["relationship_edge", relationshipEdgeSchema, relationshipEdges],
  ] as const)("%s columns match Zod keys", (_name, zodSchema, table) => {
    expect(keysOfTable(table)).toEqual(keysOfSchema(zodSchema));
  });
});
