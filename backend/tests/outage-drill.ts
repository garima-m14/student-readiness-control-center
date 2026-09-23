import "dotenv/config";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { db, mongo, events } from "../src/database/client.js";
const headers = {
  "Content-Type": "application/json",
  "X-Requested-With": "readiness",
};
const login = await fetch("http://localhost:4000/api/auth/login", {
  method: "POST",
  headers,
  body: JSON.stringify({
    organization: "Acme Training",
    email: "admin@acme.test",
    password: process.env.SEED_PASSWORD,
  }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie")!.split(";")[0];
const user = await db.user.findFirstOrThrow({
  where: { email: "admin@acme.test", tenant: { name: "Acme Training" } },
});
const student = await db.student.findFirstOrThrow({
  where: { tenantId: user.tenantId },
});
function compose(...args: string[]) {
  const r = spawnSync("docker", ["compose", ...args], {
    cwd: "..",
    stdio: "inherit",
  });
  assert.equal(r.status, 0);
}
let attemptId = "";
try {
  compose("stop", "mongo");
  const result = await fetch(
    `http://localhost:4000/api/students/${student.id}/attempts`,
    {
      method: "POST",
      headers: { ...headers, Cookie: cookie, "Idempotency-Key": randomUUID() },
      body: JSON.stringify({
        competency: "backend",
        score: 82,
        attemptedAt: new Date().toISOString(),
      }),
    },
  );
  assert.equal(result.status, 201);
  const data = (await result.json()) as { attemptId: string };
  attemptId = data.attemptId;
  assert.equal(
    await db.attempt.count({
      where: { tenantId: user.tenantId, id: attemptId },
    }),
    1,
  );
  assert.ok(
    (await db.outbox.count({
      where: {
        tenantId: user.tenantId,
        studentId: student.id,
        deliveredAt: null,
      },
    })) > 0,
  );
  console.log(
    "PASS: MongoDB unavailable; PostgreSQL committed assessment and pending outbox.",
  );
} finally {
  compose("start", "mongo");
}
try {
  let delivered = false;
  for (let i = 0; i < 45; i++) {
    await setTimeout(2000);
    try {
      if (
        (await events.countDocuments({
          tenantId: user.tenantId,
          attemptId,
        })) === 1
      ) {
        delivered = true;
        break;
      }
    } catch {
      /* Wait for restarted MongoDB to accept connections. */
    }
  }
  assert.ok(delivered, "Outbox must eventually deliver after MongoDB recovery");
  await setTimeout(3000);
  assert.equal(
    await events.countDocuments({ tenantId: user.tenantId, attemptId }),
    1,
  );
  console.log(
    "PASS: MongoDB recovered; worker delivered exactly one success event.",
  );
} finally {
  await db.$disconnect();
  await mongo.close();
}
