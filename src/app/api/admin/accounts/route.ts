
import { NextRequest, NextResponse } from "next/server";
import type { AdminAccountStatus, AdminVerificationStatus, Prisma } from "@prisma/client";
import { requireApiPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 50;
const MAX_PAGE = 1_000_000;
const MAX_SEARCH_LENGTH = 100;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

function isAccountStatus(value: string | null): value is AdminAccountStatus {
  return value === "ACTIVE" || value === "SUSPENDED" || value === "BANNED";
}

function isVerificationStatus(value: string | null): value is AdminVerificationStatus {
  return value === "PENDING" || value === "VERIFIED" || value === "REJECTED";
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate and authorize before accessing account data.
    const authorization = await requireApiPermission("ACCOUNT_VIEW");

    if (authorization.response) {
      return authorization.response;
    }

    const params = request.nextUrl.searchParams;
    const search = (params.get("search") ?? "")
      .trim()
      .slice(0, MAX_SEARCH_LENGTH);
    const accountStatusFilter = params.get("accountStatus");
    const verificationStatusFilter = params.get("verificationStatus");

    const requestedPage = Number(params.get("page") ?? "1");

    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? Math.min(requestedPage, MAX_PAGE)
        : 1;

    const now = new Date();

    const where: Prisma.UserWhereInput = {
      ...(search
        ? { OR: [
            {
              name: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              email: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ] }
        : {}),
      ...(isAccountStatus(accountStatusFilter)
        ? { accountStatus: accountStatusFilter }
        : {}),
      ...(isVerificationStatus(verificationStatusFilter)
        ? { verificationStatus: verificationStatusFilter }
        : {}),
    };

    const [totalUsers, matchingUsers, activeSessions, users] =
      await prisma.$transaction([
        prisma.user.count(),
        prisma.user.count({ where }),
        prisma.userSession.count({
          where: {
            revokedAt: null,
            expiresAt: { gt: now },
          },
        }),
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            accountStatus: true,
            accountStatusReason: true,
            accountSuspendedUntil: true,
            verificationStatus: true,
            verificationReason: true,
            emailVerifiedAt: true,
            identities: {
              where: { provider: "PHONE" },
              select: { verifiedAt: true },
            },
            totpCredential: { select: { verifiedAt: true } },
            portfolioSite: {
              select: {
                id: true,
                slug: true,
                published: true,
                title: true,
              },
            },
            sessions: {
              where: {
                revokedAt: null,
                expiresAt: { gt: now },
              },
              orderBy: { lastActiveAt: "desc" },
              select: {
                id: true,
                deviceLabel: true,
                createdAt: true,
                lastActiveAt: true,
                expiresAt: true,
              },
            },
          },
        }),
      ]);

    return NextResponse.json(
      {
        success: true,
        accounts: users.map((user) => ({
          ...user,
          activeSessionCount: user.sessions.length,
          status: user.sessions.length > 0 ? "ONLINE" : "OFFLINE",
          emailVerified: user.emailVerifiedAt !== null,
          phoneVerified: user.identities.some((identity) => identity.verifiedAt !== null),
          mfaEnrolled: user.totpCredential?.verifiedAt !== null && user.totpCredential?.verifiedAt !== undefined,
        })),
        pagination: {
          page,
          pageSize: PAGE_SIZE,
          total: matchingUsers,
          totalPages: Math.ceil(matchingUsers / PAGE_SIZE),
        },
        stats: {
          totalUsers,
          activeSessions,
        },
      },
      {
        headers: NO_STORE_HEADERS,
      },
    );
  } catch (error) {
    console.error("Admin account directory error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load registered accounts.",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      },
    );
  }
}
