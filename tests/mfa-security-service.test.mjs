import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { generate } from "otplib";

const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const state = globalThis.__mfaService = { user: { id: "u1", role: "USER", accountStatus: "ACTIVE", accountSuspendedUntil: null, verificationStatus: "VERIFIED" }, session: { id: "s1", userId: "u1", lastReauthenticatedAt: new Date() }, credential: null, recoveries: [], audits: [], challenges: new Map(), failAudit: false, failTransaction: false, attempts: 0 };
const prisma = {
  user: { async findUnique() { return state.user; } },
  totpCredential: {
    async findUnique() { return state.credential && structuredClone(state.credential); },
    async create({data}) { state.credential = { id: randomUUID(), userId:"u1", verifiedAt:null, lastAcceptedStep:null, updatedAt:new Date(), ...data }; return state.credential; },
async update({data}) {
  Object.assign(state.credential,data,{updatedAt:new Date()});
  return state.credential;
},
    async updateMany({where,data}) { const c=state.credential; if(!c || (where.updatedAt && +where.updatedAt !== +c.updatedAt) || (where.enrollmentExpiresAt?.gt && !(c.enrollmentExpiresAt > where.enrollmentExpiresAt.gt)) || (where.OR && c.lastAcceptedStep !== null && c.lastAcceptedStep >= where.OR[1].lastAcceptedStep.lt)) return {count:0}; Object.assign(c,data,{updatedAt:new Date()}); return {count:1}; },
    async deleteMany() { const existed=!!state.credential; state.credential=null; return {count:+existed}; },
  },
  recoveryCode: {
    async findFirst() { const r=state.recoveries.find(x=>!x.revokedAt); return r ? {generationId:r.generationId,createdAt:r.createdAt}:null; },
    async findMany() { return state.recoveries.filter(x=>!x.usedAt&&!x.revokedAt).map(({id,codeHash})=>({id,codeHash})); },
    async updateMany({where,data}) { let n=0; for(const r of state.recoveries){ if((!where.id||r.id===where.id)&&(!where.userId||r.userId===where.userId)&&(!where.usedAt||r.usedAt===null)&&(!where.revokedAt||r.revokedAt===null)){Object.assign(r,data);n++;}} return {count:n}; },
    async createMany({data}) { for(const row of data) state.recoveries.push({id:randomUUID(),createdAt:new Date(),usedAt:null,revokedAt:null,...row}); return {count:data.length}; },
  },
  userSession: { async updateMany({where,data}) { if(where.id && (state.session.id!==where.id || state.session.revokedAt)) return {count:0}; Object.assign(state.session,data); return {count:1}; } },
  async $transaction(fn) { const backup=structuredClone({credential:state.credential,recoveries:state.recoveries,session:state.session,audits:state.audits}); try { const result=await fn(prisma); if(state.failTransaction) throw Error("transaction failure"); return result; } catch(e){ Object.assign(state,backup); throw e; } },
};
globalThis.__mfaChallengeMocks = {
  async create(input) { const token=randomBytes(32).toString("base64url"); const c={...input,primaryAuthenticationEventId:randomUUID(),expiresAt:Date.now()+300000}; state.challenges.set(token,c); return {token,expiresAt:c.expiresAt}; },
  async get(token) { return state.challenges.get(token) ?? null; },
  async consume(token) { const c=state.challenges.get(token); state.challenges.delete(token); return c ?? null; },
  async failed() { state.attempts++; return 5-state.attempts; },
};
registerHooks({ resolve(s,ctx,next){
  const stubs={"server-only":"", "next/server":"export class NextResponse extends Response { cookies={set(){}} }", "@/lib/prisma":"export const prisma=globalThis.__mfaService.prisma;", "@/lib/auth":"export async function getCurrentUser(){return globalThis.__mfaService.user}; export async function getCurrentSessionDetails(){return globalThis.__mfaService.session};", "@/lib/rate-limit":"export async function checkMfaRateLimit(){return {limited:false,unavailable:false}};", "@/lib/mfa-challenges":"export const createPendingMfaChallenge=(x)=>globalThis.__mfaChallengeMocks.create(x); export const getPendingMfaChallenge=(x)=>globalThis.__mfaChallengeMocks.get(x); export const consumePendingMfaChallenge=(x)=>globalThis.__mfaChallengeMocks.consume(x); export const recordFailedMfaAttempt=(x)=>globalThis.__mfaChallengeMocks.failed(x);", "@/lib/admin-audit":"export async function resolveSecurityAuditActor(){return {userId:'u1',role:'USER'}}; export async function resolveMfaChallengeSecurityActor(){return {userId:'u1',role:'USER'}}; export async function writeSecurityAudit(_a,event){if(globalThis.__mfaService.failAudit) throw Error('audit failure'); globalThis.__mfaService.audits.push(event)};", "qrcode":"export default {toDataURL:async()=> 'data:image/png;base64,QR'};"};
  if(Object.hasOwn(stubs,s)) return {url:data(stubs[s] ?? ""),shortCircuit:true};
  if(s === "@/lib/account-access") return {url:new URL("../src/lib/account-access.ts", import.meta.url).href,shortCircuit:true};
  if(s === "@/lib/mfa-security-core") return {url:new URL("../src/lib/mfa-security-core.ts", import.meta.url).href,shortCircuit:true};
  return next(s,ctx);
}});
state.prisma=prisma;
const m=await import("../src/lib/mfa-security.ts");
const key=randomBytes(32).toString("base64url");
process.env.MFA_TOTP_ENCRYPTION_KEY=key;
const req=new Request("http://localhost",{headers:{"x-forwarded-for":"127.0.0.1"}});
function reset(){state.user={id:"u1",role:"USER",accountStatus:"ACTIVE",accountSuspendedUntil:null,verificationStatus:"VERIFIED"};state.session={id:"s1",userId:"u1",lastReauthenticatedAt:new Date()};state.credential=null;state.recoveries=[];state.audits=[];state.challenges.clear();state.failAudit=false;state.failTransaction=false;state.attempts=0;}
async function code(secret){return generate({secret,epoch:Math.floor(Date.now()/1000),digits:6,period:30});}
async function freshCode(secret){
  const accepted=state.credential?.lastAcceptedStep === null || state.credential?.lastAcceptedStep === undefined ? -1 : Number(state.credential.lastAcceptedStep);
  while(Math.floor(Date.now()/30000) <= accepted) await new Promise(resolve=>setTimeout(resolve, Math.max(25, 30000-(Date.now()%30000)+25)));
  return code(secret);
}
async function enroll(request=req, proof){const result=await m.beginTotpEnrollment(request,proof);const envelope=state.credential.pendingSecretCiphertext ?? state.credential.secretCiphertext;const secret=(await import("../src/lib/mfa-security-core.ts")).decryptTotpSecret(envelope,{currentVersion:"v1",keys:{v1:key}});return {result,secret};}
async function pending(){return m.createPendingMfaChallengeForVerifiedPrimary({userId:"u1",primaryAuthMethod:"EMAIL"});}

