import { z } from "zod";
import { entityBaseSchema, uuidSchema } from "./base";
import { entityTypeSchema, relationshipEdgeTypeSchema } from "./enums";

export const relationshipEdgeSchema = entityBaseSchema.extend({
  fromEntityType: entityTypeSchema,
  fromEntityId: uuidSchema,
  toEntityType: entityTypeSchema,
  toEntityId: uuidSchema,
  edgeType: relationshipEdgeTypeSchema,
});
export type RelationshipEdge = z.infer<typeof relationshipEdgeSchema>;

export const createRelationshipEdgeInputSchema = relationshipEdgeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateRelationshipEdgeInput = z.infer<
  typeof createRelationshipEdgeInputSchema
>;
