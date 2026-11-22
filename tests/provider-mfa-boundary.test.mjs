import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const state = globalThis.__providerMfa = {
  sessions: [],
  decision: { required: true, enrollmentRequired: true, authorization: { token: "E".repeat(43), expiresAt: Date.now() + 240_000 } },
  user: null,
  emailIdentity: null,
  phoneIdentity: null,
  magicLink: null,
  phoneChallenge: null,
  googleTransaction: null,
  passkey: null,
  passkeyCounterUpdateCount: 1,
  webauthnChallengeValid: true,
  mfaCompletion: null,
  rateLimit: { limited: false, unavailable: false },
  rateLimitCalls: 0,
  exemptionCalls: [],
  diagnostics: [],
  blocked: false,
  mfaError: null,
};

const prisma = {
  user: { async findUnique() { return state.user; } },
  userIdentity: {
    async findUnique({ where }) { return where?.provider_providerSubject?.provider === "PHONE" ? state.phoneIdentity : state.emailIdentity; },
    async findFirst() { return null; },
  },
  passkeyCredential: {
    async findUnique() { return state.passkey; },
    async updateMany() { return { count: state.passkeyCounterUpdateCount }; },
  },
  async $transaction(fn) { return fn(prisma); },
};

registerHooks({
  resolve(specifier, context, next) {
    const mocks = {
      "server-only": "",
      "next/server": `
        export class NextResponse extends Response {
          cookies = { set: (name, value, options) => { (this.cookieWrites ??= []).push({ name, value, options }); } };
          static json(body, init = {}) {
            const response = new NextResponse(JSON.stringify(body), { status: init.status ?? 200, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
            response.cookies = { set: (name, value, options) => { (response.cookieWrites ??= []).push({ name, value, options }); } };
            return response;
          }
          static redirect(url, status = 307) {
            const response = new NextResponse(null, { status, headers: { location: String(url) } });
            response.cookies = { set: (name, value, options) => { (response.cookieWrites ??= []).push({ name, value, options }); } };
            return response;
          }
        }
        export class NextRequest extends Request {}
      `,
      "next/headers": `export async function cookies() { return { get(name) { return name === "mfa_login_pending" && globalThis.__pendingMfaCookie ? { value: globalThis.__pendingMfaCookie } : undefined; } }; }`,
      "@/lib/auth": `
        export async function createSession(...args) { globalThis.__providerMfa.sessions.push(args); }
        export async function logSuperAdminVerificationExemption(...args) { globalThis.__providerMfa.exemptionCalls.push(args); }
        export async function getCurrentSessionDetails() { return null; }
      `,
      "@/lib/mfa-security": `
        export async function createPendingMfaChallengeForVerifiedPrimary() { if (globalThis.__providerMfa.mfaError) throw globalThis.__providerMfa.mfaError; if (globalThis.__providerMfa.blocked) throw new Error("Account access is unavailable."); return globalThis.__providerMfa.decision; }
        export async function verifyPendingMfaChallenge() { return globalThis.__providerMfa.mfaCompletion; }
        export function isVerifiedMfaChallengeCompletion(value) { return value?.verified === true; }
      `,
      "@/lib/prisma": "export const prisma = globalThis.__providerMfa.prisma;",
      "@/lib/rate-limit": `
        export async function checkAuthRateLimit() { globalThis.__providerMfa.rateLimitCalls += 1; return globalThis.__providerMfa.rateLimit; }
        export async function checkPasskeyRateLimit() { return globalThis.__providerMfa.rateLimit; }
      `,
      "@/lib/auth-verification-policy": `export function canSkipAdditionalIdentityVerification(role) { return role === "SUPER_ADMIN"; }`,
      "@/lib/auth-diagnostics": `export function reportAuthOperationFailure(...args) { globalThis.__providerMfa.diagnostics.push(args); }`,
      "@/lib/email-action-tokens": `export async function consumeVerifiedMagicLink() { const value = globalThis.__providerMfa.magicLink; globalThis.__providerMfa.magicLink = null; return value; }`,
      "@/lib/google-oauth": `
        export const GOOGLE_OAUTH_APP_ORIGIN = "https://crispus-nguni-website.vercel.app";
        export function googleBindingCookieName(state) { return "google_oauth_binding_" + state; }
        export async function consumeGoogleOAuthTransaction() { const value = globalThis.__providerMfa.googleTransaction; globalThis.__providerMfa.googleTransaction = null; return value; }
        export function getGoogleOAuthConfiguration() { return {}; }
        export async function exchangeGoogleAuthorizationCode() { return "verified-id-token"; }
        export async function verifyGoogleIdToken() { return { sub: "google-subject", email: "user@example.test", emailVerified: true, name: "Test User" }; }
        export async function createGoogleOAuthTransaction() { throw new Error("not used"); }
      `,
      "@/lib/auth-identities": `export async function createVerifiedIdentity() { return { status: "created" }; } export async function linkVerifiedIdentity() { return { status: "linked" }; }`,
      "@/lib/webauthn": `
        export async function consumeWebAuthnChallenge() { return globalThis.__providerMfa.webauthnChallengeValid; }
        export function getWebAuthnConfig() { return { origin: "https://example.test", rpID: "example.test" }; }
      `,
      "@simplewebauthn/server": `export async function verifyAuthenticationResponse() { return { verified: true, authenticationInfo: { userVerified: true, credentialID: "credential-1", newCounter: 2, credentialDeviceType: "singleDevice", credentialBackedUp: false } }; }`,
      "argon2": `export default { async verify() { return globalThis.__providerMfa.passwordValid !== false; } };`,
      "@/lib/phone-auth": `export async function createPhoneSignupAccount() { return "new-phone-user"; } export async function phoneIdentityExists() { return false; }`,
      "@/lib/twilio-verify": `export async function checkPhoneVerification() { return true; } export async function sendPhoneVerification() { return true; } export function validateTwilioVerifyConfiguration() {}`,
      "@/lib/phone-otp": `
        export async function getPhoneOtpChallenge() { return globalThis.__providerMfa.phoneChallenge; }
        export async function consumePhoneOtpChallenge() { const value = globalThis.__providerMfa.phoneChallenge; globalThis.__providerMfa.phoneChallenge = null; return value; }
        export async function createPhoneOtpChallenge() { return "phone-challenge-id"; }
        export async function deletePhoneOtpChallenge() {}
      `,
    };
    if (Object.hasOwn(mocks, specifier)) return { url: data(mocks[specifier]), shortCircuit: true };
    if (specifier === "@/lib/auth-completion") return { url: new URL("../src/lib/auth-completion.ts", import.meta.url).href, shortCircuit: true };
    if (specifier === "@/lib/phone-otp-core") return next(new URL("../src/lib/phone-otp-core.ts", import.meta.url).href, context);
    return next(specifier, context);
  },
});

