import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { confirmPreAuthTotpEnrollment } from "@/lib/mfa-security";
import { reportAuthOperationFailure } from "@/lib/auth-diagnostics";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).origin !== new URL(request.url).origin) throw new Error("origin");
  } catch {
    return NextResponse.json({ success: false, message: "Request could not be verified." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const token = (await cookies()).get("mfa_enrollment_pending")?.value;
  if (!token) return NextResponse.json({ success: false, message: "Enrollment authorization is invalid or expired." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  let code: unknown;
  try { const body: unknown = await request.json(); code = body && typeof body === "object" && !Array.isArray(body) ? (body as { code?: unknown }).code : undefined; } catch { code = undefined; }
  try {
    const result = await confirmPreAuthTotpEnrollment(request, token, code);
    const response = NextResponse.json({ success: result.enabled, ...(result.enabled ? { recoveryCodes: result.recoveryCodes } : { message: result.reason === "EXPIRED" ? "Enrollment expired. Authenticate again to restart." : "The code is invalid. Check the authenticator and try again." }) }, { status: result.enabled ? 200 : 400, headers: { "Cache-Control": "no-store" } });
    if (result.enabled) response.cookies.set("mfa_enrollment_pending", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/auth/mfa/enrollment", maxAge: 0 });
    return response;
  } catch (error) {
    reportAuthOperationFailure("MFA_ENROLLMENT_CONFIRM", error);
    return NextResponse.json({ success: false, message: "Secure enrollment is temporarily unavailable. Please try again later." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
