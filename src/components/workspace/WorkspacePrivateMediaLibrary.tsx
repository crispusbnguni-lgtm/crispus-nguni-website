"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import Image from "next/image";
import { ImagePlus, LoaderCircle, RefreshCw, Search, Trash2 } from "lucide-react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

type Asset = { id: string; mimeType: string; byteSize: number; width: number | null; height: number | null; createdAt: string; src: string };

function upload(file: File, assetId?: string, progress?: (value: number) => void) {
  return new Promise<{ success?: boolean; asset?: Asset; storageCleanupPending?: boolean; message?: string }>((resolve, reject) => {
    const form = new FormData(); form.set("file", file);
    const request = new XMLHttpRequest(); request.open(assetId ? "PUT" : "POST", assetId ? `/api/dashboard/workspace/media/${encodeURIComponent(assetId)}` : "/api/dashboard/workspace/media");
    request.withCredentials = true;
    request.upload.onprogress = (event) => { if (event.lengthComputable) progress?.(Math.floor(event.loaded / event.total * 100)); };
    request.onload = () => { try { resolve(JSON.parse(request.responseText) as { success?: boolean; asset?: Asset; storageCleanupPending?: boolean; message?: string }); } catch { reject(new Error("The upload response could not be read.")); } };
    request.onerror = () => reject(new Error("Upload could not reach the private media service."));
    request.send(form);
  });
}

export function WorkspacePrivateMediaLibrary() {
  const input = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/workspace/media", { cache: "no-store" });
      const result = await response.json() as { success?: boolean; assets?: Asset[]; message?: string };
      if (!response.ok || !result.success || !Array.isArray(result.assets)) throw new Error(result.message || "Private media is unavailable.");
      setAssets(result.assets); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Private media is unavailable."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  async function addFile(file?: File) {
    if (!file) return;
    setBusy(true); setProgress(0); setError(""); setMessage("");
    try {
      const result = await upload(file, undefined, setProgress);
      if (!result.success || !result.asset) throw new Error(result.message || "Upload failed.");
      setAssets((current) => [result.asset!, ...current]); setMessage("Image uploaded to your private workspace library.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed."); }
    finally { setBusy(false); setProgress(0); if (input.current) input.current.value = ""; }
  }

  async function replaceAsset(asset: Asset, file?: File) {
    if (!file) return;
    setBusy(true); setProgress(0); setError(""); setMessage("");
    try {
      const result = await upload(file, asset.id, setProgress);
      if (!result.success) throw new Error(result.message || "Replacement failed.");
      setMessage(result.storageCleanupPending ? "Image replaced; private storage cleanup is pending." : "Image replaced while keeping its workspace reference.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Replacement failed."); }
    finally { setBusy(false); setProgress(0); }
  }

  async function deleteAsset(asset: Asset) {
    if (!window.confirm("Delete this private image? Images still used by a page cannot be deleted.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/dashboard/workspace/media/${encodeURIComponent(asset.id)}`, { method: "DELETE", cache: "no-store" });
      const result = await response.json() as { success?: boolean; storageCleanupPending?: boolean; message?: string };
      if (!response.ok || !result.success) throw new Error(result.message || "Image could not be deleted.");
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setMessage(result.storageCleanupPending ? "Media reference was removed; private object cleanup is pending." : "Image deleted.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Image could not be deleted."); }
    finally { setBusy(false); }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); void addFile(event.dataTransfer.files[0]); }
  const visible = assets.filter((asset) => `${asset.id} ${asset.mimeType}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8" aria-label="Private workspace media library">
    <LiquidLensSurface radius={24} className="p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-[#D9A441]">Private workspace</p><h2 className="mt-1 text-xl font-semibold">Media library</h2></div><p className="max-w-xl text-xs leading-5 text-white/45">Uploads use a separate private bucket and authenticated delivery. They are not public portfolio or CMS assets.</p></div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose private workspace image" onChange={(event) => void addFile(event.currentTarget.files?.[0])}/>
      <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} className={`mt-5 grid min-h-36 place-items-center rounded-2xl border border-dashed p-5 text-center transition ${dragging ? "border-[#D9A441]/60 bg-[#D9A441]/10" : "border-white/15 bg-black/10"}`}>
        <div><ImagePlus className="mx-auto text-[#F2CF86]" size={24}/><p className="mt-2 text-sm font-medium">Drop an image here or choose a file</p><p className="mt-1 text-xs text-white/45">JPG, PNG or WebP · up to 5 MB · private to this workspace</p><button type="button" disabled={busy} onClick={() => input.current?.click()} className="mt-3 min-h-10 rounded-full border border-white/15 px-4 text-xs text-white/75 disabled:opacity-50">Choose image</button></div>
      </div>
      {busy && <div className="mt-3" role="status"><div className="flex items-center gap-2 text-xs text-white/60"><LoaderCircle size={14} className="animate-spin motion-reduce:animate-none"/> Uploading or replacing · {progress}%</div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#D9A441] transition-[width]" style={{ width: `${progress}%` }}/></div></div>}
      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200/15 bg-rose-200/[.05] p-3 text-sm text-rose-100">{error}</p>}{message && <p role="status" className="mt-3 text-sm text-emerald-100/80">{message}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-2"><label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 px-3"><Search size={15} className="text-white/45"/><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search private workspace images" placeholder="Search your images" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></label><button type="button" onClick={() => { setLoading(true); void refresh(); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-white/65"><RefreshCw size={14}/>Refresh</button></div>
      {loading ? <p className="mt-4 text-sm text-white/45">Loading private media…</p> : visible.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map((asset) => <li key={asset.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/10"><div className="relative aspect-[16/10] bg-black/20"><Image src={asset.src} alt="Private workspace image" fill unoptimized className="object-contain" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"/></div><div className="p-3"><p className="truncate text-xs text-white/65">{asset.mimeType} · {(asset.byteSize / 1024).toFixed(0)} KB{asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}</p><p className="mt-1 truncate font-mono text-[10px] text-white/35">{asset.id}</p><div className="mt-3 flex gap-2"><label className="flex min-h-9 cursor-pointer items-center rounded-full border border-white/10 px-3 text-xs text-white/65">Replace<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(event) => void replaceAsset(asset, event.currentTarget.files?.[0])}/></label><button type="button" disabled={busy} onClick={() => void deleteAsset(asset)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-rose-200/15 px-3 text-xs text-rose-100"><Trash2 size={13}/>Delete</button></div></div></li>)}</ul> : <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/45">{assets.length ? "No images match this search." : "No private images uploaded yet."}</p>}
    </LiquidLensSurface>
  </section>;
}