state.prisma = prisma;
const [{ POST: emailLogin }, { POST: magicVerify }, { POST: passkeyVerify }, { verifyPhoneOtp }, googleCallback, { POST: mfaComplete }] = await Promise.all([
  import("../src/app/api/auth/login/route.ts"),
  import("../src/app/api/auth/magic-link/verify/route.ts"),
  import("../src/app/api/auth/passkey/login/verify/route.ts"),
  import("../src/lib/phone-auth-routes.ts"),
  import("../src/app/api/auth/google/callback/route.ts"),
  import("../src/app/api/auth/mfa/complete/route.ts"),
]);

function reset() {
  state.sessions.length = 0;
  state.decision = { required: true, enrollmentRequired: true, authorization: { token: "E".repeat(43), expiresAt: Date.now() + 240_000 } };
  state.user = { id: "verified-user", name: "Test", email: "user@example.test", role: "SUPER_ADMIN", passwordHash: "hash", emailVerifiedAt: null, identities: [{ providerSubject: "user@example.test", verifiedAt: null }] };
  state.emailIdentity = null;
  state.phoneIdentity = { userId: "verified-user", verifiedAt: new Date(), user: { role: "SUPER_ADMIN", emailVerifiedAt: null } };
  state.magicLink = { userId: "verified-user", verificationExempt: false };
  state.phoneChallenge = { intent: "signin", phone: "+254712345678", eligible: true, createdAt: Date.now() };
  state.googleTransaction = { intent: "signin", nonce: "nonce", codeVerifier: "verifier" };
  state.passkey = { id: "passkey-row", credentialId: "credential-1", publicKey: new Uint8Array([1]), counter: 1n, transports: [], revokedAt: null, userId: "verified-user", user: { id: "verified-user", role: "SUPER_ADMIN" } };
  state.passkeyCounterUpdateCount = 1;
  state.webauthnChallengeValid = true;
  state.mfaCompletion = null;
  state.rateLimit = { limited: false, unavailable: false };
  state.rateLimitCalls = 0;
  state.exemptionCalls.length = 0;
  state.diagnostics.length = 0;
  state.passwordValid = true;
  state.blocked = false;
  state.mfaError = null;
}

