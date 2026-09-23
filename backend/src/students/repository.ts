import { Prisma } from "@prisma/client";
import { db } from "../database/client.js";
import { calculateReadiness } from "../readiness/domain.js";
import { notFound } from "../utils/errors.js";
export type Transaction = Prisma.TransactionClient;
export async function detail(
  tenantId: string,
  id: string,
  client: Transaction = db,
) {
  const student = await client.student.findFirst({ where: { tenantId, id } });
  if (!student) throw notFound();
  const attempts = await client.attempt.findMany({
    where: { tenantId, studentId: id },
    include: { evaluator: { select: { id: true, name: true } } },
  });
  return {
    ...student,
    ...calculateReadiness(
      attempts.map((a) => ({ ...a, score: Number(a.score) })),
    ),
  };
}
export async function lockStudent(
  tx: Transaction,
  tenantId: string,
  id: string,
) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "Student" WHERE "tenantId"=${tenantId}::uuid AND id=${id}::uuid FOR UPDATE`;
  if (!rows.length) throw notFound();
}
