import type { Prisma } from "@prisma/client";

export function leadPortfolioScope(user: { id: string; role: string }): Prisma.LeadWhereInput {
  return user.role === "SUPER_ADMIN"
    ? {}
    : { portfolio: { is: { userId: user.id } } };
}
