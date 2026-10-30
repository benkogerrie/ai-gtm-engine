import { z } from "zod";
import { entityBaseSchema, jsonValueSchema, uuidSchema } from "./base";
import { actorTypeSchema, entityTypeSchema } from "./enums";

export const auditEventSchema = entityBaseSchema.extend({
  actorType: actorTypeSchema,
  actorId: z.string().min(1),
  action: z.string().min(1),
  entityType: entityTypeSchema,
  entityId: uuidSchema,
  before: jsonValueSchema.nullable(),
  after: jsonValueSchema.nullable(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const auditListQuerySchema = z.object({
  orgId: uuidSchema,
  entityType: entityTypeSchema.optional(),
  entityId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditListQuery = z.infer<typeof auditListQuerySchema>;

export const mutationActorSchema = z.object({
  actorType: actorTypeSchema,
  actorId: z.string().min(1),
});
export type MutationActor = z.infer<typeof mutationActorSchema>;
