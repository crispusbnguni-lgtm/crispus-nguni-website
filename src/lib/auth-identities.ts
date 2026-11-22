import "server-only";

import type { IdentityProvider, Prisma, PrismaClient } from "@prisma/client";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getCurrentSessionDetails } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type IdentityDatabase = Pick<PrismaClient, "user" | "userIdentity">;
const RECENT_AUTHENTICATION_WINDOW_MS = 5 * 60 * 1000;

export type IdentityOperationResult =
  | { status: "created" }
  | { status: "already-linked" }
  | { status: "conflict" };

export type VerifiedIdentityInput = {
  provider: IdentityProvider;
  providerSubject: string;
  identifier?: string | null;
};

export class IdentityAccountNotFoundError extends Error {
  constructor() {
    super("The identity owner account does not exist.");
    this.name = "IdentityAccountNotFoundError";
  }
}

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required to link an identity.");
    this.name = "AuthenticationRequiredError";
  }
}

function normalizeIdentitySubject(
  provider: IdentityProvider,
  providerSubject: string,
): string {
  if (typeof providerSubject !== "string" || providerSubject.length === 0) {
    throw new TypeError("An identity provider subject is required.");
  }

  if (provider === "EMAIL") {
    const normalizedEmail = providerSubject.trim().toLowerCase();

    if (!normalizedEmail || /[\r\n\0]/.test(normalizedEmail)) {
      throw new TypeError("The EMAIL identity subject is invalid.");
    }

    return normalizedEmail;
  }

  if (provider === "PHONE") {
    const phoneNumber = parsePhoneNumberFromString(providerSubject);

    if (
      !phoneNumber?.isValid() ||
      phoneNumber.number !== providerSubject ||
      !/^\+[1-9]\d{1,14}$/.test(providerSubject)
    ) {
      throw new TypeError("The PHONE identity subject must be normalized E.164.");
    }

    return providerSubject;
  }

  // Google and Apple subjects are opaque, case-sensitive provider identifiers.
  if (
    (provider !== "GOOGLE" && provider !== "APPLE") ||
    providerSubject.trim().length === 0 ||
    providerSubject.length > 512 ||
    /[\u0000-\u001f\u007f]/.test(providerSubject)
  ) {
    throw new TypeError("The provider subject is invalid.");
  }

  return providerSubject;
}

