import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../database/client.js";
import type { Identity } from "../auth/service.js";
import { attemptSchema } from "../validation/schemas.js";
import { detail, lockStudent } from "../students/repository.js";
import { fingerprint, lockKey } from "../idempotency/service.js";
import { enqueue } from "../events/outbox.js";
import { ApiError } from "../utils/errors.js";
export async function createAttempt(
  user: Identity,
  studentId: string,
  key: string,
  input: z.infer<typeof attemptSchema>,
  requestId: string,
) {
  const tenantId = user.tenantId;
  const body = {
    ...input,
    attemptedAt: new Date(input.attemptedAt).toISOString(),
  };
  const hash = fingerprint(studentId, body);
  return db.$transaction(
    async (tx) => {
      await lockKey(tx, tenantId, key);
      await lockStudent(tx, tenantId, studentId);
      const previous = await tx.idempotencyRecord.findUnique({
        where: { tenantId_key: { tenantId, key } },
      });
      if (previous) {
        if (previous.requestFingerprint !== hash)
          throw new ApiError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "This request key was already used with different data",
          );
        return {
          status: previous.responseStatus,
          body: previous.responseBody,
          replayed: true,
        };
      }
      const attempt = await tx.attempt.create({
        data: {
          tenantId,
          studentId,
          competencyId: body.competency,
          score: body.score,
          attemptedAt: body.attemptedAt,
          evaluatorId: user.id,
        },
      });
      const current = await detail(tenantId, studentId, tx);
      await tx.student.updateMany({
        where: { tenantId, id: studentId },
        data: {
          score: current.score,
          status: current.status,
          version: { increment: 1 },
        },
      });
      const response = JSON.parse(
        JSON.stringify({
          attemptId: attempt.id,
          student: await detail(tenantId, studentId, tx),
        }),
      ) as Prisma.InputJsonValue;
      await tx.idempotencyRecord.create({
        data: {
          tenantId,
          key,
          requestFingerprint: hash,
          status: "COMPLETED",
          responseStatus: 201,
          responseBody: response,
          expiresAt: new Date(Date.now() + 7 * 86400_000),
        },
      });
      await enqueue(tx, {
        type: "attempt.succeeded",
        tenantId,
        studentId,
        attemptId: attempt.id,
        requestId,
        metadata: { competency: body.competency, score: body.score },
      });
      return { status: 201, body: response, replayed: false };
    },
    { timeout: 15000, maxWait: 15000 },
  );
}
export async function recordRejection(
  user: Identity,
  studentId: string,
  requestId: string,
  code: string,
) {
  if (
    await db.student.findFirst({
      where: { tenantId: user.tenantId, id: studentId },
      select: { id: true },
    })
  )
    await enqueue(db, {
      type: "attempt.rejected",
      tenantId: user.tenantId,
      studentId,
      requestId,
      metadata: { code },
    });
}
