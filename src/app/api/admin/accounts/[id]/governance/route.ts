import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiPermission, requireSameOriginApiRequest } from "@/lib/authorization";
import {
  resolveAdminAuditActor,
  writeAdminAudit,
  type AdminAuditAction,
} from "@/lib/admin-audit";
import type { AdminPermission } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { isAccountAccessAllowed } from "@/lib/account-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "Cache-Control": "no-store" };
const actions = ["VERIFY", "REJECT", "SUSPEND", "BAN", "REINSTATE", "REVOKE_SESSIONS"] as const;
type GovernanceAction = (typeof actions)[number];

const actionPolicy: Record<GovernanceAction, { permission: AdminPermission; audit: AdminAuditAction }> = {
  VERIFY: { permission: "ACCOUNT_VERIFY", audit: "ADMIN_ACCOUNT_VERIFIED" },
  REJECT: { permission: "ACCOUNT_VERIFY", audit: "ADMIN_ACCOUNT_VERIFICATION_REJECTED" },
  SUSPEND: { permission: "ACCOUNT_SUSPEND", audit: "ADMIN_ACCOUNT_SUSPENDED" },
  BAN: { permission: "ACCOUNT_BAN", audit: "ADMIN_ACCOUNT_BANNED" },
  REINSTATE: { permission: "ACCOUNT_REINSTATE", audit: "ADMIN_ACCOUNT_REINSTATED" },
  REVOKE_SESSIONS: { permission: "SESSION_REVOKE", audit: "ADMIN_ALL_SESSIONS_REVOKED" },
};

class GovernanceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function validReason(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 6 && value.length <= 500;
}

