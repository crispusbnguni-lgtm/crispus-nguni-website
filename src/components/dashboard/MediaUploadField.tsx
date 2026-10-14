"use client";
/* eslint-disable @next/next/no-img-element */
import { ChangeEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type MediaUploadFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  altText?: string;
  accept?: string;
  helpText?: string;
};

export function MediaUploadField({
  label,
  value,
  onChange,
  altText = "",
  accept = "image/jpeg,image/png,image/webp,image/gif",
  helpText,
}: MediaUploadFieldProps) {
  const searchParams = useSearchParams();

  const adminUserId =
    searchParams.get("adminUserId")?.trim() || "";

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [localPreview, setLocalPreview] = useState<string | null>(
    null
  );

  useEffect(() => {
    return () => {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setMessage("");
    setUploading(true);

    const previewUrl = URL.createObjectURL(file);

    setLocalPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return previewUrl;
    });

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("visibility", "PUBLIC");

      if (altText.trim()) {
        formData.append("altText", altText.trim());
      }

      if (adminUserId) {
        formData.append("adminUserId", adminUserId);
      }

      const response = await fetch("/api/media", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message || "Unable to upload the image."
        );
        return;
      }

      if (!data.media?.id) {
        setMessage(
          "The image uploaded but no media ID was returned."
        );
        return;
      }

      const mediaUrl = `/api/media/${data.media.id}`;

      onChange(mediaUrl);

      setMessage("Photo uploaded successfully.");
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setUploading(false);

      event.target.value = "";
    }
  }

  function removeImage() {
    setLocalPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return null;
    });

    onChange("");
    setMessage("");
  }

  const previewSource = localPreview || value;

  return (
    <div>
      <label className="mb-2 block text-sm text-white/60">
        {label}
      </label>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            {previewSource ? (
              <img
                src={previewSource}
                alt={altText || label}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="px-4 text-center text-xs leading-5 text-white/25">
                No photo selected
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap gap-3">
              <label className="cursor-pointer rounded-xl bg-[#126BFF] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#2477ff] hover:shadow-[0_0_25px_rgba(18,107,255,0.25)]">
                {uploading
                  ? "Uploading..."
                  : previewSource
                    ? "Replace Photo"
                    : "Upload Photo"}

                <input
                  type="file"
                  accept={accept}
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="hidden"
                />
              </label>

              {value && (
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={uploading}
                  className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>

            <p className="mt-3 text-xs leading-5 text-white/30">
              Upload a professional image directly from your
              computer. The image will be securely stored in
              your portfolio media library.
            </p>

            {helpText && (
              <p className="mt-2 text-xs leading-5 text-white/25">
                {helpText}
              </p>
            )}

            {message && (
              <p
                className={`mt-3 text-xs ${
                  message.includes("successfully")
                    ? "text-[#00C98B]"
                    : "text-red-400"
                }`}
              >
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}