import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  createWrappedDataKey, decryptRecord, encryptRecord, isValidRecoveryKey,
  makeEmptyLogin, newDataKey, randomBytes, unwrapDataKey,
} from "../src/lib/security-vault-crypto.ts";

test("AES-GCM encrypts records, binds vault and record IDs, and rejects tampering", async () => {
  const key = await newDataKey();
  const record = { ...makeEmptyLogin(), name: "Private Site", url: "https://secret.invalid", username: "private-user", password: "plaintext-not-on-wire", notes: "secret note" };
  const first = await encryptRecord(key, "vault-a", record);
  const second = await encryptRecord(key, "vault-a", record);
  assert.notEqual(first.nonce, second.nonce);
  assert.equal(first.ciphertext.includes("plaintext-not-on-wire"), false);
  assert.deepEqual(await decryptRecord(key, "vault-a", record.id, first), record);
  await assert.rejects(() => decryptRecord(key, "vault-b", record.id, first));
  await assert.rejects(() => decryptRecord(key, "vault-a", "other-record-id", first));
  const bytes = Uint8Array.from(atob(first.ciphertext), (character) => character.charCodeAt(0));
  bytes[bytes.length - 1] ^= 1;
  const tampered = { ...first, ciphertext: btoa(String.fromCharCode(...bytes)) };
  await assert.rejects(() => decryptRecord(key, "vault-a", record.id, tampered));
});

test("Argon2id master and recovery wrappers support unlock, wrong keys, master changes, and recovery rotation", async () => {
  const vaultId = "5b928169-ec5c-423a-8bdf-9b74c9756b62";
  const key = await newDataKey();
  const master = "correct-horse-battery-staple-123";
  const recovery = "0123456789ABCDEF".repeat(4).match(/.{1,4}/g).join("-");
  const masterWrap = await createWrappedDataKey(key, master, vaultId, "master");
  const recoveryWrap = await createWrappedDataKey(key, recovery, vaultId, "recovery");
  assert.ok(isValidRecoveryKey(recovery));
  const unlockedByMaster = await unwrapDataKey(master, masterWrap.salt, masterWrap, vaultId, "master");
  await assert.rejects(() => unwrapDataKey("incorrect master password", masterWrap.salt, masterWrap, vaultId, "master"));
  const changedMasterWrap = await createWrappedDataKey(unlockedByMaster, "different-master-password-456", vaultId, "master");
  const unlockedAfterChange = await unwrapDataKey("different-master-password-456", changedMasterWrap.salt, changedMasterWrap, vaultId, "master");
  const unlockedByRecovery = await unwrapDataKey(recovery, recoveryWrap.salt, recoveryWrap, vaultId, "recovery");
  const proof = { ...makeEmptyLogin(), name: "same DEK" };
  const proofFromMaster = await encryptRecord(unlockedAfterChange, vaultId, proof);
  assert.deepEqual(await decryptRecord(unlockedByRecovery, vaultId, proof.id, proofFromMaster), proof);
  await assert.rejects(() => unwrapDataKey("wrong recovery key", recoveryWrap.salt, recoveryWrap, vaultId, "recovery"));
  const rotatedRecovery = "FEDCBA9876543210".repeat(4).match(/.{1,4}/g).join("-");
  const rotatedWrap = await createWrappedDataKey(unlockedAfterChange, rotatedRecovery, vaultId, "recovery");
  await assert.rejects(() => unwrapDataKey(rotatedRecovery, rotatedWrap.salt, rotatedWrap, "another-vault-id", "recovery"));
  const unlockedByRotatedRecovery = await unwrapDataKey(rotatedRecovery, rotatedWrap.salt, rotatedWrap, vaultId, "recovery");
  assert.ok(unlockedByRotatedRecovery);
});

test("vault API and schema persist ciphertext only and enforce owner scope and revision compare-and-swap", async () => {
  const [schema, migration, route, component] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20261122180000_zero_knowledge_security_vault/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/dashboard/workspace/security/vault/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/workspace/SecurityVault.tsx", import.meta.url), "utf8"),
  ]);
  const vaultModels = schema.slice(schema.indexOf("model SecurityVault {"), schema.indexOf("model AcademicKnowledgeResource {"));
  assert.match(vaultModels, /workspaceId\s+String\s+@unique/);
  assert.match(vaultModels, /ciphertext\s+String/);
  assert.doesNotMatch(vaultModels, /password\s+String|username\s+String|email\s+String|url\s+String|notes\s+String|title\s+String/);
  assert.doesNotMatch(migration, /"password"|"username"|"email"|"url"|"notes"/i);
  assert.match(route, /requireApiUser\(\)/);
  assert.match(route, /requireSameOriginApiRequest\(request\)/);
  assert.match(route, /ownerWorkspace\(auth\.user\.id\)/);
  assert.match(route, /personalWorkspace\.findUnique\(\{ where: \{ userId \}/);
  assert.doesNotMatch(route, /"password"|"username"|"email"|"url"|"notes"/);
  assert.match(route, /workspaceId: workspace\.id, revision: input\.expectedRevision/);
  assert.match(route, /prisma\.\$transaction/);
  assert.match(component, /JSON\.stringify\(\{ vaultId: vault\.id, expectedRevision: vault\.revision, records: encrypted/);
  assert.doesNotMatch(component, /body:\s*JSON\.stringify\(\{[^}]*password:\s*record\.password/);
  assert.doesNotMatch(component, /localStorage|sessionStorage/);
  assert.match(component, /visibilitychange/);
  assert.match(component, /INACTIVITY_MS = 5 \* 60 \* 1000/);
  assert.ok(randomBytes(32).length === 32);
});