function request(body, url = "https://example.test/auth", headers = {}) {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}

function responseBody(response) { return response.json(); }

test("email/password and magic-link primary verification enter the shared enrollment policy without issuing sessions", async () => {
  reset();
  let response = await emailLogin(request({ email: "user@example.test", password: "correct" }));
  assert.equal(response.status, 200);
  assert.equal((await responseBody(response)).pending, "enrollment");
  assert.equal(state.sessions.length, 0);
  assert.equal(response.cookieWrites[0].name, "mfa_enrollment_pending");
  assert.equal(state.exemptionCalls.length, 1, "Super Admin verification exemption is logged without bypassing MFA");

  reset();
  response = await magicVerify(request({ token: "M".repeat(43) }));
  assert.equal(response.status, 200);
  assert.equal((await responseBody(response)).pending, "enrollment");
  assert.equal(state.sessions.length, 0);
  assert.equal(response.cookieWrites[0].name, "mfa_enrollment_pending");
});

test("Super Admin with an active factor is handed to MFA challenge without a session", async () => {
  reset();
  state.decision = {
    required: true,
    enrollmentRequired: false,
    challenge: { token: "C".repeat(43), expiresAt: Date.now() + 240_000 },
  };
  const response = await emailLogin(request({ email: "user@example.test", password: "correct" }));
  assert.equal(response.status, 200);
  assert.equal((await responseBody(response)).pending, "mfa");
  assert.equal(state.sessions.length, 0);
  assert.equal(response.cookieWrites[0].name, "mfa_login_pending");
  assert.equal(state.exemptionCalls.length, 1, "unverified Super Admin identity does not bypass MFA");
});

test("failed email credentials and replayed magic links cannot create pending state or sessions", async () => {
  reset();
  state.passwordValid = false;
  const denied = await emailLogin(request({ email: "user@example.test", password: "wrong" }));
  assert.equal(denied.status, 401);
  assert.equal(state.sessions.length, 0);
  assert.equal((denied.cookieWrites ?? []).length, 0);

  reset();
  state.magicLink = null;
  const replay = await magicVerify(request({ token: "M".repeat(43) }));
  assert.equal(replay.status, 400);
  assert.equal(state.sessions.length, 0);
});

test("ordinary users still need email verification before primary-auth completion", async () => {
  reset();
  state.user.role = "USER";
  state.user.emailVerifiedAt = null;
  state.user.identities[0].verifiedAt = null;
  const response = await emailLogin(request({ email: "user@example.test", password: "correct" }));
  assert.equal(response.status, 403);
  assert.equal(state.sessions.length, 0);
  assert.equal((response.cookieWrites ?? []).length, 0);
});

test("internal schema or MFA errors fail closed before pending auth or session issuance", async () => {
  reset();
  const originalError = console.error;
  console.error = () => {};
  try {
    state.mfaError = new Error("Unknown field accountStatus for User select.");
    const response = await emailLogin(request({ email: "user@example.test", password: "correct" }));
    assert.equal(response.status, 500);
    assert.equal((await responseBody(response)).message, "Something went wrong while logging in.");
    assert.equal(state.sessions.length, 0);
    assert.equal((response.cookieWrites ?? []).length, 0);
    assert.equal(state.rateLimitCalls, 1, "the IP precheck still runs");
    assert.equal(state.diagnostics.length, 1);
    assert.equal(state.diagnostics[0][0], "LOGIN_MFA_COMPLETION");
    assert.equal(state.diagnostics[0][1], state.mfaError);
  } finally {
    console.error = originalError;
  }
});

