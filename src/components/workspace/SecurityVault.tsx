"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, EyeOff, FileLock2, KeyRound, LockKeyhole, Plus, Search, ShieldAlert, Trash2 } from "lucide-react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { analyzePasswordCandidate, findPwnedPasswordCount, generateSecurePassword } from "@/lib/personal-workspace-security-core";
import {
  createWrappedDataKey, decryptRecord, encryptRecord,
  generateRecoveryKey, importDataKey, isValidRecoveryKey, makeEmptyLogin, randomBytes,
  unwrapDataKey, VAULT_FORMAT_VERSION, VAULT_KDF, type VaultMetadata, type VaultRecord,
} from "@/lib/security-vault-crypto";

type StoredRecord = { id: string; nonce: string; ciphertext: string };
type Snapshot = { success: boolean; vault: VaultMetadata | null; records: StoredRecord[]; message?: string };
type VaultForm = { type: "LOGIN" | "SECURE_NOTE"; name: string; url: string; username: string; email: string; password: string; category: string; folder: string; notes: string; favorite: boolean };
const EMPTY_FORM: VaultForm = { type: "LOGIN", name: "", url: "", username: "", email: "", password: "", category: "Other", folder: "", notes: "", favorite: false };
const INACTIVITY_MS = 5 * 60 * 1000;
function safeWebsiteUrl(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}

function metadataForApi(vault: VaultMetadata) {
  return { vaultId: vault.id, formatVersion: vault.formatVersion, kdfAlgorithm: vault.kdfAlgorithm, kdfMemoryKiB: vault.kdfMemoryKiB, kdfIterations: vault.kdfIterations, kdfParallelism: vault.kdfParallelism, masterSalt: vault.masterSalt, masterNonce: vault.masterNonce, masterWrappedDataKey: vault.masterWrappedDataKey, recoverySalt: vault.recoverySalt, recoveryNonce: vault.recoveryNonce, recoveryWrappedDataKey: vault.recoveryWrappedDataKey };
}

