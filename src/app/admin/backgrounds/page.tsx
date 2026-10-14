
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BackgroundOption = {
  id: string;
  name: string;
  type: string;
  value: string;
  description: string | null;
  enabled: boolean;
  isDefault: boolean;
  sortOrder: number;
};

export default function BackgroundsPage() {
  const [backgrounds, setBackgrounds] = useState<BackgroundOption[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<"COLOR" | "IMAGE">("COLOR");
  const [value, setValue] = useState("#05070D");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [imageSource, setImageSource] = useState<"UPLOAD" | "URL">("UPLOAD");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  const loadBackgrounds = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/backgrounds", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Could not load backgrounds.");
      }
      setBackgrounds(data.backgrounds || []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load backgrounds."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
  let cancelled = false;

  async function load() {
    try {
      const response = await fetch("/api/admin/backgrounds", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load backgrounds.");
      }

      if (!cancelled) {
        setBackgrounds(data.backgrounds || []);
      }
    } catch (error) {
      if (!cancelled) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load backgrounds."
        );
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  void load();

  return () => {
    cancelled = true;
  };
}, []);
  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  async function handleImageSelect(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage("");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setMessage("Choose a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Your image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const preview = URL.createObjectURL(file);
    previewRef.current = preview;
    setValue(preview);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/backgrounds/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data.success || !data.url) {
        throw new Error(data.message || "Could not upload the image.");
      }

      setValue(data.url);
      setMessage("Photo uploaded. Complete the form and add the background.");
    } catch (error) {
      setValue("");
      setMessage(
        error instanceof Error ? error.message : "Could not upload the image."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      if (type === "IMAGE" && value.startsWith("blob:")) {
        throw new Error("Please wait for the image upload to finish.");
      }

      if (type === "IMAGE" && !value.startsWith("https://")) {
        throw new Error("Upload a photo or enter a valid HTTPS image URL.");
      }

      const response = await fetch("/api/admin/backgrounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          value,
          description,
          enabled,
          isDefault,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Could not save background.");
      }

      setMessage("Background added successfully.");
      setName("");
      setDescription("");
      setType("COLOR");
      setValue("#05070D");
      setEnabled(true);
      setIsDefault(false);
      setImageSource("UPLOAD");

      if (fileInputRef.current) fileInputRef.current.value = "";
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }

      await loadBackgrounds();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save background."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-white outline-none focus:border-sky-400";

  return (
    <main className="min-h-screen bg-[#05070D] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <a href="/admin" className="text-sm text-sky-400 hover:text-sky-300">
            Back to Super Admin
        </a>

        <div className="mb-8 mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400">
            Design control
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Background Library
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Manage the background options available across your portfolio
            platform. Upload photos or create custom colors.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold">Add a background</h2>
            <p className="mb-5 mt-1 text-sm text-slate-400">
              Upload a photo from your computer or use an HTTPS image URL.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Background name
                </label>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Midnight Navy"
                  maxLength={100}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Background type
                </label>
                <select
  className={inputClass}
  value={type ?? "COLOR"}
  onChange={(event) => {
    const nextType = event.target.value as "COLOR" | "IMAGE";
    setType(nextType);
    setValue(nextType === "COLOR" ? "#05070D" : "");
    setImageSource("UPLOAD");
    setMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
  }}
>
  <option value="COLOR">Solid color</option>
  <option value="IMAGE">Photo background</option>
</select>
              </div>

              {type === "COLOR" ? (
                <div>
                  <label className="mb-2 block text-sm text-slate-300">
                    Choose color
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#05070D"}
                      onChange={(event) => setValue(event.target.value)}
                      className="h-12 w-16 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                    />
                    <input
                      className={inputClass}
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      placeholder="#05070D"
                      pattern="^#[0-9a-fA-F]{6}$"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setImageSource("UPLOAD");
                        setValue("");
                        setMessage("");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        if (previewRef.current) {
                          URL.revokeObjectURL(previewRef.current);
                          previewRef.current = null;
                        }
                      }}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                        imageSource === "UPLOAD"
                          ? "border-sky-400 bg-sky-400/10 text-sky-300"
                          : "border-white/10 text-slate-300"
                      }`}
                    >
                      Upload photo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImageSource("URL");
                        setValue("");
                        setMessage("");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        if (previewRef.current) {
                          URL.revokeObjectURL(previewRef.current);
                          previewRef.current = null;
                        }
                      }}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                        imageSource === "URL"
                          ? "border-sky-400 bg-sky-400/10 text-sky-300"
                          : "border-white/10 text-slate-300"
                      }`}
                    >
                      Use image URL
                    </button>
                  </div>

                  {imageSource === "UPLOAD" ? (
                    <div>
                      <label className="mb-2 block text-sm text-slate-300">
                        Choose a photo (JPG, PNG, WebP; max 5 MB)
                      </label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageSelect}
                        className="w-full rounded-xl border border-white/10 bg-[#0b1220] p-3 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-400 file:px-3 file:py-2 file:font-semibold file:text-slate-950"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="mb-2 block text-sm text-slate-300">
                        Image URL (HTTPS)
                      </label>
                      <input
                        className={inputClass}
                        type="url"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        placeholder="https://example.com/background.jpg"
                        required
                      />
                    </div>
                  )}

                  {value && (
                    <div>
                      <p className="mb-2 text-sm text-slate-300">Preview</p>
                      <div
                        className="h-36 rounded-xl border border-white/10 bg-cover bg-center"
                        style={{
                          backgroundImage: `url("${value.replace(/["\\]/g, "")}")`,
                        }}
                      />
                    </div>
                  )}

                  {uploading && (
                    <p className="text-sm text-sky-300">Uploading photo...</p>
                  )}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Description (optional)
                </label>
                <textarea
                  className={inputClass}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="A clean, professional background"
                  rows={3}
                />
              </div>

              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  className="h-4 w-4 accent-sky-400"
                />
                Available for users
              </label>

              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(event) => setIsDefault(event.target.checked)}
                  className="h-4 w-4 accent-sky-400"
                />
                Set as library default
              </label>

              <button
                type="submit"
                disabled={saving || uploading}
                className="w-full rounded-xl bg-sky-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading
                  ? "Uploading photo..."
                  : saving
                    ? "Saving..."
                    : "Add background"}
              </button>
            </form>

            {message && (
              <p role="status" className="mt-4 break-words text-sm text-sky-300">
                {message}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Saved backgrounds</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {backgrounds.length} background
                  {backgrounds.length === 1 ? "" : "s"} in the library
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadBackgrounds()}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="py-10 text-center text-sm text-slate-400">
                Loading backgrounds...
              </p>
            ) : backgrounds.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-5 py-12 text-center">
                <p className="font-medium">Your library is empty</p>
                <p className="mt-2 text-sm text-slate-400">
                  Add your first background using the form.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {backgrounds.map((background) => (
                  <article
                    key={background.id}
                    className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1220]"
                  >
                    <div
                      className="h-28 border-b border-white/10"
                      style={
                        background.type === "COLOR"
                          ? { backgroundColor: background.value }
                          : {
                              backgroundImage: `url("${background.value.replace(/["\\]/g, "")}")`,
                              backgroundPosition: "center",
                              backgroundSize: "cover",
                            }
                      }
                    />
                    <div className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{background.name}</h3>
                        {background.isDefault && (
                          <span className="rounded-full bg-sky-400/10 px-2 py-1 text-xs text-sky-300">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="mt-2 break-all text-xs text-slate-400">
                        {background.type === "COLOR"
                          ? background.value
                          : "Image background"}
                      </p>
                      {background.description && (
                        <p className="mt-2 text-sm text-slate-400">
                          {background.description}
                        </p>
                      )}
                      <p className="mt-3 text-xs text-slate-500">
                        {background.enabled ? "Enabled" : "Disabled"}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}