function normalizeIdentityInput(input: VerifiedIdentityInput) {
  const providerSubject = normalizeIdentitySubject(
    input.provider,
    input.providerSubject,
  );

  const verifiedAt = new Date();

  let identifier = input.identifier ?? null;

  if (input.provider === "EMAIL") {
    identifier = input.identifier == null
      ? providerSubject
      : input.identifier.trim().toLowerCase();

    if (identifier !== providerSubject) {
      throw new TypeError("EMAIL identity identifier must match its subject.");
    }
  }

  return {
    provider: input.provider,
    providerSubject,
    identifier,
    verifiedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIdentitySubjectUniqueViolation(error: unknown): boolean {
  if (!isRecord(error) || error.code !== "P2002" || !isRecord(error.meta)) {
    return false;
  }

  const adapterError = error.meta.driverAdapterError;
  if (!isRecord(adapterError) || !isRecord(adapterError.cause)) return false;

  const cause = adapterError.cause;
  if (
    cause.kind !== "UniqueConstraintViolation" ||
    !isRecord(cause.constraint) ||
    cause.constraint.index !== "UserIdentity_provider_providerSubject_key"
  ) {
    return false;
  }

  const constraint = cause.constraint;
  if ("fields" in constraint) {
    const fields = constraint.fields;
    if (
      !Array.isArray(fields) ||
      fields.length !== 2 ||
      fields[0] !== "provider" ||
      fields[1] !== "providerSubject"
    ) {
      return false;
    }
  }

  const reportedTables = [cause.table, error.meta.table].filter(
    (table) => table !== undefined,
  );
  const reportedModels = [cause.modelName, error.meta.modelName].filter(
    (model) => model !== undefined,
  );

  return (
    reportedTables.every((table) => table === "UserIdentity") &&
    reportedModels.every((model) => model === "UserIdentity")
  );
}

async function resultForExistingIdentity(
  existing: { id: string; userId: string; verifiedAt: Date | null } | null,
  userId: string,
  identity: ReturnType<typeof normalizeIdentityInput>,
  database: IdentityDatabase,
): Promise<IdentityOperationResult | null> {
  if (!existing) return null;
  if (existing.userId !== userId) return { status: "conflict" };
  if (existing.verifiedAt) return { status: "already-linked" };

  const verified = await database.userIdentity.updateMany({
    where: {
      id: existing.id,
      userId,
      provider: identity.provider,
      providerSubject: identity.providerSubject,
      verifiedAt: null,
    },
    data: {
      verifiedAt: identity.verifiedAt,
      ...(identity.provider === "EMAIL"
        ? { identifier: identity.identifier }
        : {}),
    },
  });

  if (verified.count === 1) return { status: "already-linked" };

  const current = await findIdentityByProviderSubject(
    identity.provider,
    identity.providerSubject,
    database,
  );
  if (!current || current.userId !== userId) {
    return current ? { status: "conflict" } : null;
  }

  return current.verifiedAt
    ? { status: "already-linked" }
    : { status: "conflict" };
}

export async function findIdentityByProviderSubject(
  provider: IdentityProvider,
  providerSubject: string,
  database: IdentityDatabase = prisma,
) {
  const normalizedSubject = normalizeIdentitySubject(provider, providerSubject);

  return database.userIdentity.findUnique({
    where: {
      provider_providerSubject: {
        provider,
        providerSubject: normalizedSubject,
      },
    },
  });
}

/**
 * Adds a verified identity to an existing account. For an enclosing Prisma
 * transaction, pass its transaction client so account, identity, and portfolio
 * creation can commit or roll back together. Call only after the provider
 * assertion or OTP has been verified server-side.
 */
export async function createVerifiedIdentity(
  userId: string,
  input: VerifiedIdentityInput,
  transaction?: Prisma.TransactionClient,
): Promise<IdentityOperationResult> {
  if (!userId.trim()) throw new TypeError("An identity owner is required.");

  const identity = normalizeIdentityInput(input);
  if (identity.provider === "EMAIL") {
    const owner = await (transaction ?? prisma).user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerifiedAt: true },
    });

    if (!owner) throw new IdentityAccountNotFoundError();
    if (
      owner.email?.trim().toLowerCase() !== identity.providerSubject ||
      !owner.emailVerifiedAt
    ) {
      return { status: "conflict" };
    }
  } else {
    const ownerExists = await (transaction ?? prisma).user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!ownerExists) throw new IdentityAccountNotFoundError();
  }

  const database: IdentityDatabase = transaction ?? prisma;
  const existing = await findIdentityByProviderSubject(
    identity.provider,
    identity.providerSubject,
    database,
  );
  const existingResult = await resultForExistingIdentity(
    existing,
    userId,
    identity,
    database,
  );
  if (existingResult) return existingResult;

  if (transaction) {
    // PostgreSQL's ON CONFLICT DO NOTHING keeps the enclosing transaction
    // usable, allowing a safe ownership recheck after a concurrent insert.
    const inserted = await transaction.userIdentity.createMany({
      data: [{ userId, ...identity }],
      skipDuplicates: true,
    });

    if (inserted.count === 1) return { status: "created" };

    const winner = await findIdentityByProviderSubject(
      identity.provider,
      identity.providerSubject,
      transaction,
    );
    const winnerResult = await resultForExistingIdentity(
      winner,
      userId,
      identity,
      transaction,
    );

    if (winnerResult) return winnerResult;
    throw new Error("Identity insertion was skipped by another unique constraint.");
  }

  try {
    await database.userIdentity.create({
      data: {
        userId,
        ...identity,
      },
    });

    return { status: "created" };
  } catch (error) {
    if (!isIdentitySubjectUniqueViolation(error)) throw error;

    // A failed PostgreSQL transaction cannot be queried again. Recheck using
    // the root client after the uniqueness collision and classify ownership.
    const winner = await findIdentityByProviderSubject(
      identity.provider,
      identity.providerSubject,
      prisma,
    );
    const winnerResult = await resultForExistingIdentity(
      winner,
      userId,
      identity,
      prisma,
    );

    if (winnerResult) return winnerResult;
    throw error;
  }
}

/**
 * Links a verified provider identity to the account in the active session.
 * expectedSessionId must come from trusted server-side flow state, never the
 * browser request body.
 */
export async function linkVerifiedIdentity(
  input: VerifiedIdentityInput,
  expectedSessionId: string,
): Promise<IdentityOperationResult> {
  if (!expectedSessionId.trim()) throw new AuthenticationRequiredError();

  const session = await getCurrentSessionDetails();
  if (!session || session.id !== expectedSessionId) {
    throw new AuthenticationRequiredError();
  }

  const now = new Date();
  const reauthenticatedAt = session.lastReauthenticatedAt?.getTime();

  if (
    reauthenticatedAt === undefined ||
    !Number.isFinite(reauthenticatedAt) ||
    reauthenticatedAt > now.getTime() ||
    now.getTime() - reauthenticatedAt > RECENT_AUTHENTICATION_WINDOW_MS
  ) {
    throw new AuthenticationRequiredError();
  }

  return prisma.$transaction(async (transaction) => {
    const recheckTime = new Date();
    const recentAuthenticationCutoff = new Date(
      recheckTime.getTime() - RECENT_AUTHENTICATION_WINDOW_MS,
    );

    // This conditional update locks and revalidates the same active session
    // immediately before identity creation. A concurrent logout/revocation
    // must either happen before this check or wait for this transaction.
    const activeSession = await transaction.userSession.updateMany({
      where: {
        id: expectedSessionId,
        userId: session.userId,
        revokedAt: null,
        expiresAt: { gt: recheckTime },
        lastReauthenticatedAt: {
          gte: recentAuthenticationCutoff,
          lte: recheckTime,
        },
      },
      data: { lastActiveAt: recheckTime },
    });

    if (activeSession.count !== 1) {
      throw new AuthenticationRequiredError();
    }

    return createVerifiedIdentity(session.userId, input, transaction);
  });
}
