import { createHash } from "node:crypto";
import type { Transaction } from "../students/repository.js";
export const fingerprint = (studentId: string, body: unknown) =>
  createHash("sha256")
    .update(JSON.stringify({ method: "POST", studentId, body }))
    .digest("hex");
export async function lockKey(tx: Transaction, tenantId: string, key: string) {
  // Transaction-scoped lock serializes a logical operation across all API replicas.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ":" + key},0))::text`;
}
