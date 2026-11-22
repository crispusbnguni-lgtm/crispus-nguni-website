import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser, requireSameOriginApiRequest } from "@/lib/authorization";
import {
  DEFAULT_INTELLIGENCE_PERMISSIONS,
  normalizeIntelligencePermissions,
  parseDismissedInsightIds,
  parseIntelligenceFeedback,
  parseIntelligencePermissionSet,
} from "@/lib/personal-intelligence-core";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const MAX_BODY_BYTES = 16_384;

type PreferencesRow = {
  intelligencePermissions: Prisma.JsonValue;
  intelligenceDismissedIds: string[];
  intelligenceFeedback: Prisma.JsonValue;
};

function responsePreferences(row: PreferencesRow | null) {
  return {
    permissions: row ? normalizeIntelligencePermissions(row.intelligencePermissions) : { ...DEFAULT_INTELLIGENCE_PERMISSIONS },
    dismissedIds: row ? parseDismissedInsightIds(row.intelligenceDismissedIds) ?? [] : [],
    feedback: row ? parseIntelligenceFeedback(row.intelligenceFeedback) ?? {} : {},
  };
}

async function readBoundedJson(request: Request): Promise<unknown | null> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_BODY_BYTES) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  try {
    const row = await prisma.personalWorkspace.findUnique({
      where: { userId: auth.user.id },
      select: { intelligencePermissions: true, intelligenceDismissedIds: true, intelligenceFeedback: true },
    });
    return NextResponse.json({ success: true, ...responsePreferences(row) }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ success: false, message: "Intelligence preferences are temporarily unavailable." }, { status: 503, headers: NO_STORE });
  }
}

export async function PATCH(request: Request) {
  const originFailure = requireSameOriginApiRequest(request);
  if (originFailure) return originFailure;
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch {
    return NextResponse.json({ success: false, message: "Invalid preference request." }, { status: 400, headers: NO_STORE });
  }
  if (body === null) return NextResponse.json({ success: false, message: "Preference request is too large or empty." }, { status: 413, headers: NO_STORE });
  if (typeof body !== "object" || Array.isArray(body) || Object.getPrototypeOf(body) !== Object.prototype) {
    return NextResponse.json({ success: false, message: "Invalid preference request." }, { status: 400, headers: NO_STORE });
  }
  const input = body as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length === 0 || keys.some((key) => !["permissions", "dismissedIds", "feedback"].includes(key))) {
    return NextResponse.json({ success: false, message: "Unsupported preference fields." }, { status: 400, headers: NO_STORE });
  }

  const data: {
    intelligencePermissions?: Prisma.InputJsonValue;
    intelligenceDismissedIds?: string[];
    intelligenceFeedback?: Prisma.InputJsonValue;
  } = {};
  if (Object.hasOwn(input, "permissions")) {
    const permissions = parseIntelligencePermissionSet(input.permissions);
    if (!permissions) return NextResponse.json({ success: false, message: "Choose a valid set of source permissions." }, { status: 400, headers: NO_STORE });
    data.intelligencePermissions = permissions;
  }
  if (Object.hasOwn(input, "dismissedIds")) {
    const dismissedIds = parseDismissedInsightIds(input.dismissedIds);
    if (!dismissedIds) return NextResponse.json({ success: false, message: "Dismissed insight list is invalid." }, { status: 400, headers: NO_STORE });
    data.intelligenceDismissedIds = dismissedIds;
  }
  if (Object.hasOwn(input, "feedback")) {
    const feedback = parseIntelligenceFeedback(input.feedback);
    if (!feedback) return NextResponse.json({ success: false, message: "Insight feedback is invalid." }, { status: 400, headers: NO_STORE });
    data.intelligenceFeedback = { ...feedback };
  }

  try {
    const row = await prisma.personalWorkspace.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id, ...data },
      update: data,
      select: { intelligencePermissions: true, intelligenceDismissedIds: true, intelligenceFeedback: true },
    });
    return NextResponse.json({ success: true, ...responsePreferences(row) }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ success: false, message: "Intelligence preferences could not be saved." }, { status: 503, headers: NO_STORE });
  }
}
