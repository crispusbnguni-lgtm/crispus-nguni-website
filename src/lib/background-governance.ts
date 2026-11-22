
import "server-only";

import type { Prisma } from "@prisma/client";

/** Serializes background-library writes that can affect the single-default rule. */
export async function lockBackgroundOptionWrites(
  transaction: Prisma.TransactionClient,
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext('background-option-default'),
      hashtext('background-option-write')
    )
  `;
}

/** Database uniqueness or transaction conflicts must never be reported as success. */
export function isBackgroundWriteConflict(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return error.code === "P2002" || error.code === "P2034";
}