test("unverified Super Admin phone identity remains exempt while MFA stays mandatory", async () => {
  reset();
  state.phoneIdentity.verifiedAt = null;
  const response = await verifyPhoneOtp(request({ challengeId: "C".repeat(43), code: "123456" }), "signin");
  assert.equal(response.status, 200);
  assert.equal((await responseBody(response)).pending, "enrollment");
  assert.equal(state.sessions.length, 0);
  assert.equal(state.exemptionCalls.some(([, method]) => method === "PHONE"), true);
});

test("ordinary verified users retain the no-MFA session path through the same boundary", async () => {
  reset();
  state.user.role = "USER";
  state.user.emailVerifiedAt = new Date();
  state.user.identities[0].verifiedAt = new Date();
  state.decision = { required: false };
  const response = await emailLogin(request({ email: "user@example.test", password: "correct" }));
  assert.equal(response.status, 200);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0][2].primaryAuthMethod, "EMAIL");
  assert.equal((response.cookieWrites ?? []).length, 0);
});

test("phone OTP and passkey primary checks route approved results into shared MFA policy", async () => {
  reset();
  let response = await verifyPhoneOtp(request({ challengeId: "C".repeat(43), code: "123456" }), "signin");
  assert.equal(response.status, 200);
  assert.equal((await responseBody(response)).pending, "enrollment");
  assert.equal(state.sessions.length, 0);
  assert.equal(response.cookieWrites[0].name, "mfa_enrollment_pending");

  reset();
  const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge: "challenge-value" })).toString("base64url");
  response = await passkeyVerify(request({ response: { id: "credential-1", rawId: "credential-1", response: { clientDataJSON, authenticatorData: "a", signature: "s", userHandle: Buffer.from("verified-user").toString("base64url") } } }));
  assert.equal(response.status, 200);
  assert.equal((await responseBody(response)).pending, "enrollment");
  assert.equal(state.sessions.length, 0);
});

test("passkey replay and counter races are rejected before entering MFA policy", async () => {
  reset();
  state.webauthnChallengeValid = false;
  const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge: "challenge-value" })).toString("base64url");
  const body = { response: { id: "credential-1", rawId: "credential-1", response: { clientDataJSON, authenticatorData: "a", signature: "s", userHandle: Buffer.from("verified-user").toString("base64url") } } };
  let response = await passkeyVerify(request(body));
  assert.equal(response.status, 400);
  assert.equal(state.sessions.length, 0);
  assert.equal(state.passkeyCounterUpdateCount, 1);

  reset();
  state.passkeyCounterUpdateCount = 0;
  response = await passkeyVerify(request(body));
  assert.equal(response.status, 401);
  assert.equal(state.sessions.length, 0);
});

test("Google OAuth transaction is single-use and pending credentials never enter redirect URLs", async () => {
  reset();
  const req = new Request("https://example.test/api/auth/google/callback?state=" + "S".repeat(43) + "&code=provider-code");
  req.nextUrl = new URL(req.url);
  req.cookies = {
    get: () => ({ value: "binding-secret" }),
    getAll: () => [{ name: "google_oauth_binding_" + "S".repeat(43) }],
  };
  state.googleTransaction = { intent: "signin", nonce: "n", codeVerifier: "v" };
  state.emailIdentity = { userId: "verified-user", verifiedAt: new Date(), user: { id: "verified-user", role: "SUPER_ADMIN" } };
  const response = await googleCallback.GET(req);
  assert.equal(response.status, 303);
  assert.match(response.headers.get("location"), /\/mfa\/enroll$/);
  assert.equal(response.headers.get("location").includes("E".repeat(43)), false);
  assert.equal(response.cookieWrites.some((cookie) => cookie.name === "mfa_enrollment_pending"), true);
  assert.equal(state.sessions.length, 0);

  const replayRequest = new Request(req.url);
  replayRequest.nextUrl = new URL(req.url);
  replayRequest.cookies = req.cookies;
  const replay = await googleCallback.GET(replayRequest);
  assert.match(replay.headers.get("location"), /google=failed$/);
  assert.equal(state.sessions.length, 0);
});

