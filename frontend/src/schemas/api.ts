import { z } from "zod";
export const statusSchema = z.enum([
  "INCOMPLETE",
  "READY",
  "NEARLY_READY",
  "DEVELOPING",
  "NEEDS_PREPARATION",
]);
export const keys = [
  "frontend",
  "backend",
  "databases",
  "problem_solving",
] as const;
export const userSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  sessionId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["ADMIN", "EVALUATOR", "VIEWER"]),
  tenantName: z.string(),
});
export const studentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  version: z.number().int(),
  score: z.number(),
  status: statusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const evidenceSchema = z.object({
  id: z.string().uuid(),
  score: z.number(),
  attemptedAt: z.string(),
  evaluator: z.object({ id: z.string().uuid(), name: z.string() }),
});
export const detailSchema = studentSchema.extend({
  missing: z.array(z.enum(keys)),
  competencies: z.array(
    z.object({
      key: z.enum(keys),
      weight: z.number(),
      score: z.number().nullable(),
      latest: evidenceSchema.nullable(),
    }),
  ),
});
export const listSchema = z.object({
  items: z.array(studentSchema),
  total: z.number(),
  nextCursor: z.string().nullable(),
  summary: z.record(z.number()),
});
export const activitySchema = z.object({
  items: z.array(
    z.object({
      eventId: z.string(),
      type: z.enum(["attempt.succeeded", "attempt.rejected"]),
      studentId: z.string(),
      attemptId: z.string().optional(),
      requestId: z.string(),
      occurredAt: z.string(),
      metadata: z.record(z.union([z.string(), z.number()])),
    }),
  ),
  nextCursor: z.string().nullable(),
  pending: z.number(),
});
export const attemptResultSchema = z.object({
  attemptId: z.string().uuid(),
  student: detailSchema,
});
export const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  fields: z.record(z.string()),
});
