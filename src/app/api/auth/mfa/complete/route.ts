import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyPendingMfaChallenge } from "@/lib/mfa-security";
import { finalizeMfaLogin } from "@/lib/auth-completion";
import { reportAuthOperationFailure } from "@/lib/auth-diagnostics";

export const dynamic = "force-dynamic";

function clearPendingCookie(response: NextResponse) {
  response.cookies.set("mfa_login_pending", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/mfa/complete",
    maxAge: 0,
  });
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
      return NextResponse.json({ success: false, message: "Request could not be verified." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    return NextResponse.json({ success: false, message: "Request could not be verified." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const token = (await cookies()).get("mfa_login_pending")?.value;
  if (!token) return NextResponse.json({ success: false, message: "The authentication challenge is invalid or expired." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  let code: unknown;
  try {
    const body: unknown = await request.json();
    code = body && typeof body === "object" && !Array.isArray(body) ? (body as { code?: unknown }).code : undefined;
  } catch {
    code = undefined;
  }
  let result: Awaited<ReturnType<typeof verifyPendingMfaChallenge>>;
  try {
    result = await verifyPendingMfaChallenge(request, token, code);
  } catch (error) {
    reportAuthOperationFailure("MFA_CHALLENGE_VERIFY", error);
    return NextResponse.json({ success: false, message: "Secure verification is temporarily unavailable. Please authenticate again later." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (result.status === "invalid") {
    return NextResponse.json({ success: false, message: "The code is invalid.", attemptsRemaining: result.attemptsRemaining }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (result.status !== "verified") {
    const response = NextResponse.json({ success: false, message: "The authentication challenge is invalid or expired." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    clearPendingCookie(response);
    return response;
  }
  try {
    await finalizeMfaLogin(request, result.completion);
    const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
    clearPendingCookie(response);
    return response;
  } catch (error) {
    reportAuthOperationFailure("MFA_SESSION_CREATE", error);
    return NextResponse.json({ success: false, message: "Sign-in could not be completed. Please authenticate again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