test("successful MFA completion is the only tested pending-login path that creates an MFA-marked session", async () => {
  reset();
  const completion = { verified: true, purpose: "LOGIN", userId: "verified-user", primaryAuthMethod: "EMAIL", secondFactorMethod: "TOTP", verifiedAt: new Date() };
  state.mfaCompletion = { status: "verified", completion };
  globalThis.__pendingMfaCookie = "P".repeat(43);
  const req = request({ code: "123456" }, "https://example.test/api/auth/mfa/complete", { origin: "https://example.test" });
  const cookieResponse = await mfaComplete(req);
  assert.equal(cookieResponse.status, 200);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0][0], "verified-user");
  assert.equal(state.sessions[0][2].verifiedMfa.secondFactorMethod, "TOTP");
  assert.equal(cookieResponse.cookieWrites[0].options.maxAge, 0);
});

test("recovery-code completion creates a session marked with the verified recovery method", async () => {
  reset();
  state.mfaCompletion = { status: "verified", completion: { verified: true, purpose: "LOGIN", userId: "verified-user", primaryAuthMethod: "GOOGLE", secondFactorMethod: "RECOVERY_CODE", verifiedAt: new Date() } };
  globalThis.__pendingMfaCookie = "P".repeat(43);
  const req = request({ code: "ABCD-EFGH-IJKL" }, "https://example.test/api/auth/mfa/complete", { origin: "https://example.test" });
  const response = await mfaComplete(req);
  assert.equal(response.status, 200);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0][2].verifiedMfa.secondFactorMethod, "RECOVERY_CODE");
});

test("failed, expired, replayed, or cross-origin MFA completion never creates a session", async () => {
  reset();
  globalThis.__pendingMfaCookie = "P".repeat(43);
  const req = request({ code: "000000" }, "https://example.test/api/auth/mfa/complete", { origin: "https://example.test" });
  state.mfaCompletion = { status: "invalid", attemptsRemaining: 4 };
  assert.equal((await mfaComplete(req)).status, 401);
  assert.equal(state.sessions.length, 0);

  state.mfaCompletion = { status: "unavailable" };
  assert.equal((await mfaComplete(req)).status, 401);
  assert.equal(state.sessions.length, 0);

  const crossOrigin = request({ code: "123456" }, "https://example.test/api/auth/mfa/complete", { origin: "https://attacker.test" });
  assert.equal((await mfaComplete(crossOrigin)).status, 403);
  assert.equal(state.sessions.length, 0);
});

test("restricted accounts stop before session issuance across all five active login methods", async () => {
  state.blocked = true;

  reset(); state.blocked = true;
  await emailLogin(request({ email: "user@example.test", password: "correct" }));
  assert.equal(state.sessions.length, 0);

  reset(); state.blocked = true;
  await magicVerify(request({ token: "M".repeat(43) }));
  assert.equal(state.sessions.length, 0);

  reset(); state.blocked = true;
  await verifyPhoneOtp(request({ challengeId: "C".repeat(43), code: "123456" }), "signin");
  assert.equal(state.sessions.length, 0);

  reset(); state.blocked = true;
  const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge: "challenge-value" })).toString("base64url");
  await passkeyVerify(request({ response: { id: "credential-1", rawId: "credential-1", response: { clientDataJSON, authenticatorData: "a", signature: "s", userHandle: Buffer.from("verified-user").toString("base64url") } } }));
  assert.equal(state.sessions.length, 0);

  reset(); state.blocked = true;
  const googleRequest = new Request("https://example.test/api/auth/google/callback?state=" + "S".repeat(43) + "&code=provider-code");
  googleRequest.nextUrl = new URL(googleRequest.url);
  googleRequest.cookies = { get: () => ({ value: "binding-secret" }), getAll: () => [{ name: "google_oauth_binding_" + "S".repeat(43) }] };
  state.googleTransaction = { intent: "signin", nonce: "n", codeVerifier: "v" };
  state.emailIdentity = { userId: "verified-user", verifiedAt: new Date(), user: { id: "verified-user", role: "SUPER_ADMIN" } };
  await googleCallback.GET(googleRequest);
  assert.equal(state.sessions.length, 0);
});
