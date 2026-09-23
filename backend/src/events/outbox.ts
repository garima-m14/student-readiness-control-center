import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db, events, mongo } from "../database/client.js";
import type { Transaction } from "../students/repository.js";
export async function enqueue(
  tx: Transaction,
  event: {
    type: "attempt.succeeded" | "attempt.rejected";
    tenantId: string;
    studentId: string;
    attemptId?: string;
    requestId: string;
    metadata: Record<string, string | number>;
  },
) {
  const eventId = randomUUID();
  await tx.outbox.create({
    data: {
      id: eventId,
      tenantId: event.tenantId,
      studentId: event.studentId,
      payload: {
        eventId,
        ...event,
        occurredAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  });
}
let initialized = false;
export async function deliverEvents() {
  // Explicit connect also recovers after the driver's initial auto-connect failed.
  await mongo.connect();
  if (!initialized) {
    await events.createIndex({ eventId: 1 }, { unique: true });
    await events.createIndex({
      tenantId: 1,
      studentId: 1,
      occurredAt: -1,
      eventId: -1,
    });
    initialized = true;
  }
  const batch = await db.outbox.findMany({
    where: { deliveredAt: null, nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  for (const row of batch) {
    try {
      try {
        await events.insertOne(row.payload as Record<string, unknown>);
      } catch (error) {
        if (!(
          error instanceof Error &&
          "code" in error &&
          error.code === 11000
        ))
          throw error;
      }
      await db.outbox.update({
        where: { id: row.id },
        data: { deliveredAt: new Date() },
      });
    } catch {
      await db.outbox.update({
        where: { id: row.id },
        data: {
          retries: { increment: 1 },
          nextAttemptAt: new Date(
            Date.now() +
              Math.min(300_000, 1000 * 2 ** Math.min(row.retries, 8)),
          ),
        },
      });
      console.error(
        JSON.stringify({ code: "EVENT_DELIVERY_FAILED", eventId: row.id }),
      );
    }
  }
}
export function startWorker() {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  async function tick() {
    try {
      await deliverEvents();
    } catch {
      console.error(JSON.stringify({ code: "OUTBOX_UNAVAILABLE" }));
    } finally {
      if (!stopped) timer = setTimeout(tick, 2000);
    }
  }
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
