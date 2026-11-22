import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createVerifiedIdentity } from "@/lib/auth-identities";

export async function phoneIdentityExists(phone: string): Promise<boolean> {
  const identity = await prisma.userIdentity.findFirst({
    where: {
      provider: "PHONE",
      OR: [
        { providerSubject: { equals: phone, mode: "insensitive" } },
        { identifier: { equals: phone, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return identity !== null;
}

export async function createPhoneSignupAccount({
  phone,
  name,
}: {
  phone: string;
  name: string;
}): Promise<string | null> {
  try {
    return await prisma.$transaction(async (transaction) => {
    const existingIdentity = await transaction.userIdentity.findFirst({
      where: {
        provider: "PHONE",
        OR: [
          { providerSubject: { equals: phone, mode: "insensitive" } },
          { identifier: { equals: phone, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (existingIdentity) return null;

    const user = await transaction.user.create({
      data: {
        name,
        role: "USER",
        portfolioSite: {
          create: {
            name,
            title: "Professional Portfolio",
            bio: "Welcome to my professional portfolio.",
            slug: `${name
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "") || "portfolio"}-${randomUUID()}`,
            published: false,
          },
        },
      },
      select: { id: true },
    });

    const identity = await createVerifiedIdentity(
      user.id,
      { provider: "PHONE", providerSubject: phone, identifier: phone },
      transaction,
    );
    if (identity.status !== "created") {
      throw new PhoneIdentityConflictError();
    }

    return user.id;
    });
  } catch (error) {
    if (error instanceof PhoneIdentityConflictError) return null;
    throw error;
  }
}

class PhoneIdentityConflictError extends Error {}
