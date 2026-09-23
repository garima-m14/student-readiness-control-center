import { weights, type CompetencyKey } from "../competencies/catalog.js";
export interface Evidence {
  id: string;
  competencyId: string;
  score: number;
  attemptedAt: Date;
  voidedAt: Date | null;
  evaluator?: { id: string; name: string };
}
export function calculateReadiness(attempts: Evidence[]) {
  const competencies = (Object.keys(weights) as CompetencyKey[]).map((key) => {
    const latest =
      attempts
        .filter((a) => a.competencyId === key && a.voidedAt === null)
        .sort(
          (a, b) =>
            b.attemptedAt.getTime() - a.attemptedAt.getTime() ||
            (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
        )[0] ?? null;
    return { key, weight: weights[key], latest, score: latest?.score ?? null };
  });
  const missing = competencies
    .filter((c) => c.latest === null)
    .map((c) => c.key);
  // Integer hundredths avoid classifying 79.999999999 as below the exact 80 boundary.
  const score =
    competencies.reduce(
      (total, c) => total + Math.round((c.score ?? 0) * 100) * c.weight,
      0,
    ) / 10000;
  const status = missing.length
    ? "INCOMPLETE"
    : score >= 80
      ? "READY"
      : score >= 65
        ? "NEARLY_READY"
        : score >= 50
          ? "DEVELOPING"
          : "NEEDS_PREPARATION";
  return { score, status, missing, competencies };
}