function parseAction(value: unknown): value is GovernanceAction {
  return typeof value === "string" && (actions as readonly string[]).includes(value);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const accountAuth = await requireApiPermission("ACCOUNT_VIEW");
    if (accountAuth.response) return accountAuth.response;
    const auditAuth = await requireApiPermission("AUDIT_VIEW");
    if (auditAuth.response) return auditAuth.response;
    const { id } = await context.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        emailVerifiedAt: true,
        accountStatus: true,
        accountStatusReason: true,
        accountSuspendedUntil: true,
        verificationStatus: true,
        verificationReason: true,
        identities: { where: { provider: "PHONE" }, select: { verifiedAt: true } },
        totpCredential: { select: { verifiedAt: true } },
        _count: { select: { recoveryCodes: { where: { revokedAt: null, usedAt: null } } } },
      },
    });
    if (!user) return NextResponse.json({ success: false, message: "Account not found." }, { status: 404, headers: noStore });

    const history = await prisma.auditLog.findMany({
      where: {
        targetType: "User",
        targetId: user.id,
        action: { in: [
          "ADMIN_ACCOUNT_VERIFIED",
          "ADMIN_ACCOUNT_VERIFICATION_REJECTED",
          "ADMIN_ACCOUNT_SUSPENDED",
          "ADMIN_ACCOUNT_BANNED",
          "ADMIN_ACCOUNT_REINSTATED",
          "ADMIN_ALL_SESSIONS_REVOKED",
        ] },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        eventId: true,
        action: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, name: true } },
      },
    });

    const now = new Date();
    return NextResponse.json({
      success: true,
      account: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        accountStatus: user.accountStatus,
        accountStatusReason: user.accountStatusReason,
        accountSuspendedUntil: user.accountSuspendedUntil,
        verificationStatus: user.verificationStatus,
        verificationReason: user.verificationReason,
        accessAllowed: isAccountAccessAllowed(user, now),
        emailVerified: user.emailVerifiedAt !== null,
        phoneVerified: user.identities.some((identity) => identity.verifiedAt !== null),
        mfaEnrolled: user.totpCredential?.verifiedAt !== null && user.totpCredential?.verifiedAt !== undefined,
        activeRecoveryCodeCount: user._count.recoveryCodes,
      },
      history,
    }, { headers: noStore });
  } catch {
    return NextResponse.json({ success: false, message: "Unable to load account governance details." }, { status: 500, headers: noStore });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const accountAuth = await requireApiPermission("ACCOUNT_VIEW");
    if (accountAuth.response) return accountAuth.response;
    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) return originResponse;

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400, headers: noStore });
    }
    const record = body as Record<string, unknown>;
    if (!parseAction(record.action) || !validReason(record.reason)) {
      return NextResponse.json({ success: false, message: "A supported action and reason are required." }, { status: 400, headers: noStore });
    }
    const action = record.action;
    const reason = record.reason.trim();
    const { id: targetUserId } = await context.params;
    const actionAuth = await requireApiPermission(actionPolicy[action].permission);
    if (actionAuth.response) return actionAuth.response;
    const actor = await resolveAdminAuditActor();
    if (actor.userId !== accountAuth.user.id) {
      return NextResponse.json({ success: false, message: "Administrative authorization changed. Sign in again." }, { status: 403, headers: noStore });
    }

    let suspensionExpiry: Date | null = null;
    if (action === "SUSPEND" && record.expiresAt !== undefined && record.expiresAt !== null && record.expiresAt !== "") {
      if (typeof record.expiresAt !== "string") {
        return NextResponse.json({ success: false, message: "Suspension expiry must be a valid date." }, { status: 400, headers: noStore });
      }
      suspensionExpiry = new Date(record.expiresAt);
      if (!Number.isFinite(suspensionExpiry.getTime()) || suspensionExpiry <= new Date()) {
        return NextResponse.json({ success: false, message: "Suspension expiry must be in the future." }, { status: 400, headers: noStore });
      }
    } else if (action !== "SUSPEND" && record.expiresAt !== undefined) {
      return NextResponse.json({ success: false, message: "Expiry is supported only for suspensions." }, { status: 400, headers: noStore });
    }

    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          role: true,
          accountStatus: true,
          verificationStatus: true,
        },
      });
      if (!target) throw new GovernanceError(404, "Account not found.");
      if (target.id === actor.userId) throw new GovernanceError(409, "You cannot administer your own account.");

      if (
        target.role === "SUPER_ADMIN" &&
        (action === "REJECT" || action === "SUSPEND" || action === "BAN")
      ) {
        const activeAdministrators = await tx.user.count({
          where: {
            role: "SUPER_ADMIN",
            verificationStatus: { not: "REJECTED" },
            OR: [
              { accountStatus: "ACTIVE" },
              { accountStatus: "SUSPENDED", accountSuspendedUntil: { lte: new Date() } },
            ],
          },
        });
        if (activeAdministrators <= 1) {
          throw new GovernanceError(409, "The last active Super Admin cannot be disabled.");
        }
      }

      if (action === "REVOKE_SESSIONS") {
        const now = new Date();
        const revoked = await tx.userSession.updateMany({
          where: { userId: target.id, revokedAt: null, expiresAt: { gt: now } },
          data: { revokedAt: now },
        });
        await writeAdminAudit(actor, {
          action: actionPolicy[action].audit,
          targetType: "User",
          targetId: target.id,
          metadata: { actionReason: reason, changedFields: ["sessions"], revokedCount: revoked.count },
          reason: "ADMIN_REQUEST",
          outcome: "SUCCEEDED",
        }, tx);
        return { changed: revoked.count > 0, revokedCount: revoked.count };
      }

      const now = new Date();
      let data: Prisma.UserUpdateManyMutationInput;
      let changedFields: string[];
      switch (action) {
        case "VERIFY":
          if (target.verificationStatus === "VERIFIED") throw new GovernanceError(409, "Account is already verified.");
          data = { verificationStatus: "VERIFIED", verificationReason: reason };
          changedFields = ["verificationStatus", "verificationReason"];
          break;
        case "REJECT":
          if (target.verificationStatus === "REJECTED") throw new GovernanceError(409, "Account is already rejected.");
          data = { verificationStatus: "REJECTED", verificationReason: reason };
          changedFields = ["verificationStatus", "verificationReason"];
          break;
        case "SUSPEND":
          if (target.accountStatus === "BANNED") throw new GovernanceError(409, "A banned account cannot be suspended.");
          if (target.accountStatus === "SUSPENDED") throw new GovernanceError(409, "Account is already suspended.");
          data = { accountStatus: "SUSPENDED", accountStatusReason: reason, accountSuspendedUntil: suspensionExpiry };
          changedFields = ["accountStatus", "accountStatusReason", "accountSuspendedUntil"];
          break;
        case "BAN":
          if (target.accountStatus === "BANNED") throw new GovernanceError(409, "Account is already banned.");
          data = { accountStatus: "BANNED", accountStatusReason: reason, accountSuspendedUntil: null };
          changedFields = ["accountStatus", "accountStatusReason", "accountSuspendedUntil"];
          break;
        case "REINSTATE":
          if (target.accountStatus === "ACTIVE" && target.verificationStatus !== "REJECTED") throw new GovernanceError(409, "Account is already active.");
          data = {
            accountStatus: "ACTIVE",
            accountStatusReason: reason,
            accountSuspendedUntil: null,
            ...(target.verificationStatus === "REJECTED" ? { verificationStatus: "PENDING" } : {}),
          };
          changedFields = ["accountStatus", "accountStatusReason", "accountSuspendedUntil", ...(target.verificationStatus === "REJECTED" ? ["verificationStatus"] : [])];
          break;
        default:
          throw new GovernanceError(400, "Unsupported account action.");
      }

      const updated = await tx.user.updateMany({
        where: { id: target.id, accountStatus: target.accountStatus, verificationStatus: target.verificationStatus },
        data,
      });
      if (updated.count !== 1) throw new GovernanceError(409, "Account changed during this request. Refresh and try again.");

      await writeAdminAudit(actor, {
        action: actionPolicy[action].audit,
        targetType: "User",
        targetId: target.id,
        metadata: { actionReason: reason, changedFields },
        reason: "ADMIN_REQUEST",
        outcome: "SUCCEEDED",
      }, tx);

      if (action === "REJECT" || action === "SUSPEND" || action === "BAN") {
        const revoked = await tx.userSession.updateMany({
          where: { userId: target.id, revokedAt: null, expiresAt: { gt: now } },
          data: { revokedAt: now },
        });
        if (revoked.count > 0) {
          await writeAdminAudit(actor, {
            action: "ADMIN_ALL_SESSIONS_REVOKED",
            targetType: "User",
            targetId: target.id,
            metadata: { actionReason: reason, changedFields: ["sessions"], revokedCount: revoked.count },
            reason: "POLICY_ENFORCEMENT",
            outcome: "SUCCEEDED",
          }, tx);
        }
      }
      return { changed: true, revokedCount: 0 };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ success: true, ...result }, { headers: noStore });
  } catch (error) {
    if (error instanceof GovernanceError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status, headers: noStore });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ success: false, message: "Account changed concurrently. Refresh and try again." }, { status: 409, headers: noStore });
    }
    return NextResponse.json({ success: false, message: "Unable to complete the account action." }, { status: 500, headers: noStore });
  }
}
