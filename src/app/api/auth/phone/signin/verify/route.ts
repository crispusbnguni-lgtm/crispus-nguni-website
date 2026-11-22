import { verifyPhoneOtp } from "@/lib/phone-auth-routes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return verifyPhoneOtp(request, "signin");
}
