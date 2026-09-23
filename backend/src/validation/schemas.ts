import { z } from "zod";
export const idSchema = z.string().uuid();
export const competencyKeys = [
  "frontend",
  "backend",
  "databases",
  "problem_solving",
] as const;
export const statuses = [
  "INCOMPLETE",
  "READY",
  "NEARLY_READY",
  "DEVELOPING",
  "NEEDS_PREPARATION",
] as const;
export const loginSchema = z
  .object({
    organization: z.string().trim().min(1).max(100),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(1).max(128),
  })
  .strict();
export const attemptSchema = z
  .object({
    competency: z.enum(competencyKeys),
    score: z.number().min(0).max(100).multipleOf(0.01),
    attemptedAt: z
      .string()
      .datetime({ offset: true })
      .refine(
        (s) => new Date(s).getTime() <= Date.now() + 60_000,
        "Attempt cannot be in the future",
      ),
  })
  .strict();
export const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    expectedVersion: z.number().int().positive(),
  })
  .strict()
  .refine(
    (x) => x.name !== undefined || x.phone !== undefined,
    "Provide a name or phone",
  );
export const listSchema = z
  .object({
    search: z.string().trim().max(100).default(""),
    status: z.enum(statuses).optional(),
    sort: z
      .enum([
        "name:asc",
        "name:desc",
        "email:asc",
        "email:desc",
        "score:asc",
        "score:desc",
        "status:asc",
        "status:desc",
        "createdAt:asc",
        "createdAt:desc",
      ])
      .default("name:asc"),
    cursor: z.string().max(2048).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const activitySchema = z
  .object({
    cursor: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const keySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
