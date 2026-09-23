import type { z } from "zod";
import type { userSchema, detailSchema, statusSchema } from "../schemas/api";
export type User = z.infer<typeof userSchema>;
export type Student = z.infer<typeof detailSchema>;
export type Status = z.infer<typeof statusSchema>;
