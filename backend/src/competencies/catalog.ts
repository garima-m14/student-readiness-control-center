export const weights = {
  frontend: 30,
  backend: 30,
  databases: 25,
  problem_solving: 15,
} as const;
export type CompetencyKey = keyof typeof weights;
