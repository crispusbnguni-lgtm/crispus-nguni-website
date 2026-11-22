import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { beginPreAuthTotpEnrollment } from "@/lib/mfa-security";
import { reportAuthOperationFailure } from "@/lib/auth-diagnostics";

export const dynamic = "force-dynamic";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  try { return Boolean(origin) && new URL(origin!).origin === new URL(request.url).origin; } catch { return false; }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ success: false, message: "Request could not be verified." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const token = (await cookies()).get("mfa_enrollment_pending")?.value;
  if (!token) return NextResponse.json({ success: false, message: "Enrollment authorization is invalid or expired." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const enrollment = await beginPreAuthTotpEnrollment(request, token);
    return NextResponse.json({ success: true, qrCodeDataUrl: enrollment.qrCodeDataUrl, manualSetupKey: enrollment.manualSetupKey, expiresAt: enrollment.expiresAt.toISOString() }, { headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } });
  } catch (error) {
    reportAuthOperationFailure("MFA_ENROLLMENT_SETUP", error);
    return NextResponse.json({ success: false, message: "Secure enrollment is temporarily unavailable. Please try again later." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
