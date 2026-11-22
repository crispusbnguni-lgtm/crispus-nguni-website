"use client";

import { argon2id } from "hash-wasm";

export const VAULT_FORMAT_VERSION = 1 as const;
export const VAULT_KDF = { algorithm: "argon2id", memoryKiB: 65_536, iterations: 3, parallelism: 1 } as const;
const textEncoder = new TextEncoder();
type OwnedBytes = Uint8Array<ArrayBuffer>;

function ownedBytes(value: Uint8Array): OwnedBytes {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

export type VaultEnvelope = { nonce: string; ciphertext: string };
export type VaultRecord = {
  id: string;
  type: "LOGIN" | "SECURE_NOTE";
  name: string;
  url: string;
  username: string;
  email: string;
  password: string;
  category: string;
  folder: string;
  notes: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  passwordChangedAt: string;
};
export type VaultMetadata = {
  id: string;
  formatVersion: number;
  revision: number;
  kdfAlgorithm: string;
  kdfMemoryKiB: number;
  kdfIterations: number;
  kdfParallelism: number;
  masterSalt: string;
  masterNonce: string;
  masterWrappedDataKey: string;
  recoverySalt: string;
  recoveryNonce: string;
  recoveryWrappedDataKey: string;
  recoveryKeyVersion?: number;
};

export function randomBytes(length: number): Uint8Array {
  if (!Number.isSafeInteger(length) || length < 1 || length > 1024) throw new Error("Invalid random byte length.");
  return crypto.getRandomValues(new Uint8Array(length));
}
export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}
export function decodeBase64(value: string, expectedLength?: number): Uint8Array {
  if (typeof value !== "string" || value.length > 2_000_000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("Invalid encoded vault data.");
  const binary = atob(value);
  if (expectedLength !== undefined && binary.length !== expectedLength) throw new Error("Invalid cryptographic value length.");
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function deriveWrappingKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  if (typeof secret !== "string" || secret.length < 1 || secret.length > 1024) throw new Error("Vault secret is invalid.");
  const passwordBytes = textEncoder.encode(secret.normalize("NFC"));
  let rawKey: OwnedBytes | undefined;
  try {
    const derived = await argon2id({
      password: passwordBytes, salt, iterations: VAULT_KDF.iterations,
      memorySize: VAULT_KDF.memoryKiB, parallelism: VAULT_KDF.parallelism,
      hashLength: 32, outputType: "binary",
    });
    if (typeof derived === "string") throw new Error("Argon2id returned an unexpected format.");
    rawKey = ownedBytes(derived);
    return await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  } finally {
    passwordBytes.fill(0);
    rawKey?.fill(0);
  }
}

export async function encryptBytes(key: CryptoKey, plaintext: Uint8Array, aad: string): Promise<VaultEnvelope> {
  const nonce = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ownedBytes(nonce), additionalData: ownedBytes(textEncoder.encode(aad)), tagLength: 128 }, key, ownedBytes(plaintext));
  return { nonce: encodeBase64(nonce), ciphertext: encodeBase64(new Uint8Array(ciphertext)) };
}
export async function decryptBytes(key: CryptoKey, envelope: VaultEnvelope, aad: string): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ownedBytes(decodeBase64(envelope.nonce, 12)), additionalData: ownedBytes(textEncoder.encode(aad)), tagLength: 128 }, key, ownedBytes(decodeBase64(envelope.ciphertext)));
  return new Uint8Array(plaintext);
}
export async function newDataKey(): Promise<CryptoKey> {
  const rawKey = randomBytes(32);
  try { return await crypto.subtle.importKey("raw", ownedBytes(rawKey), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]); }
  finally { rawKey.fill(0); }
}
export async function exportDataKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}
export async function importDataKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", ownedBytes(rawKey), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}
export async function createWrappedDataKey(dataKey: CryptoKey, secret: string, vaultId: string, role: "master" | "recovery") {
  const salt = randomBytes(16);
  const wrappingKey = await deriveWrappingKey(secret, salt);
  const rawDataKey = await exportDataKey(dataKey);
  try {
    const aad = `crispus-security-vault|${VAULT_FORMAT_VERSION}|${vaultId}|${role}-key-wrap`;
    return { salt: encodeBase64(salt), ...(await encryptBytes(wrappingKey, rawDataKey, aad)) };
  } finally { rawDataKey.fill(0); }
}
export async function unwrapDataKey(secret: string, saltBase64: string, envelope: VaultEnvelope, vaultId: string, role: "master" | "recovery"): Promise<CryptoKey> {
  const key = await deriveWrappingKey(secret, decodeBase64(saltBase64, 16));
  const rawDataKey = await decryptBytes(key, envelope, `crispus-security-vault|${VAULT_FORMAT_VERSION}|${vaultId}|${role}-key-wrap`);
  try {
    if (rawDataKey.length !== 32) throw new Error("Vault could not be unlocked.");
    return await importDataKey(rawDataKey);
  } finally { rawDataKey.fill(0); }
}
export function recordAad(vaultId: string, recordId: string) {
  return `crispus-security-vault|${VAULT_FORMAT_VERSION}|${vaultId}|${recordId}`;
}
export async function encryptRecord(key: CryptoKey, vaultId: string, record: VaultRecord): Promise<VaultEnvelope> {
  return encryptBytes(key, textEncoder.encode(JSON.stringify(record)), recordAad(vaultId, record.id));
}
export async function decryptRecord(key: CryptoKey, vaultId: string, recordId: string, envelope: VaultEnvelope): Promise<VaultRecord> {
  const bytes = await decryptBytes(key, envelope, recordAad(vaultId, recordId));
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value) || (value as { id?: unknown }).id !== recordId) throw new Error("Vault record identity did not match.");
    return value as VaultRecord;
  } finally { bytes.fill(0); }
}
export function generateRecoveryKey(): string {
  const bytes = randomBytes(32);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join("");
  bytes.fill(0);
  return hex.match(/.{1,4}/g)!.join("-");
}
export function isValidRecoveryKey(value: string) { return /^(?:[A-F0-9]{4}-){15}[A-F0-9]{4}$/i.test(value); }
export function makeEmptyLogin(): VaultRecord {
  const now = new Date().toISOString();
  return { id: encodeBase64(randomBytes(18)).replace(/[+/=]/g, ""), type: "LOGIN", name: "", url: "", username: "", email: "", password: "", category: "Other", folder: "", notes: "", favorite: false, createdAt: now, updatedAt: now, passwordChangedAt: now };
}
