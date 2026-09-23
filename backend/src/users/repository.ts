import { db } from "../database/client.js";
export const findLoginUser = (organization: string, email: string) =>
  db.user.findFirst({
    where: { email, tenant: { name: organization, status: "ACTIVE" } },
    include: { tenant: true },
  });
export const findSession = (id: string) =>
  db.session.findUnique({
    where: { id },
    include: { user: { include: { tenant: true } } },
  });