export function SecurityVault() {
  const keyRef = useRef<CryptoKey | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const [vault, setVault] = useState<VaultMetadata | null>(null);
  const [stored, setStored] = useState<StoredRecord[]>([]);
  const [records, setRecords] = useState<VaultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"setup" | "setup-confirm" | "unlock" | "recovery" | "open">("unlock");
  const [master, setMaster] = useState("");
  const [confirmMaster, setConfirmMaster] = useState("");
  const [recovery, setRecovery] = useState("");
  const [shownRecovery, setShownRecovery] = useState("");
  const [recoveryConfirmed, setRecoveryConfirmed] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [editor, setEditor] = useState<VaultForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [exposure, setExposure] = useState<Record<string, string>>({});
  const [changeMaster, setChangeMaster] = useState("");
  const [confirmChangeMaster, setConfirmChangeMaster] = useState("");
  const [rotateRecoveryConfirm, setRotateRecoveryConfirm] = useState("");
  const [pendingRecovery, setPendingRecovery] = useState("");
  const [plaintextWarning, setPlaintextWarning] = useState(false);
  const [asOf, setAsOf] = useState(0);

  const lock = useCallback(() => {
    keyRef.current = null;
    setRecords([]);
    setShowSecrets({});
    setEditor(null);
    setMaster("");
    setConfirmMaster("");
    setRecovery("");
    setRecoveryConfirmed("");
    setChangeMaster("");
    setConfirmChangeMaster("");
    setRotateRecoveryConfirm("");
    setPendingRecovery("");
    setShownRecovery("");
    setMode("unlock");
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/workspace/security/vault", { credentials: "same-origin", cache: "no-store" });
      const result = await response.json() as Snapshot;
      if (!response.ok || !result.success) throw new Error(result.message || "Vault could not be loaded.");
      setVault(result.vault);
      setStored(result.records ?? []);
      setMode(result.vault ? "unlock" : "setup");
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Vault could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => { clearTimeout(timer); if (idleTimer.current) clearTimeout(idleTimer.current); keyRef.current = null; }; }, [load]);
  useEffect(() => { const timer = setTimeout(() => setAsOf(Date.now()), 0); return () => clearTimeout(timer); }, []);

  const saveEncrypted = useCallback(async (nextRecords: VaultRecord[], changes: Record<string, unknown> = {}) => {
    if (!vault || !keyRef.current) throw new Error("Vault is locked.");
    if (nextRecords.length > 1000) throw new Error("A vault can contain at most 1,000 records.");
    const encrypted = await Promise.all(nextRecords.map(async (record) => ({ id: record.id, ...(await encryptRecord(keyRef.current!, vault.id, record)) })));
    const response = await fetch("/api/dashboard/workspace/security/vault", {
      method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultId: vault.id, expectedRevision: vault.revision, records: encrypted, ...changes }),
    });
    const result = await response.json() as { success?: boolean; revision?: number; message?: string };
    if (!response.ok || !result.success || !Number.isSafeInteger(result.revision)) throw new Error(result.message || "Encrypted vault could not be saved.");
    setVault((current) => current ? { ...current, ...changes, revision: result.revision! } as VaultMetadata : current);
    setStored(encrypted);
    setRecords(nextRecords);
  }, [vault]);

  const updateKeyWrapper = useCallback(async (changes: Record<string, unknown>) => {
    if (!vault) throw new Error("Vault metadata is unavailable.");
    const response = await fetch("/api/dashboard/workspace/security/vault", {
      method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultId: vault.id, expectedRevision: vault.revision, ...changes }),
    });
    const result = await response.json() as { success?: boolean; revision?: number; message?: string };
    if (!response.ok || !result.success || !Number.isSafeInteger(result.revision)) throw new Error(result.message || "Key wrapper could not be updated.");
    setVault((current) => current ? { ...current, ...changes, revision: result.revision! } as VaultMetadata : current);
  }, [vault]);

  const unlockWith = useCallback(async (unwrappedKey: CryptoKey) => {
    if (!vault) throw new Error("Vault metadata is missing.");
    const decrypted = await Promise.all(stored.map((record) => decryptRecord(unwrappedKey, vault.id, record.id, record)));
    keyRef.current = unwrappedKey;
    setRecords(decrypted);
    setMode("open");
    setError("");
  }, [stored, vault]);

  async function setupVault(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (master.length < 12) { setError("Use at least 12 characters for the master password."); return; }
    if (master !== confirmMaster) { setError("The master passwords do not match."); return; }
    setBusy(true);
    try {
      const vaultId = crypto.randomUUID();
      const rawDataKey = randomBytes(32);
      const dataKey = await importDataKey(rawDataKey);
      rawDataKey.fill(0);
      const masterWrap = await createWrappedDataKey(dataKey, master, vaultId, "master");
      const recoveryKey = generateRecoveryKey();
      const recoveryWrap = await createWrappedDataKey(dataKey, recoveryKey, vaultId, "recovery");
      setShownRecovery(recoveryKey);
      setRecoveryConfirmed("");
      setRecovery(recoveryKey);
      setVault({ id: vaultId, revision: 0, formatVersion: VAULT_FORMAT_VERSION, kdfAlgorithm: VAULT_KDF.algorithm, kdfMemoryKiB: VAULT_KDF.memoryKiB, kdfIterations: VAULT_KDF.iterations, kdfParallelism: VAULT_KDF.parallelism, masterSalt: masterWrap.salt, masterNonce: masterWrap.nonce, masterWrappedDataKey: masterWrap.ciphertext, recoverySalt: recoveryWrap.salt, recoveryNonce: recoveryWrap.nonce, recoveryWrappedDataKey: recoveryWrap.ciphertext });
      keyRef.current = dataKey;
      setMode("setup-confirm");
    } catch { setError("Secure setup failed. Try a supported modern browser and try again."); }
    finally { setBusy(false); }
  }

  async function confirmSetup() {
    if (!vault || recoveryConfirmed.trim().toUpperCase() !== shownRecovery) { setError("The recovery key confirmation does not match."); return; }
    setBusy(true); setError("");
    try {
      const created = await fetch("/api/dashboard/workspace/security/vault", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metadataForApi(vault)) });
      const createResult = await created.json() as { success?: boolean; message?: string };
      if (!created.ok || !createResult.success) throw new Error(createResult.message || "Vault could not be created.");
      setVault({ ...vault, revision: 1 });
      setMode("open"); setShownRecovery(""); setRecoveryConfirmed(""); setMaster(""); setConfirmMaster("");
      setRecovery("");
      setNotice("Vault created. Store your recovery key somewhere safe and private.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Vault could not be created."); }
    finally { setBusy(false); }
  }

  async function unlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!vault) return; setBusy(true); setError("");
    try { await unlockWith(await unwrapDataKey(master, vault.masterSalt, { nonce: vault.masterNonce, ciphertext: vault.masterWrappedDataKey }, vault.id, "master")); setMaster(""); }
    catch { setError("Could not unlock. Check the master password or use recovery."); }
    finally { setBusy(false); }
  }

  async function recover(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!vault) return; setBusy(true); setError("");
    try {
      if (!isValidRecoveryKey(recovery.trim())) throw new Error("Recovery key format is invalid.");
      const dataKey = await unwrapDataKey(recovery.trim(), vault.recoverySalt, { nonce: vault.recoveryNonce, ciphertext: vault.recoveryWrappedDataKey }, vault.id, "recovery");
      await unlockWith(dataKey);
      setRecovery(""); setNotice("Vault recovered. Set a new master password now.");
    } catch { setError("Recovery failed. Check the key, including every character."); }
    finally { setBusy(false); }
  }

  async function changeMasterPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!vault || !keyRef.current) return;
    if (changeMaster.length < 12 || changeMaster !== confirmChangeMaster) { setError("Enter matching master passwords of at least 12 characters."); return; }
    setBusy(true); setError("");
    try {
      const wrapped = await createWrappedDataKey(keyRef.current, changeMaster, vault.id, "master");
      await updateKeyWrapper({ masterSalt: wrapped.salt, masterNonce: wrapped.nonce, masterWrappedDataKey: wrapped.ciphertext });
      setChangeMaster(""); setConfirmChangeMaster(""); setNotice("Master password changed. Encrypted records were not rewritten.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Master password could not be changed."); }
    finally { setBusy(false); }
  }

  function beginRecoveryRotation() { const next = generateRecoveryKey(); setPendingRecovery(next); setRotateRecoveryConfirm(""); }
  async function commitRecoveryRotation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!vault || !keyRef.current || !pendingRecovery) return;
    if (rotateRecoveryConfirm.trim().toUpperCase() !== pendingRecovery) { setError("The new recovery-key confirmation does not match."); return; }
    setBusy(true); setError("");
    try {
      const wrapped = await createWrappedDataKey(keyRef.current, pendingRecovery, vault.id, "recovery");
      const nextRecoveryVersion = (vault.recoveryKeyVersion ?? 1) + 1;
      await updateKeyWrapper({ recoverySalt: wrapped.salt, recoveryNonce: wrapped.nonce, recoveryWrappedDataKey: wrapped.ciphertext, recoveryKeyVersion: nextRecoveryVersion });
      setShownRecovery(pendingRecovery); setPendingRecovery(""); setRotateRecoveryConfirm("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Recovery key could not be rotated."); }
    finally { setBusy(false); }
  }

  async function persist(next: VaultRecord[]) {
    setBusy(true); setError(""); setNotice("");
    try { await saveEncrypted(next); setEditor(null); setEditingId(null); setNotice("Encrypted vault saved."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Encrypted vault could not be saved."); }
    finally { setBusy(false); }
  }
  function openEditor(record?: VaultRecord) {
    setEditingId(record?.id ?? null);
    setEditor(record ? { type: record.type, name: record.name, url: record.url, username: record.username, email: record.email, password: record.password, category: record.category, folder: record.folder, notes: record.notes, favorite: record.favorite } : { ...EMPTY_FORM });
  }
  function submitEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editor) return;
    if (editor.url && !safeWebsiteUrl(editor.url)) { setError("Website URL must use http or https."); return; }
    const now = new Date().toISOString();
    const existing = records.find((record) => record.id === editingId);
    const next: VaultRecord = { ...editor, url: safeWebsiteUrl(editor.url) ?? "", id: existing?.id ?? makeEmptyLogin().id, createdAt: existing?.createdAt ?? now, updatedAt: now, passwordChangedAt: editor.password && editor.password !== existing?.password ? now : (existing?.passwordChangedAt ?? now) };
    void persist(existing ? records.map((record) => record.id === existing.id ? next : record) : [...records, next]);
  }
  async function remove(record: VaultRecord) {
    if (!window.confirm(`Permanently delete “${record.name}” from this vault?`)) return;
    await persist(records.filter((entry) => entry.id !== record.id));
  }

  async function checkRecordExposure(record: VaultRecord) {
    if (!record.password) return;
    setExposure((value) => ({ ...value, [record.id]: "checking" }));
    try {
      const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(record.password));
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
      const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, { headers: { "Add-Padding": "true" }, cache: "no-store" });
      if (!response.ok) throw new Error("lookup unavailable");
      const count = findPwnedPasswordCount(await response.text(), hash.slice(5));
      setExposure((value) => ({ ...value, [record.id]: count > 0 ? `Exposed ${count.toLocaleString()} times in the HIBP corpus` : "No match in the current HIBP corpus" }));
    } catch { setExposure((value) => ({ ...value, [record.id]: "Lookup unavailable" })); }
  }

  const filtered = useMemo(() => records.filter((record) => (categoryFilter === "All" || record.category === categoryFilter) && `${record.name} ${record.url} ${record.username} ${record.email} ${record.category} ${record.folder} ${record.notes}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [categoryFilter, records, search]);
  const health = useMemo(() => {
    const passwords = records.filter((record) => record.type === "LOGIN" && record.password);
    const missing = records.filter((record) => record.type === "LOGIN" && !record.password).length;
    const groups = new Map<string, number>();
    passwords.forEach((record) => groups.set(record.password, (groups.get(record.password) ?? 0) + 1));
    const reused = [...groups.values()].filter((count) => count > 1).reduce((total, count) => total + count, 0);
    const weak = passwords.filter((record) => analyzePasswordCandidate(record.password).score < 60).length;
    const old = asOf > 0 ? passwords.filter((record) => asOf - new Date(record.passwordChangedAt).getTime() > 365 * 86400_000).length : 0;
    return { total: passwords.length, missing, reused, weak, old };
  }, [asOf, records]);

  useEffect(() => {
    if (mode !== "open") return;
    const resetIdle = () => { if (idleTimer.current) clearTimeout(idleTimer.current); idleTimer.current = setTimeout(lock, INACTIVITY_MS); };
    const activity = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    activity.forEach((event) => window.addEventListener(event, resetIdle, { passive: true }));
    const hidden = () => { if (document.visibilityState === "hidden") lock(); };
    document.addEventListener("visibilitychange", hidden);
    resetIdle();
    return () => { activity.forEach((event) => window.removeEventListener(event, resetIdle)); document.removeEventListener("visibilitychange", hidden); if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, [lock, mode]);

  async function downloadBackup() {
    if (!vault) return;
    const data = { format: "crispus-zero-knowledge-vault", formatVersion: VAULT_FORMAT_VERSION, vault: metadataForApi(vault), recoveryKeyVersion: vault.recoveryKeyVersion ?? 1, records: stored };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "crispus-encrypted-vault-backup.json"; anchor.click(); URL.revokeObjectURL(url);
  }
  async function importBackup(file: File | undefined) {
    if (!file || !vault || !keyRef.current) return;
    setError(""); setNotice(""); setBusy(true);
    try {
      if (file.size > 5_000_000) throw new Error("Backup is too large (5 MB maximum).");
      const data: unknown = JSON.parse(await file.text());
      if (!data || typeof data !== "object" || (data as { format?: unknown }).format !== "crispus-zero-knowledge-vault" || (data as { formatVersion?: unknown }).formatVersion !== VAULT_FORMAT_VERSION) throw new Error("This encrypted backup format is not supported.");
      const backup = data as { vault?: Record<string, unknown>; records?: StoredRecord[] };
      if (!backup.vault || backup.vault.vaultId !== vault.id || !Array.isArray(backup.records) || backup.records.length > 1000 || backup.records.some((row) => !row || typeof row.id !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(row.id) || typeof row.nonce !== "string" || typeof row.ciphertext !== "string" || !row.ciphertext.length || row.ciphertext.length > 1_400_000)) throw new Error("Backup is malformed or belongs to a different vault.");
      const ids = new Set(backup.records.map((row) => row.id)); if (ids.size !== backup.records.length) throw new Error("Backup contains duplicate record IDs.");
      const decoded = await Promise.all(backup.records.map((row) => decryptRecord(keyRef.current!, vault.id, row.id, row)));
      if (!window.confirm(`Restore ${decoded.length} encrypted records? This replaces the current vault records.`)) return;
      await saveEncrypted(decoded);
      setNotice("Encrypted backup restored.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Encrypted backup could not be restored."); }
    finally { setBusy(false); if (backupInput.current) backupInput.current.value = ""; }
  }
  function exportPlaintext() {
    if (!plaintextWarning || !records.length) return;
    const blob = new Blob([JSON.stringify({ format: "plaintext-credentials", exportedAt: new Date().toISOString(), records }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "credentials-plaintext-sensitive.json"; anchor.click(); URL.revokeObjectURL(url); setPlaintextWarning(false);
  }

  const fieldClass = "mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#D9A441]/60 focus:ring-2 focus:ring-[#D9A441]/20";
  const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/15 px-4 text-sm text-white/80 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] disabled:opacity-50";

  return <section aria-labelledby="vault-heading" className="grid gap-5">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#D9A441]">Private encrypted storage</p><h2 id="vault-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">Encrypted password vault</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Passwords and notes are encrypted in this browser before saving. The server stores only ciphertext and key-wrapping metadata.</p></div>{mode === "open" && <button type="button" onClick={lock} className={buttonClass}><LockKeyhole size={16}/>Lock vault</button>}</header>
    {notice && <div role="status" className="rounded-xl border border-emerald-200/20 bg-emerald-100/[.06] p-3 text-sm text-emerald-100">{notice}</div>}
    {error && <div role="alert" className="rounded-xl border border-rose-200/20 bg-rose-100/[.06] p-3 text-sm text-rose-100">{error}</div>}
    {loading ? <LiquidLensSurface radius={24} className="p-6 text-sm text-white/55">Loading encrypted vault metadata…</LiquidLensSurface> : mode === "setup" ? <LiquidLensSurface radius={24} className="mx-auto w-full max-w-xl p-5 sm:p-7"><div className="flex items-center gap-3"><FileLock2 className="text-[#F2CF86]"/><h3 className="text-xl font-semibold">Create your private vault</h3></div><p className="mt-3 text-sm leading-6 text-white/60">Choose a unique master password with at least 12 characters. It cannot be reset by an administrator. If both it and your recovery key are lost, your vault is permanently inaccessible.</p><form className="mt-5 grid gap-4" onSubmit={(event) => void setupVault(event)}><label className="text-sm text-white/75">Master password<input className={fieldClass} type="password" autoComplete="new-password" minLength={12} maxLength={1024} required value={master} onChange={(event) => setMaster(event.target.value)}/></label><label className="text-sm text-white/75">Confirm master password<input className={fieldClass} type="password" autoComplete="new-password" minLength={12} maxLength={1024} required value={confirmMaster} onChange={(event) => setConfirmMaster(event.target.value)}/></label><button disabled={busy} className="min-h-11 rounded-full bg-[#D9A441] px-5 font-semibold text-[#17130b] disabled:opacity-50">{busy ? "Deriving keys…" : "Create encrypted vault"}</button></form><p className="mt-4 text-xs leading-5 text-white/45">Argon2id runs in this browser (64 MiB, 3 passes). Master password and derived keys are never sent to the server.</p></LiquidLensSurface> : mode === "setup-confirm" ? <LiquidLensSurface radius={24} className="mx-auto w-full max-w-xl p-5 sm:p-7"><div className="flex items-center gap-3"><KeyRound className="text-[#F2CF86]"/><h3 className="text-xl font-semibold">Save your recovery key</h3></div><p className="mt-3 text-sm leading-6 text-amber-100/80">Store this key offline in a secure place. It is shown once and cannot be recovered by us. Confirm it below to finish setup.</p><div className="mt-4 break-all rounded-xl border border-white/15 bg-black/30 p-4 font-mono text-lg tracking-wider text-white" aria-label="Recovery key">{shownRecovery}</div><button type="button" className={`${buttonClass} mt-3`} onClick={() => { void navigator.clipboard.writeText(shownRecovery).then(() => setNotice("Recovery key copied. Keep it private and clear your clipboard afterward.")); }}>Copy recovery key</button><label className="mt-5 block text-sm text-white/75">Re-enter recovery key to confirm<input className={fieldClass} autoComplete="off" spellCheck={false} value={recoveryConfirmed} onChange={(event) => setRecoveryConfirmed(event.target.value.toUpperCase())}/></label><button type="button" disabled={busy} onClick={() => void confirmSetup()} className="mt-4 min-h-11 w-full rounded-full bg-[#D9A441] font-semibold text-[#17130b] disabled:opacity-50">{busy ? "Saving encrypted setup…" : "Confirm and finish setup"}</button></LiquidLensSurface> : mode === "unlock" ? <LiquidLensSurface radius={24} className="mx-auto w-full max-w-md p-5 sm:p-7"><div className="flex items-center gap-3"><LockKeyhole className="text-[#F2CF86]"/><h3 className="text-xl font-semibold">Unlock vault</h3></div><form className="mt-5 grid gap-4" onSubmit={(event) => void unlock(event)}><label className="text-sm text-white/75">Master password<input className={fieldClass} type="password" autoComplete="current-password" maxLength={1024} required value={master} onChange={(event) => setMaster(event.target.value)}/></label><button disabled={busy} className="min-h-11 rounded-full bg-[#D9A441] font-semibold text-[#17130b] disabled:opacity-50">{busy ? "Unlocking…" : "Unlock"}</button></form><button type="button" onClick={() => { setMode("recovery"); setError(""); }} className="mt-4 text-sm text-white/55 underline decoration-white/20 underline-offset-4 hover:text-white">Use recovery key</button></LiquidLensSurface> : mode === "recovery" ? <LiquidLensSurface radius={24} className="mx-auto w-full max-w-md p-5 sm:p-7"><h3 className="text-xl font-semibold">Recover vault</h3><p className="mt-2 text-sm text-white/55">Recovery unlocks your existing vault so you can choose a new master password.</p><form className="mt-5 grid gap-4" onSubmit={(event) => void recover(event)}><label className="text-sm text-white/75">Recovery key<input className={fieldClass} autoComplete="off" spellCheck={false} value={recovery} onChange={(event) => setRecovery(event.target.value.toUpperCase())}/></label><button disabled={busy} className="min-h-11 rounded-full bg-[#D9A441] font-semibold text-[#17130b] disabled:opacity-50">{busy ? "Recovering…" : "Unlock with recovery key"}</button></form><button type="button" onClick={() => { setMode("unlock"); setError(""); }} className="mt-4 text-sm text-white/55 underline">Back to master password</button></LiquidLensSurface> : <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[["Vault records", records.length], ["Missing passwords", health.missing], ["Reused passwords", health.reused], ["Weak passwords", health.weak], ["Changed over a year ago", health.old]].map(([label, value]) => <LiquidLensSurface key={label} radius={18} className="p-4"><p className="text-xs text-white/50">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></LiquidLensSurface>)}</div>
      {(health.missing > 0 || health.reused > 0 || health.weak > 0 || health.old > 0) && <div className="flex items-start gap-3 rounded-2xl border border-amber-200/15 bg-amber-100/[.04] p-4 text-sm text-amber-100/80"><ShieldAlert size={18} className="mt-0.5 shrink-0"/><div><strong>Local password-health review</strong><p className="mt-1">{health.missing} missing, {health.reused} reused, {health.weak} weak by local heuristic, and {health.old} older than one year. These checks run only in this browser and do not transmit passwords. Edit an entry to fix it.</p></div></div>}
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => openEditor()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#D9A441] px-5 font-semibold text-[#17130b]"><Plus size={16}/>Add credential</button><button type="button" onClick={() => { setEditingId(null); setEditor({ ...EMPTY_FORM, type: "SECURE_NOTE" }); }} className={buttonClass}><Plus size={16}/>Secure note</button><button type="button" onClick={() => void downloadBackup()} className={buttonClass}><Download size={15}/>Encrypted backup</button><button type="button" onClick={() => backupInput.current?.click()} className={buttonClass}>Restore backup</button><input ref={backupInput} type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void importBackup(event.target.files?.[0])}/></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]"><label className="relative"><span className="sr-only">Search vault records</span><Search size={17} className="absolute left-3 top-3.5 text-white/40"/><input className={`${fieldClass} pl-10`} placeholder="Search names, usernames, folders…" value={search} onChange={(event) => setSearch(event.target.value)}/></label><label><span className="sr-only">Filter by category</span><select className={fieldClass} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>All</option>{[...new Set(records.map((record) => record.category))].filter(Boolean).map((category) => <option key={category}>{category}</option>)}</select></label></div>
      {filtered.length === 0 ? <LiquidLensSurface radius={22} className="p-8 text-center"><KeyRound className="mx-auto text-[#F2CF86]"/><h3 className="mt-3 text-lg font-semibold">{records.length ? "No matching records" : "Your vault is ready"}</h3><p className="mt-2 text-sm text-white/50">{records.length ? "Try another search or category." : "Add your first credential or secure note. It will be encrypted before leaving this device."}</p></LiquidLensSurface> : <div className="grid gap-3">{filtered.map((record) => <LiquidLensSurface key={record.id} radius={22} className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-lg font-semibold">{record.name || "Untitled"}</h3>{record.favorite && <span aria-label="Favourite" className="text-amber-200">★</span>}<span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/50">{record.type === "SECURE_NOTE" ? "Secure note" : record.category}</span></div>{safeWebsiteUrl(record.url) && <a href={safeWebsiteUrl(record.url)!} target="_blank" rel="noopener noreferrer" className="mt-1 block max-w-full truncate text-sm text-[#F2CF86] underline">{record.url}</a>}{record.folder && <p className="mt-1 text-xs text-white/40">Folder: {record.folder}</p>}</div><div className="flex gap-2"><button type="button" onClick={() => openEditor(record)} className={buttonClass}>Edit</button><button type="button" onClick={() => void remove(record)} aria-label={`Delete ${record.name || "record"}`} className="rounded-full border border-white/10 p-2 text-white/60 hover:text-rose-200"><Trash2 size={16}/></button></div></div>{record.type === "LOGIN" && <div className="mt-4 grid gap-2 sm:grid-cols-2"><div><p className="text-xs text-white/40">Username / email</p><p className="mt-1 break-all text-sm">{record.username || record.email || "Not set"}</p></div><div><p className="text-xs text-white/40">Password</p><div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-sm">{showSecrets[record.id] ? record.password : "•".repeat(Math.min(record.password.length || 8, 24))}</code><button type="button" onClick={() => setShowSecrets((current) => ({ ...current, [record.id]: !current[record.id] }))} aria-label={showSecrets[record.id] ? "Conceal password" : "Reveal password"} className="rounded-lg p-2 hover:bg-white/10">{showSecrets[record.id] ? <EyeOff size={15}/> : <Eye size={15}/>}</button><button type="button" onClick={() => void navigator.clipboard.writeText(record.password).then(() => setNotice("Password copied. Clear your clipboard after use."))} className="text-xs text-white/50 underline">Copy</button><button type="button" onClick={() => void checkRecordExposure(record)} className="text-xs text-white/50 underline">Check HIBP</button></div>{exposure[record.id] && <p role="status" className="mt-1 text-xs text-white/55">{exposure[record.id]}. SHA-1 was used only for this range lookup; only the five-character prefix was sent.</p>}</div></div>}{record.notes && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-5 text-white/60">{record.notes}</p>}</LiquidLensSurface>)}</div>}
      {editor && <div role="dialog" aria-modal="true" aria-labelledby="record-editor-title" className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4"><form onSubmit={submitEditor} className="my-auto grid max-h-[92vh] w-full max-w-2xl gap-4 overflow-y-auto rounded-3xl border border-white/15 bg-[#151515] p-5 shadow-2xl sm:p-7"><div className="flex items-center justify-between"><h3 id="record-editor-title" className="text-xl font-semibold">{editingId ? "Edit vault record" : editor.type === "SECURE_NOTE" ? "New secure note" : "New credential"}</h3><button type="button" onClick={() => setEditor(null)} className="text-white/50" aria-label="Close editor">✕</button></div><label className="text-sm text-white/70">Record type<select className={fieldClass} value={editor.type} onChange={(event) => setEditor({ ...editor, type: event.target.value as VaultForm["type"] })}><option value="LOGIN">Login</option><option value="SECURE_NOTE">Secure note</option></select></label><label className="text-sm text-white/70">Name<input className={fieldClass} required maxLength={180} autoComplete="off" value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })}/></label>{editor.type === "LOGIN" && <><label className="text-sm text-white/70">Website URL<input className={fieldClass} type="url" maxLength={2048} autoComplete="off" value={editor.url} onChange={(event) => setEditor({ ...editor, url: event.target.value })} placeholder="https://example.com"/></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-white/70">Username<input className={fieldClass} maxLength={256} autoComplete="off" value={editor.username} onChange={(event) => setEditor({ ...editor, username: event.target.value })}/></label><label className="text-sm text-white/70">Email<input className={fieldClass} type="email" maxLength={256} autoComplete="off" value={editor.email} onChange={(event) => setEditor({ ...editor, email: event.target.value })}/></label></div><label className="text-sm text-white/70">Password<div className="flex gap-2"><input className={fieldClass} type={showPassword ? "text" : "password"} autoComplete="new-password" maxLength={1024} value={editor.password} onChange={(event) => setEditor({ ...editor, password: event.target.value })}/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} className={buttonClass}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button><button type="button" onClick={() => setEditor({ ...editor, password: generateSecurePassword({ length: 24 }) })} className={buttonClass}>Generate</button></div></label><label className="text-sm text-white/70">Category<input className={fieldClass} maxLength={80} value={editor.category} onChange={(event) => setEditor({ ...editor, category: event.target.value })}/></label><label className="text-sm text-white/70">Folder<input className={fieldClass} maxLength={80} value={editor.folder} onChange={(event) => setEditor({ ...editor, folder: event.target.value })} placeholder="Optional"/></label><label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={editor.favorite} onChange={(event) => setEditor({ ...editor, favorite: event.target.checked })} className="accent-[#D9A441]"/>Favourite</label></>}<label className="text-sm text-white/70">{editor.type === "SECURE_NOTE" ? "Secure note" : "Notes"}<textarea className={`${fieldClass} min-h-28 py-3`} maxLength={10_000} value={editor.notes} onChange={(event) => setEditor({ ...editor, notes: event.target.value })}/></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditor(null)} className={buttonClass}>Cancel</button><button disabled={busy} className="min-h-10 rounded-full bg-[#D9A441] px-5 font-semibold text-[#17130b]">{busy ? "Encrypting…" : "Encrypt and save"}</button></div></form></div>}
      <LiquidLensSurface radius={22} className="p-5"><h3 className="text-lg font-semibold">Recovery and backup</h3><p className="mt-2 text-sm leading-6 text-white/55">Rotate recovery access after saving a new key. Encrypted backups can be restored only into this vault identity. Keep an offline copy before device loss.</p>{pendingRecovery ? <form onSubmit={(event) => void commitRecoveryRotation(event)} className="mt-4 grid gap-3"><p className="break-all rounded-xl bg-black/30 p-3 font-mono text-sm">{pendingRecovery}</p><label className="text-sm">Re-enter new recovery key<input className={fieldClass} value={rotateRecoveryConfirm} onChange={(event) => setRotateRecoveryConfirm(event.target.value.toUpperCase())}/></label><button disabled={busy} className={buttonClass}>Confirm and rotate recovery key</button></form> : <button type="button" onClick={beginRecoveryRotation} className={`${buttonClass} mt-4`}>Rotate recovery key</button>}{shownRecovery && mode === "open" && <div className="mt-4 rounded-xl border border-amber-200/20 p-3"><p className="text-sm font-medium text-amber-100">New recovery key — save this before leaving</p><p className="mt-2 break-all font-mono text-sm">{shownRecovery}</p><button type="button" onClick={() => setShownRecovery("")} className="mt-3 text-xs underline">I saved it; hide key</button></div>}</LiquidLensSurface>
      <LiquidLensSurface radius={22} className="p-5"><h3 className="text-lg font-semibold">Change master password</h3><p className="mt-2 text-sm text-white/55">Rewraps the random vault data key. Records remain independently encrypted.</p><form onSubmit={(event) => void changeMasterPassword(event)} className="mt-4 grid max-w-xl gap-3"><label className="text-sm text-white/70">New master password<input className={fieldClass} type="password" autoComplete="new-password" minLength={12} maxLength={1024} value={changeMaster} onChange={(event) => setChangeMaster(event.target.value)}/></label><label className="text-sm text-white/70">Confirm new password<input className={fieldClass} type="password" autoComplete="new-password" minLength={12} maxLength={1024} value={confirmChangeMaster} onChange={(event) => setConfirmChangeMaster(event.target.value)}/></label><button disabled={busy} className={buttonClass}>Change master password</button></form></LiquidLensSurface>
      <LiquidLensSurface radius={22} className="p-5"><h3 className="text-lg font-semibold">Export options</h3><p className="mt-2 text-sm leading-6 text-white/55">The encrypted backup contains no readable entries. Plaintext export is risky and should only be used for a deliberate transfer.</p><label className="mt-4 flex items-start gap-2 text-sm text-rose-100/80"><input type="checkbox" checked={plaintextWarning} onChange={(event) => setPlaintextWarning(event.target.checked)} className="mt-1 accent-rose-400"/><span>I understand this export contains every password and note in readable form. I will store and delete it securely.</span></label><button type="button" disabled={!plaintextWarning || !records.length} onClick={exportPlaintext} className="mt-3 min-h-10 rounded-full border border-rose-200/20 px-4 text-sm text-rose-100 disabled:opacity-40">Download plaintext export</button></LiquidLensSurface>
    </>}
  </section>;
}
