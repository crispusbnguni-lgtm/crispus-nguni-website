import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const data = (s) => `data:text/javascript,${encodeURIComponent(s)}`;
const state = globalThis.__authCompletion = { decision: { required: false }, sessions: [], cookies: {} };
registerHooks({ resolve(s,ctx,next){
  const mocks={"server-only":"", "next/server":"export class NextResponse extends Response { cookies={set(){}} }", "@/lib/auth":"export async function createSession(...args){globalThis.__authCompletion.sessions.push(args)}", "@/lib/mfa-security":"export async function createPendingMfaChallengeForVerifiedPrimary(){return globalThis.__authCompletion.decision}; export function isVerifiedMfaChallengeCompletion(x){return Boolean(x?.verified)}", "@/lib/mfa-challenges":""};
  if(Object.hasOwn(mocks,s)) return {url:data(mocks[s]),shortCircuit:true};
  return next(s,ctx);
}});
const m=await import("../src/lib/auth-completion.ts");
const req=new Request("http://localhost");
test("policy permits a session only when trusted policy says no MFA is required",async()=>{
  state.sessions.length=0;state.decision={required:false};
  assert.deepEqual(await m.completePrimaryAuthentication(req,{userId:"trusted",method:"EMAIL"}),{status:"session"});
  assert.equal(state.sessions.length,1);
  state.decision={required:true,enrollmentRequired:true,authorization:{token:"A".repeat(43),expiresAt:Date.now()+300000}};
  assert.equal((await m.completePrimaryAuthentication(req,{userId:"trusted",method:"EMAIL"})).status,"enrollment");
  state.decision={required:true,enrollmentRequired:false,challenge:{token:"B".repeat(43),expiresAt:Date.now()+300000}};
  assert.equal((await m.completePrimaryAuthentication(req,{userId:"trusted",method:"EMAIL"})).status,"mfa");
  assert.equal(state.sessions.length,1);
});
test("pending states use distinct HttpOnly cookies scoped to their only endpoints",async()=>{
  const cookieResponse={cookies:{set(name,value,options){state.cookies[name]={value,options}}}};
  const authorization={token:"A".repeat(43),expiresAt:Date.now()+200000};
  m.setPendingAuthenticationCookie(cookieResponse,{status:"enrollment",authorization});
  m.setPendingAuthenticationCookie(cookieResponse,{status:"mfa",challenge:authorization});
  assert.equal(state.cookies.mfa_enrollment_pending.options.httpOnly,true);
  assert.equal(state.cookies.mfa_enrollment_pending.options.path,"/api/auth/mfa/enrollment");
  assert.equal(state.cookies.mfa_login_pending.options.httpOnly,true);
  assert.equal(state.cookies.mfa_login_pending.options.path,"/api/auth/mfa/complete");
});
test("final session issuance rejects unbranded or non-login completion",async()=>{
  state.sessions.length=0;
  await assert.rejects(m.finalizeMfaLogin(req,{userId:"u",purpose:"LOGIN"}));
  await assert.rejects(m.finalizeMfaLogin(req,{verified:true,userId:"u",purpose:"STEP_UP"}));
  assert.equal(state.sessions.length,0);
});
