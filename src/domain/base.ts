import { z } from "zod";

export const uuidSchema = z.uuid();

export const entityBaseSchema = z.object({
  id: uuidSchema,
  orgId: uuidSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type EntityBase = z.infer<typeof entityBaseSchema>;

export const jsonValueSchema = z.unknown();

export const stringListSchema = z.array(z.string());

export const confidenceMapSchema = z.record(z.string(), z.number().min(0).max(1));
