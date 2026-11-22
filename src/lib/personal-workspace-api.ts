import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireSameOriginApiRequest } from "@/lib/authorization";

export const WORKSPACE_NO_STORE = { "Cache-Control": "no-store" };

export async function workspaceApiUser(request: Request, mutation = false) {
  if (mutation) {
    const originError = requireSameOriginApiRequest(request);
    if (originError) return { user: null, response: originError };
  }
  const user = await getCurrentUser();
  if (!user) return { user: null, response: NextResponse.json({ success: false, message: "Authentication required." }, { status: 401, headers: WORKSPACE_NO_STORE }) };
  return { user, response: null };
}

export async function workspaceJson(request: Request, maxBytes = 64_000): Promise<{ success: true; value: unknown } | { success: false; response: NextResponse }> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) return { success: false, response: NextResponse.json({ success: false, message: "Request is too large." }, { status: 413, headers: WORKSPACE_NO_STORE }) };
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) return { success: false, response: NextResponse.json({ success: false, message: "Request is too large." }, { status: 413, headers: WORKSPACE_NO_STORE }) };
    return { success: true, value: JSON.parse(text) as unknown };
  } catch {
    return { success: false, response: NextResponse.json({ success: false, message: "Invalid JSON request." }, { status: 400, headers: WORKSPACE_NO_STORE }) };
  }
}

export function workspaceResult(result: unknown) {
  if (typeof result === "object" && result !== null && "ok" in result) {
    const item = result as { ok: boolean; value?: unknown; status?: number; code?: string; message?: string; currentRevision?: number };
    if (!item.ok) return NextResponse.json({ success: false, code: item.code, message: item.message, ...(item.currentRevision !== undefined ? { currentRevision: item.currentRevision } : {}) }, { status: item.status ?? 400, headers: WORKSPACE_NO_STORE });
    return NextResponse.json({ success: true, data: item.value }, { headers: WORKSPACE_NO_STORE });
  }
  return NextResponse.json({ success: true, data: result }, { headers: WORKSPACE_NO_STORE });
}

export function workspaceError() {
  return NextResponse.json({ success: false, message: "Unable to complete the workspace request." }, { status: 500, headers: WORKSPACE_NO_STORE });
}
