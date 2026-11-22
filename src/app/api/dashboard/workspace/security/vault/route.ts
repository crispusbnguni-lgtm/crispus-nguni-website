import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, requireSameOriginApiRequest } from "@/lib/authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const responseHeaders = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: responseHeaders });
const b64 = (value: unknown, exact?: number, maximum = 100_000): value is string => typeof value === "string" && value.length <= maximum && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value) && (exact === undefined || value.length === exact);

async function readJson(request: Request, maxBytes = 5_000_000): Promise<Record<string, unknown> | null> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) return null;
  try {
    if (!request.body) return null;
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel(); return null; }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.getPrototypeOf(parsed) === Object.prototype ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}
async function ownerWorkspace(userId: string) {
  return prisma.personalWorkspace.findUnique({ where: { userId }, select: { id: true } });
}
function validWrappedPair(input: Record<string, unknown>, prefix: "master" | "recovery") {
  return b64(input[`${prefix}Salt`], 24) && b64(input[`${prefix}Nonce`], 16) && b64(input[`${prefix}WrappedDataKey`], undefined, 256) && (input[`${prefix}WrappedDataKey`] as string).length >= 60;
}
function validKdf(input: Record<string, unknown>) {
  return input.formatVersion === 1 && input.kdfAlgorithm === "argon2id" && input.kdfMemoryKiB === 65_536 && input.kdfIterations === 3 && input.kdfParallelism === 1;
}

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const workspace = await ownerWorkspace(auth.user.id);
  if (!workspace) return json({ success: true, vault: null, records: [] });
  try {
    const vault = await prisma.securityVault.findUnique({ where: { workspaceId: workspace.id }, select: { id: true, formatVersion: true, revision: true, kdfAlgorithm: true, kdfMemoryKiB: true, kdfIterations: true, kdfParallelism: true, masterSalt: true, masterNonce: true, masterWrappedDataKey: true, recoverySalt: true, recoveryNonce: true, recoveryWrappedDataKey: true, recoveryKeyVersion: true, createdAt: true, updatedAt: true } });
    if (!vault) return json({ success: true, vault: null, records: [] });
    const records = await prisma.securityVaultRecord.findMany({ where: { vaultId: vault.id }, orderBy: { id: "asc" }, select: { id: true, nonce: true, ciphertext: true } });
    return json({ success: true, vault, records });
  } catch { return json({ success: false, message: "Vault is temporarily unavailable." }, 503); }
}

export async function POST(request: Request) {
  const originError = requireSameOriginApiRequest(request);
  if (originError) return originError;
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const input = await readJson(request, 4096);
  if (!input || Object.keys(input).some((key) => !["vaultId", "formatVersion", "kdfAlgorithm", "kdfMemoryKiB", "kdfIterations", "kdfParallelism", "masterSalt", "masterNonce", "masterWrappedDataKey", "recoverySalt", "recoveryNonce", "recoveryWrappedDataKey"].includes(key)) || typeof input.vaultId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.vaultId) || !validKdf(input) || !validWrappedPair(input, "master") || !validWrappedPair(input, "recovery")) return json({ success: false, message: "Vault cryptographic metadata is invalid." }, 400);
  const workspace = await ownerWorkspace(auth.user.id);
  if (!workspace) return json({ success: false, message: "Personal workspace is unavailable." }, 404);
  try {
    const id = input.vaultId as string;
    const vault = await prisma.securityVault.create({ data: { id, workspaceId: workspace.id, formatVersion: 1, revision: 1, kdfAlgorithm: "argon2id", kdfMemoryKiB: 65_536, kdfIterations: 3, kdfParallelism: 1, masterSalt: input.masterSalt as string, masterNonce: input.masterNonce as string, masterWrappedDataKey: input.masterWrappedDataKey as string, recoverySalt: input.recoverySalt as string, recoveryNonce: input.recoveryNonce as string, recoveryWrappedDataKey: input.recoveryWrappedDataKey as string }, select: { id: true, revision: true } });
    return json({ success: true, vault }, 201);
  } catch { return json({ success: false, message: "Vault already exists or could not be created." }, 409); }
}

