import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";

const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
globalThis.__mfaEnrollmentRoute = { token: "Z".repeat(43), result: null, calls: [] };

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/headers") return { url: data(`export async function cookies() { return { get(name) { return name === "mfa_enrollment_pending" ? { value: globalThis.__mfaEnrollmentRoute.token } : undefined; } }; }`), shortCircuit: true };
    if (specifier === "next/server") return { url: data(`export class NextResponse extends Response { constructor(body, init={}) { super(body, init); this.cookies = { set: (name, _value, options={}) => this.headers.append("set-cookie", name + "=; Path=" + (options.path ?? "/") + "; Max-Age=" + (options.maxAge ?? 0)) }; } static json(body, init={}) { return new NextResponse(JSON.stringify(body), { status: init.status ?? 200, headers: { "content-type": "application/json", ...(init.headers ?? {}) } }); } }`), shortCircuit: true };
    if (specifier === "@/lib/mfa-security") return { url: data(`export async function beginPreAuthTotpEnrollment(...args) { globalThis.__mfaEnrollmentRoute.calls.push(["start", args[0] instanceof Request, args[1]]); return { qrCodeDataUrl: "data:image/png;base64,QR", manualSetupKey: "ABCDEFGHIJKLMNOP", expiresAt: new Date(Date.now()+300000) }; } export async function confirmPreAuthTotpEnrollment(...args) { globalThis.__mfaEnrollmentRoute.calls.push(["confirm", args[0] instanceof Request, args[1], args[2]]); return globalThis.__mfaEnrollmentRoute.result; }`), shortCircuit: true };
    if (specifier === "@/lib/auth-diagnostics") return { url: data("export function reportAuthOperationFailure() {}"), shortCircuit: true };
    return next(specifier, context);
  },
});

const [{ POST: startEnrollment }, { POST: confirmEnrollment }] = await Promise.all([
  import("../src/app/api/auth/mfa/enrollment/start/route.ts"),
  import("../src/app/api/auth/mfa/enrollment/confirm/route.ts"),
]);

function request(url, body = {}) {
  return new Request(url, { method: "POST", headers: { origin: new URL(url).origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}

test("enrollment setup endpoint returns only the restricted QR and manual key with no-store headers", async () => {
  globalThis.__mfaEnrollmentRoute.calls.length = 0;
  const response = await startEnrollment(request("https://example.test/api/auth/mfa/enrollment/start"));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(result.qrCodeDataUrl, "data:image/png;base64,QR");
  assert.equal(result.manualSetupKey, "ABCDEFGHIJKLMNOP");
  assert.equal(JSON.stringify(result).includes(globalThis.__mfaEnrollmentRoute.token), false);
  assert.deepEqual(globalThis.__mfaEnrollmentRoute.calls[0], ["start", true, globalThis.__mfaEnrollmentRoute.token]);
});

test("enrollment confirmation exposes one-time recovery codes only after success and expires the restricted cookie", async () => {
  globalThis.__mfaEnrollmentRoute.result = { enabled: true, recoveryCodes: ["AAAA-BBBB-CCCC"] };
  const response = await confirmEnrollment(request("https://example.test/api/auth/mfa/enrollment/confirm", { code: "123456" }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(result.recoveryCodes, ["AAAA-BBBB-CCCC"]);
  assert.equal(globalThis.__mfaEnrollmentRoute.calls.at(-1)[3], "123456");
  assert.match(response.headers.get("set-cookie") ?? "", /mfa_enrollment_pending=.*Max-Age=0/i);
});

test("visible pages use the existing restricted endpoints and never put pending credentials in URLs", async () => {
  const root = new URL("../src/app/", import.meta.url);
  const enrollment = await readFile(new URL("mfa/enroll/page.tsx", root), "utf8");
  const enrollmentClient = await readFile(new URL("mfa/enroll/MfaEnrollmentClient.tsx", root), "utf8");
  const challenge = await readFile(new URL("mfa/challenge/page.tsx", root), "utf8");
  const login = await readFile(new URL("login/page.tsx", root), "utf8");
  const phone = await readFile(new URL("../components/auth/PhoneOtpPanel.tsx", new URL("../src/app/", import.meta.url)), "utf8");
  const magic = await readFile(new URL("magic-link/MagicLinkClient.tsx", root), "utf8");
  assert.match(enrollmentClient, /\/api\/auth\/mfa\/enrollment\/start/);
  assert.match(enrollmentClient, /\/api\/auth\/mfa\/enrollment\/confirm/);
  assert.match(enrollmentClient, /manualSetupKey/);
  assert.match(enrollmentClient, /recoveryCodes/);
  assert.match(enrollmentClient, /@\/components\/ui\/LiquidLensSurface/);
  assert.match(challenge, /\/api\/auth\/mfa\/complete/);
  assert.match(challenge, /router\.replace\("\/dashboard"\)/);
  assert.match(challenge, /Recovery code/);
  for (const source of [login, phone, magic]) {
    assert.match(source, /router\.replace\("\/mfa\/enroll"\)/);
    assert.match(source, /router\.replace\("\/mfa\/challenge"\)/);
  }
  assert.doesNotMatch(enrollment, /searchParams\.set\([^)]*(?:token|secret)/i);
  assert.doesNotMatch(enrollmentClient, /searchParams\.set\([^)]*(?:token|secret)/i);
  assert.doesNotMatch(challenge, /searchParams\.set\([^)]*(?:token|secret)/i);
});
