import { eq } from "drizzle-orm";
import type { MutationActor } from "@/domain";
import type { AppDatabase } from "@/db/client";
import { organizations } from "@/db/schema";
import {
  createOrganization,
  getOrganization,
  listAuditEvents,
  withAudit,
} from "@/db/repository";
import {
  DISCOVERY_RUN_ACTIONS,
  discoveryRunSnapshotSchema,
  type DiscoveryRunSnapshot,
} from "./types";

export async function ensureDiscoveryOrg(
  db: AppDatabase,
  orgId: string,
  actor: MutationActor,
) {
  const existing = await getOrganization(db, orgId);
  if (existing) {
    return existing;
  }

  const [sameOrg] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.orgId, orgId));
  if (sameOrg) {
    return sameOrg;
  }

  return createOrganization(db, { id: orgId, name: "Discovery workspace" }, actor);
}

export async function writeDiscoveryRunAudit(
  db: AppDatabase,
  snapshot: DiscoveryRunSnapshot,
  actor: MutationActor,
  action: (typeof DISCOVERY_RUN_ACTIONS)[keyof typeof DISCOVERY_RUN_ACTIONS],
): Promise<DiscoveryRunSnapshot> {
  return withAudit(
    db,
    {
      orgId: snapshot.orgId,
      actor,
      action,
      entityType: "organization",
      entityId: snapshot.id,
      after: snapshot,
    },
    async () => snapshot,
  );
}

export async function getDiscoveryRun(
  db: AppDatabase,
  orgId: string,
  runId: string,
): Promise<DiscoveryRunSnapshot | null> {
  const events = await listAuditEvents(db, {
    orgId,
    entityId: runId,
    limit: 20,
  });
  for (const event of events) {
    if (!event.action.startsWith("discovery.run.")) {
      continue;
    }
    const parsed = discoveryRunSnapshotSchema.safeParse(event.after);
    if (parsed.success) {
      return parsed.data;
    }
  }
  return null;
}

export async function listDiscoveryRuns(
  db: AppDatabase,
  orgId: string,
  options: { limit?: number; icpId?: string } = {},
): Promise<DiscoveryRunSnapshot[]> {
  const limit = options.limit ?? 10;
  const events = await listAuditEvents(db, { orgId, limit: 80 });
  const byId = new Map<string, DiscoveryRunSnapshot>();
  for (const event of events) {
    if (!event.action.startsWith("discovery.run.")) {
      continue;
    }
    const parsed = discoveryRunSnapshotSchema.safeParse(event.after);
    if (!parsed.success || byId.has(parsed.data.id)) {
      continue;
    }
    if (options.icpId && parsed.data.icpId !== options.icpId) {
      continue;
    }
    byId.set(parsed.data.id, parsed.data);
    if (byId.size >= limit) {
      break;
    }
  }
  return [...byId.values()];
}
