import { sendPhoneOtp } from "@/lib/phone-auth-routes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return sendPhoneOtp(request, "signup");
}
