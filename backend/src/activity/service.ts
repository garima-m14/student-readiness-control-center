import { events, db } from "../database/client.js";
import { ApiError, notFound } from "../utils/errors.js";
import { z } from "zod";
const cursorSchema = z.object({
  occurredAt: z.string().datetime(),
  eventId: z.string().uuid(),
  tenantId: z.string().uuid(),
  studentId: z.string().uuid(),
});
export async function activity(
  tenantId: string,
  studentId: string,
  limit: number,
  cursor?: string,
) {
  if (
    !(await db.student.findFirst({
      where: { tenantId, id: studentId },
      select: { id: true },
    }))
  )
    throw notFound();
  let position: z.infer<typeof cursorSchema> | undefined;
  if (cursor) {
    try {
      position = cursorSchema.parse(
        JSON.parse(Buffer.from(cursor, "base64url").toString()),
      );
      if (position.tenantId !== tenantId || position.studentId !== studentId)
        throw new Error();
    } catch {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid activity cursor");
    }
  }
  const items = await events
    .find(
      {
        tenantId,
        studentId,
        ...(position
          ? {
              $or: [
                { occurredAt: { $lt: position.occurredAt } },
                {
                  occurredAt: position.occurredAt,
                  eventId: { $lt: position.eventId },
                },
              ],
            }
          : {}),
      },
      {
        projection: {
          _id: 0,
          eventId: 1,
          type: 1,
          studentId: 1,
          attemptId: 1,
          requestId: 1,
          occurredAt: 1,
          metadata: 1,
        },
      },
    )
    .sort({ occurredAt: -1, eventId: -1 })
    .limit(limit + 1)
    .toArray();
  return {
    items: items.slice(0, limit),
    nextCursor:
      items.length > limit
        ? Buffer.from(
            JSON.stringify({
              occurredAt: items[limit - 1].occurredAt,
              eventId: items[limit - 1].eventId,
              tenantId,
              studentId,
            }),
          ).toString("base64url")
        : null,
    pending: await db.outbox.count({
      where: { tenantId, studentId, deliveredAt: null },
    }),
  };
}
export async function metrics(tenantId: string) {
  const duplicates = await events
    .aggregate([
      { $match: { tenantId, type: "attempt.succeeded" } },
      {
        $group: {
          _id: { tenantId: "$tenantId", attemptId: "$attemptId" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $limit: 100 },
    ])
    .toArray();
  const [success, rejected, pending] = await Promise.all([
    events.countDocuments({ tenantId, type: "attempt.succeeded" }),
    events.countDocuments({ tenantId, type: "attempt.rejected" }),
    db.outbox.count({ where: { tenantId, deliveredAt: null } }),
  ]);
  return {
    tenantId,
    success,
    rejected,
    total: success + rejected,
    rejectionRate: success + rejected ? rejected / (success + rejected) : 0,
    pending,
    duplicates,
  };
}
