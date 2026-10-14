"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
type MediaAsset = {
  path: string;
  url: string;
  name: string;
  type: "image" | "video";
  size: number;
  createdAt?: string | null;
};

type MediaLibraryProps = {
  onSelect?: (asset: MediaAsset) => void;
  selectedUrl?: string;
  selectionMode?: boolean;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  assets?: MediaAsset[];
  asset?: MediaAsset;
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibrary({
  onSelect,
  selectedUrl,
  selectionMode = false,
}: MediaLibraryProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch(
        "/api/admin/backgrounds/welcome-page/media",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load media.");
      }

      setAssets(data.assets ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load media.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

 useEffect(() => {
  let cancelled = false;

  async function fetchAssets() {
    try {
      const response = await fetch(
        "/api/admin/backgrounds/welcome-page/media",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load media.");
      }

      if (!cancelled) {
        setAssets(data.assets ?? []);
        setError("");
      }
    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load media.",
        );
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  void fetchAssets();

  return () => {
    cancelled = true;
  };
}, []);

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesType = filter === "all" || asset.type === filter;
      const matchesSearch =
        !query ||
        asset.name.toLowerCase().includes(query) ||
        asset.path.toLowerCase().includes(query);

      return matchesType && matchesSearch;
    });
  }, [assets, filter, search]);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;

    const files = Array.from(fileList);

    setMessage("");
    setError("");

    const invalidFile = files.find((file) => {
      const supported =
        file.type.startsWith("image/") &&
        [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/avif",
          "image/gif",
        ].includes(file.type);

      const supportedVideo = [
        "video/mp4",
        "video/webm",
      ].includes(file.type);

      return (
        (!supported && !supportedVideo) ||
        file.size === 0 ||
        file.size > MAX_FILE_SIZE
      );
    });

    if (invalidFile) {
      setError(
        `"${invalidFile.name}" is unsupported or exceeds the 50 MB limit.`,
      );
      return;
    }

    setUploading(true);

    let uploadedCount = 0;
    const failures: string[] = [];

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        try {
          const response = await fetch(
            "/api/admin/backgrounds/welcome-page/media",
            {
              method: "POST",
              body: formData,
            },
          );

          const data = (await response.json()) as ApiResponse;

          if (!response.ok || !data.success) {
            throw new Error(data.message || "Upload failed.");
          }

          uploadedCount++;
        } catch (err) {
          failures.push(
            `${file.name}: ${
              err instanceof Error ? err.message : "Upload failed."
            }`,
          );
        }
      }

      await loadAssets(true);

      if (uploadedCount > 0) {
        setMessage(
          `${uploadedCount} file${uploadedCount === 1 ? "" : "s"} uploaded successfully.`,
        );
      }

      if (failures.length > 0) {
        setError(failures.join(" "));
      }
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function deleteAsset(asset: MediaAsset) {
    const confirmed = window.confirm(
      `Permanently delete "${asset.name}"?\n\nAny page or design using this file may lose its background or media.`,
    );

    if (!confirmed) return;

    setDeletingPath(asset.path);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/admin/backgrounds/welcome-page/media",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path: asset.path }),
        },
      );

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete media.");
      }

      setAssets((current) =>
        current.filter((item) => item.path !== asset.path),
      );

      setMessage("Media deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete media.",
      );
    } finally {
      setDeletingPath(null);
    }
  }

  return (
    <section className="space-y-6 text-white">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-300">
            SUPABASE STORAGE
          </p>

          <h2 className="mt-1 text-2xl font-bold">
            Media Library
          </h2>

          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Manage the images and videos used across your welcome page.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadAssets(true)}
            disabled={loading || refreshing || uploading}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10 disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload media"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm"
            multiple
            className="hidden"
            onChange={(event) => {
              void uploadFiles(event.target.files);
            }}
          />
        </div>
      </header>

      {uploading && (
        <div
          className="rounded-xl border border-indigo-400/20 bg-indigo-400/10 p-4 text-sm text-indigo-200"
          role="status"
        >
          Uploading files. Please keep this page open until the upload
          finishes.
        </div>
      )}

      {message && (
        <div
          className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-300"
          role="status"
        >
          {message}
        </div>
      )}

      {error && (
        <div
          className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-slate-400">Total assets</p>
          <p className="mt-2 text-2xl font-bold">{assets.length}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-slate-400">Images</p>
          <p className="mt-2 text-2xl font-bold">
            {assets.filter((asset) => asset.type === "image").length}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-slate-400">Videos</p>
          <p className="mt-2 text-2xl font-bold">
            {assets.filter((asset) => asset.type === "video").length}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search files..."
          aria-label="Search media files"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#080B14] px-4 py-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-indigo-400"
        />

        <select
          value={filter}
          onChange={(event) =>
            setFilter(event.target.value as "all" | "image" | "video")
          }
          aria-label="Filter media type"
          className="rounded-xl border border-white/10 bg-[#080B14] px-4 py-3 text-sm outline-none focus:border-indigo-400"
        >
          <option value="all">All media</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
        </select>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center text-slate-400">
          Loading your media library...
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
          <div className="text-3xl">▧</div>

          <h3 className="mt-3 font-semibold">
            {assets.length === 0
              ? "Your media library is empty"
              : "No matching media"}
          </h3>

          <p className="mt-2 text-sm text-slate-400">
            {assets.length === 0
              ? "Upload a photo or video to start customizing your backgrounds."
              : "Try a different search term or filter."}
          </p>

          {assets.length === 0 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold hover:bg-indigo-400"
            >
              Upload your first file
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredAssets.map((asset) => {
            const isSelected = selectedUrl === asset.url;
            const isDeleting = deletingPath === asset.path;

            return (
              <article
                key={asset.path}
                className={`overflow-hidden rounded-2xl border bg-white/[0.025] transition ${
                  isSelected
                    ? "border-indigo-400 ring-1 ring-indigo-400/50"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className="relative aspect-video overflow-hidden bg-[#05070D]">
                  {asset.type === "video" ? (
                    <video
                      src={asset.url}
                      controls
                      preload="metadata"
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Image
  src={asset.url}
  alt={asset.name}
  fill
  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
  className="object-cover"
/>
                  )}

                  <span className="absolute left-3 top-3 rounded-lg border border-white/10 bg-black/70 px-2 py-1 text-xs font-medium uppercase text-white">
                    {asset.type}
                  </span>

                  {isSelected && (
                    <span className="absolute right-3 top-3 rounded-lg bg-indigo-500 px-2 py-1 text-xs font-semibold">
                      Selected
                    </span>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <h3
                      className="truncate text-sm font-semibold"
                      title={asset.name}
                    >
                      {asset.name}
                    </h3>

                    <p className="mt-1 text-xs text-slate-400">
                      {formatBytes(asset.size)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {onSelect && (
                      <button
                        type="button"
                        onClick={() => onSelect(asset)}
                        className="flex-1 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold transition hover:bg-indigo-400"
                      >
                        {selectionMode
                          ? "Use this media"
                          : isSelected
                            ? "Selected"
                            : "Select"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void deleteAsset(asset)}
                      disabled={isDeleting || uploading}
                      className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="text-xs leading-5 text-slate-500">
        Upload limit: 50 MB per file. Supported formats include JPEG, PNG,
        WebP, AVIF, GIF, MP4 and WebM. Deleting an asset may break any page
        that references it.
      </p>
    </section>
  );
}