export async function PUT(request: Request) {
  const originError = requireSameOriginApiRequest(request);
  if (originError) return originError;
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const input = await readJson(request);
  const allowed = ["vaultId", "expectedRevision", "records", "masterSalt", "masterNonce", "masterWrappedDataKey", "recoverySalt", "recoveryNonce", "recoveryWrappedDataKey", "recoveryKeyVersion"];
  if (!input || Object.keys(input).some((key) => !allowed.includes(key)) || typeof input.vaultId !== "string" || !input.vaultId || !Number.isSafeInteger(input.expectedRevision) || (input.expectedRevision as number) < 0 || (input.records !== undefined && (!Array.isArray(input.records) || input.records.length > 1000))) return json({ success: false, message: "Vault update is invalid." }, 400);
  const records = input.records as unknown[] | undefined;
  if (records?.some((record) => !record || typeof record !== "object" || Array.isArray(record) || Object.keys(record).some((key) => !["id", "nonce", "ciphertext"].includes(key)) || typeof (record as Record<string, unknown>).id !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test((record as Record<string, string>).id) || !b64((record as Record<string, unknown>).nonce, 16) || !b64((record as Record<string, unknown>).ciphertext, undefined, 1_400_000) || ((record as Record<string, string>).ciphertext.length < 24))) return json({ success: false, message: "Encrypted vault record is invalid." }, 400);
  const ids = (records ?? []).map((record) => (record as Record<string, string>).id);
  if (new Set(ids).size !== ids.length) return json({ success: false, message: "Vault record identifiers must be unique." }, 400);
  const masterFields = [input.masterSalt, input.masterNonce, input.masterWrappedDataKey];
  const recoveryFields = [input.recoverySalt, input.recoveryNonce, input.recoveryWrappedDataKey];
  if (masterFields.some((value) => value !== undefined) && !validWrappedPair(input, "master")) return json({ success: false, message: "Master-password wrapper is invalid." }, 400);
  if (recoveryFields.some((value) => value !== undefined) && (!validWrappedPair(input, "recovery") || !Number.isSafeInteger(input.recoveryKeyVersion) || (input.recoveryKeyVersion as number) < 1)) return json({ success: false, message: "Recovery wrapper is invalid." }, 400);
  if (!records && !masterFields.some((value) => value !== undefined) && !recoveryFields.some((value) => value !== undefined)) return json({ success: false, message: "Vault update contains no changes." }, 400);
  const workspace = await ownerWorkspace(auth.user.id);
  if (!workspace) return json({ success: false, message: "Personal workspace is unavailable." }, 404);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const update = await tx.securityVault.updateMany({ where: { id: input.vaultId as string, workspaceId: workspace.id, revision: input.expectedRevision as number }, data: { revision: { increment: 1 }, ...(masterFields.some((value) => value !== undefined) ? { masterSalt: input.masterSalt as string, masterNonce: input.masterNonce as string, masterWrappedDataKey: input.masterWrappedDataKey as string } : {}), ...(recoveryFields.some((value) => value !== undefined) ? { recoverySalt: input.recoverySalt as string, recoveryNonce: input.recoveryNonce as string, recoveryWrappedDataKey: input.recoveryWrappedDataKey as string, recoveryKeyVersion: input.recoveryKeyVersion as number } : {}) } });
      if (update.count !== 1) return false;
      if (records) {
        await tx.securityVaultRecord.deleteMany({ where: { vaultId: input.vaultId as string } });
        if (records.length) await tx.securityVaultRecord.createMany({ data: records.map((record) => ({ vaultId: input.vaultId as string, id: (record as Record<string, string>).id, nonce: (record as Record<string, string>).nonce, ciphertext: (record as Record<string, string>).ciphertext })) });
      }
      return true;
    });
    if (!result) return json({ success: false, code: "STALE_REVISION", message: "Vault changed in another session. Reload before saving." }, 409);
    return json({ success: true, revision: (input.expectedRevision as number) + 1 });
  } catch { return json({ success: false, message: "Encrypted vault update could not be saved." }, 503); }
}
