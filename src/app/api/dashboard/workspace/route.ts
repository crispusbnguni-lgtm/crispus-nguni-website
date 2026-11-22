import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireSameOriginApiRequest } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  parseWorkspacePreferences,
  type WorkspacePreferences,
} from "@/lib/personal-workspace-core";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

function preferencesFromRow(row: {
  mode: string;
  focusAreas: string[];
  timezone: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  breakMinutes: number;
  weekStartsOn: number;
}): WorkspacePreferences {
  const candidate = {
    mode: row.mode,
    focusAreas: row.focusAreas,
    timezone: row.timezone,
    workingHoursStart: row.workingHoursStart,
    workingHoursEnd: row.workingHoursEnd,
    breakMinutes: row.breakMinutes,
    weekStartsOn: row.weekStartsOn,
  };
  const parsed = parseWorkspacePreferences(candidate);
  return parsed.success ? parsed.preferences : DEFAULT_WORKSPACE_PREFERENCES;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401, headers: NO_STORE },
      );
    }

    const workspace = await prisma.personalWorkspace.findUnique({
      where: { userId: user.id },
      select: {
        mode: true,
        focusAreas: true,
        timezone: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        breakMinutes: true,
        weekStartsOn: true,
        revision: true,
        onboardingCompletedAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        configured: Boolean(workspace?.onboardingCompletedAt),
        preferences: workspace
          ? preferencesFromRow(workspace)
          : DEFAULT_WORKSPACE_PREFERENCES,
        updatedAt: workspace?.updatedAt.toISOString() ?? null,
        revision: workspace?.revision ?? null,
      },
      { headers: NO_STORE },
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to load workspace preferences." },
      { status: 500, headers: NO_STORE },
    );
  }
}

export async function PATCH(request: Request) {
  const originResponse = requireSameOriginApiRequest(request);
  if (originResponse) return originResponse;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401, headers: NO_STORE },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body." },
      { status: 400, headers: NO_STORE },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.getPrototypeOf(body) !== Object.prototype
  ) {
    return NextResponse.json(
      { success: false, message: "Invalid request body." },
      { status: 400, headers: NO_STORE },
    );
  }

  const record = body as Record<string, unknown>;
  const requestKeys = Object.keys(record);
  if (
    requestKeys.length !== 2 ||
    !Object.prototype.hasOwnProperty.call(record, "preferences") ||
    !Object.prototype.hasOwnProperty.call(record, "expectedRevision")
  ) {
    return NextResponse.json(
      { success: false, message: "Unsupported workspace update." },
      { status: 400, headers: NO_STORE },
    );
  }

  const expectedRevision = record.expectedRevision;
  if (
    expectedRevision !== null &&
    (typeof expectedRevision !== "number" ||
      !Number.isInteger(expectedRevision) ||
      expectedRevision < 0)
  ) {
    return NextResponse.json(
      { success: false, message: "Workspace version is invalid." },
      { status: 400, headers: NO_STORE },
    );
  }

  const parsed = parseWorkspacePreferences(record.preferences);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.message },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const current = await prisma.personalWorkspace.findUnique({
      where: { userId: user.id },
      select: { revision: true },
    });

    if (
      (expectedRevision === null && current !== null) ||
      (expectedRevision !== null &&
        (!current || current.revision !== expectedRevision))
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "WORKSPACE_VERSION_CONFLICT",
          message: "Workspace preferences changed elsewhere. Refresh and try again.",
        },
        { status: 409, headers: NO_STORE },
      );
    }

    const data = {
      ...parsed.preferences,
      onboardingCompletedAt: new Date(),
    };

    if (!current) {
      await prisma.personalWorkspace.create({
        data: { userId: user.id, ...data },
      });
    } else {
      const updated = await prisma.personalWorkspace.updateMany({
        where: { userId: user.id, revision: expectedRevision! },
        data: { ...data, revision: { increment: 1 } },
      });
      if (updated.count !== 1) {
        return NextResponse.json(
          {
            success: false,
            code: "WORKSPACE_VERSION_CONFLICT",
            message: "Workspace preferences changed elsewhere. Refresh and try again.",
          },
          { status: 409, headers: NO_STORE },
        );
      }
    }

    const workspace = await prisma.personalWorkspace.findUnique({
      where: { userId: user.id },
      select: {
        mode: true,
        focusAreas: true,
        timezone: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        breakMinutes: true,
        weekStartsOn: true,
        revision: true,
        onboardingCompletedAt: true,
        updatedAt: true,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { success: false, message: "Unable to save workspace preferences." },
        { status: 500, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      {
        success: true,
        configured: true,
        preferences: preferencesFromRow(workspace),
        updatedAt: workspace.updatedAt.toISOString(),
        revision: workspace.revision,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "WORKSPACE_VERSION_CONFLICT",
          message: "Workspace preferences changed elsewhere. Refresh and try again.",
        },
        { status: 409, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to save workspace preferences." },
      { status: 500, headers: NO_STORE },
    );
  }
}
