import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { EmailActionPurpose } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canSkipAdditionalIdentityVerification } from "@/lib/auth-verification-policy";

const TOKEN_BYTES = 32;
const DEFAULT_EXPIRY_MINUTES = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function createEmailActionToken({
  userId,
  purpose,
  expiresInMinutes = DEFAULT_EXPIRY_MINUTES,
}: {
  userId: string;
  purpose: EmailActionPurpose;
  expiresInMinutes?: number;
}): Promise<string> {
  if (!userId.trim()) {
    throw new Error("A user ID is required.");
  }

  if (
    !Number.isInteger(expiresInMinutes) ||
    expiresInMinutes < 1 ||
    expiresInMinutes > 1440
  ) {
    throw new Error("Token expiry must be between 1 and 1440 minutes.");
  }

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + expiresInMinutes * 60 * 1000,
  );

  await prisma.$transaction(async (transaction) => {
    await transaction.emailActionToken.updateMany({
      where: {
        userId,
        purpose,
        consumedAt: null,
      },
      data: {
        consumedAt: now,
      },
    });

    await transaction.emailActionToken.create({
      data: {
        userId,
        purpose,
        tokenHash,
        expiresAt,
      },
    });
  });

  return token;
}

export async function consumeEmailActionToken({
  token,
  purpose,
}: {
  token: string;
  purpose: EmailActionPurpose;
}): Promise<{ userId: string } | null> {
  if (
    typeof token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  ) {
    return null;
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const storedToken = await transaction.emailActionToken.findUnique({
      where: {
        tokenHash,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!storedToken) {
      return null;
    }

    const consumed = await transaction.emailActionToken.updateMany({
      where: {
        id: storedToken.id,
        purpose,
        consumedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        consumedAt: now,
      },
    });

    if (consumed.count !== 1) {
      return null;
    }

    return {
      userId: storedToken.userId,
    };
  });
}

export async function resetPasswordWithEmailActionToken({
  token,
  passwordHash,
}: {
  token: string;
  passwordHash: string;
}): Promise<boolean> {
  if (
    typeof token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(token) ||
    typeof passwordHash !== "string" ||
    !passwordHash.trim()
  ) {
    return false;
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const storedToken = await transaction.emailActionToken.findFirst({
      where: {
        tokenHash,
        purpose: "PASSWORD_RESET",
        consumedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!storedToken) {
      return false;
    }

    const consumed = await transaction.emailActionToken.updateMany({
      where: {
        id: storedToken.id,
        purpose: "PASSWORD_RESET",
        consumedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        consumedAt: now,
      },
    });

    if (consumed.count !== 1) {
      return false;
    }

      await transaction.emailActionToken.updateMany({
        where: {
          userId: storedToken.userId,
          purpose: "PASSWORD_RESET",
          consumedAt: null,
        },
        data: {
          consumedAt: now,
        },
      });

    const updatedUser = await transaction.user.updateMany({
      where: {
        id: storedToken.userId,
      },
      data: {
        passwordHash,
      },
    });

    if (updatedUser.count !== 1) {
      throw new Error("Password reset account update failed.");
    }

    await transaction.userSession.updateMany({
      where: {
        userId: storedToken.userId,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        revokedAt: now,
      },
    });

    return true;
  });
}


export async function verifyEmailActionToken(
  token: string,
): Promise<boolean> {
  if (
    typeof token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  ) {
    return false;
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const storedToken = await transaction.emailActionToken.findFirst({
      where: {
        tokenHash,
        purpose: "VERIFY_EMAIL",
        consumedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
          },
        },
      },
    });

    if (
      !storedToken ||
      !storedToken.user.email ||
      storedToken.user.emailVerifiedAt
    ) {
      return false;
    }

    const consumed = await transaction.emailActionToken.updateMany({
      where: {
        id: storedToken.id,
        purpose: "VERIFY_EMAIL",
        consumedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        consumedAt: now,
      },
    });

    if (consumed.count !== 1) {
      return false;
    }

    const activated = await transaction.user.updateMany({
      where: {
        id: storedToken.user.id,
        emailVerifiedAt: null,
        email: storedToken.user.email,
      },
      data: {
        emailVerifiedAt: now,
      },
    });

    if (activated.count !== 1) {
      throw new Error("Email verification account update failed.");
    }

    const identity = await transaction.userIdentity.updateMany({
      where: {
        userId: storedToken.user.id,
        provider: "EMAIL",
        providerSubject: storedToken.user.email,
        verifiedAt: null,
      },
      data: {
        verifiedAt: now,
        identifier: storedToken.user.email,
      },
    });

    if (identity.count !== 1) {
      throw new Error("Email verification identity update failed.");
    }

    return true;
  });
}

export async function consumeVerifiedMagicLink(
  token: string,
): Promise<{ userId: string; verificationExempt: boolean } | null> {
  if (
    typeof token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  ) {
    return null;
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const storedToken = await transaction.emailActionToken.findFirst({
      where: {
        tokenHash,
        purpose: "MAGIC_LINK",
        consumedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            email: true,
            role: true,
            emailVerifiedAt: true,
            identities: {
              where: {
                provider: "EMAIL",
              },
              select: {
                providerSubject: true,
                verifiedAt: true,
              },
            },
          },
        },
      },
    });

    if (
      !storedToken ||
      !storedToken.user.email ||
      (!canSkipAdditionalIdentityVerification(storedToken.user.role) &&
        !storedToken.user.emailVerifiedAt)
    ) {
      return null;
    }

    const verifiedEmailIdentity = storedToken.user.identities.some(
      (identity) =>
        identity.providerSubject === storedToken.user.email &&
        identity.verifiedAt !== null,
    );

    if (
      !verifiedEmailIdentity &&
      !canSkipAdditionalIdentityVerification(storedToken.user.role)
    ) {
      return null;
    }

    const consumed = await transaction.emailActionToken.updateMany({
      where: {
        id: storedToken.id,
        purpose: "MAGIC_LINK",
        consumedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        consumedAt: now,
      },
    });

    if (consumed.count !== 1) {
      return null;
    }

    return {
      userId: storedToken.userId,
      verificationExempt: canSkipAdditionalIdentityVerification(storedToken.user.role) &&
        (!storedToken.user.emailVerifiedAt || !verifiedEmailIdentity),
    };
  });
}