test("enrollment persists a pending encrypted factor, rejects invalid code, then activates",async()=>{reset();const {secret,result}=await enroll();assert.equal(result.qrCodeDataUrl,"data:image/png;base64,QR");assert.equal(state.credential.verifiedAt,null);assert.notEqual(state.credential.secretCiphertext,secret);assert.equal((await m.confirmTotpEnrollment(req,"000000")).enabled,false);assert.equal(state.credential.verifiedAt,null);assert.equal((await m.confirmTotpEnrollment(req,await code(secret))).enabled,true);assert.ok(state.credential.verifiedAt);});
test("expired enrollment cannot activate",async()=>{reset();await enroll();state.credential.enrollmentExpiresAt=new Date(0);assert.deepEqual(await m.confirmTotpEnrollment(req,"123456"),{enabled:false,reason:"EXPIRED"});assert.equal(state.credential.verifiedAt,null);});
test("replacement keeps active factor until pending factor verifies",async()=>{reset();let {secret:old}=await enroll();await m.confirmTotpEnrollment(req,await code(old));const {secret:newSecret}=await enroll(req,await freshCode(old));assert.equal((await import("../src/lib/mfa-security-core.ts")).decryptTotpSecret(state.credential.secretCiphertext,{currentVersion:"v1",keys:{v1:key}}),old);assert.equal((await m.confirmTotpEnrollment(req,await freshCode(newSecret))).replaced,true);assert.equal((await import("../src/lib/mfa-security-core.ts")).decryptTotpSecret(state.credential.secretCiphertext,{currentVersion:"v1",keys:{v1:key}}),newSecret);});
test("recovery codes are returned once as plaintext while only hashes persist; rotation revokes prior set",async()=>{reset();const {secret}=await enroll();await m.confirmTotpEnrollment(req,await code(secret));const first=await m.rotateRecoveryCodes(req,await freshCode(secret));assert.equal(first.codes.length,10);assert.ok(state.recoveries.every(x=>!x.codeHash.includes(first.codes[0])));const second=await m.rotateRecoveryCodes(req,await freshCode(secret));assert.ok(state.recoveries.filter(x=>x.generationId===first.generationId).every(x=>x.revokedAt));assert.ok(state.recoveries.filter(x=>x.generationId===second.generationId).every(x=>!x.revokedAt));});
test("challenge permits retry after invalid factor and completes once with valid TOTP",async()=>{reset();const {secret}=await enroll();await m.confirmTotpEnrollment(req,await code(secret));const c=await pending();assert.equal(c.required,true);const bad=await m.verifyPendingMfaChallenge(req,c.challenge.token,"000000");assert.equal(bad.status,"invalid");assert.ok(state.challenges.has(c.challenge.token));const good=await m.verifyPendingMfaChallenge(req,c.challenge.token,await freshCode(secret));assert.equal(good.status,"verified");assert.equal(m.isVerifiedMfaChallengeCompletion(good.completion),true);assert.equal(state.challenges.has(c.challenge.token),false);});
test("challenge accepts recovery code once and rejects reuse",async()=>{reset();const {secret}=await enroll();await m.confirmTotpEnrollment(req,await code(secret));const recovery=await m.rotateRecoveryCodes(req,await freshCode(secret));const c=await pending();assert.equal((await m.verifyPendingMfaChallenge(req,c.challenge.token,recovery.codes[0])).status,"verified");const c2=await pending();assert.equal((await m.verifyPendingMfaChallenge(req,c2.challenge.token,recovery.codes[0])).status,"invalid");});
test("audit failure rolls back enrollment and does not report activation",async()=>{reset();state.failAudit=true;await assert.rejects(m.beginTotpEnrollment(req));assert.equal(state.credential,null);});
test("restricted accounts cannot receive MFA challenges through any primary-auth method",async()=>{reset();state.user.accountStatus="BANNED";for(const primaryAuthMethod of ["EMAIL","GOOGLE","PHONE","EMAIL","PASSKEY"]){await assert.rejects(m.createPendingMfaChallengeForVerifiedPrimary({userId:"u1",primaryAuthMethod}));}assert.equal(state.challenges.size,0);});
