"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type PostMedia = {
  id: string;
  media: {
    id: string;
    name: string;
    originalName: string;
    mimeType: string;
    size: number;
    type: "IMAGE" | "VIDEO" | "DOCUMENT";
    visibility: "PRIVATE" | "PUBLIC";
    storagePath: string;
    altText: string | null;
    width: number | null;
    height: number | null;
    duration: number | null;
  };
  sortOrder: number;
};

type Post = {
  id: string;
  caption: string | null;
  visibility: "DRAFT" | "PUBLISHED";
  featured: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  media: PostMedia[];
};

type SelectedFile = {
  file: File;
  previewUrl: string;
  mediaId?: string;
  uploading?: boolean;
  error?: string;
};

const emptyForm = {
  caption: "",
  visibility: "DRAFT" as "DRAFT" | "PUBLISHED",
  featured: false,
};

export function PostsManager() {
  const searchParams = useSearchParams();

  const adminUserId =
    searchParams.get("adminUserId")?.trim() || "";

  const postsApiUrl = adminUserId
    ? `/api/posts?adminUserId=${encodeURIComponent(
        adminUserId
      )}`
    : "/api/posts";

  const [posts, setPosts] = useState<Post[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedFiles, setSelectedFiles] = useState<
    SelectedFile[]
  >([]);
  const [editingId, setEditingId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(
    null
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch(postsApiUrl)
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load posts."
          );
        }

        return data.posts as Post[];
      })
      .then((data) => {
        if (!cancelled) {
          setPosts(data);
          setLoading(false);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setMessage(error.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [postsApiUrl]);

  function resetForm() {
    selectedFiles.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });

    setForm(emptyForm);
    setSelectedFiles([]);
    setEditingId(null);
  }

  function updateField(
    field: keyof typeof emptyForm,
    value: string | boolean
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleFileSelection(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    const validFiles = files.filter(
      (file) =>
        file.type.startsWith("image/") ||
        file.type.startsWith("video/")
    );

    const invalidCount =
      files.length - validFiles.length;

    if (invalidCount > 0) {
      setMessage(
        "Only image and video files can be added to posts."
      );
    } else {
      setMessage("");
    }

    const remainingSlots =
      20 - selectedFiles.length;

    const filesToAdd = validFiles.slice(
      0,
      remainingSlots
    );

    const newFiles = filesToAdd.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setSelectedFiles((current) => [
      ...current,
      ...newFiles,
    ]);

    event.target.value = "";
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((current) => {
      const item = current[index];

      if (item) {
        URL.revokeObjectURL(item.previewUrl);
      }

      return current.filter(
        (_, currentIndex) => currentIndex !== index
      );
    });
  }

  function moveSelectedFile(
    index: number,
    direction: "up" | "down"
  ) {
    setSelectedFiles((current) => {
      const targetIndex =
        direction === "up" ? index - 1 : index + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= current.length
      ) {
        return current;
      }

      const updated = [...current];

      const temporary = updated[index];

      updated[index] = updated[targetIndex];
      updated[targetIndex] = temporary;

      return updated;
    });
  }

  async function uploadFile(
    selectedFile: SelectedFile
  ): Promise<string> {
    const formData = new FormData();

    formData.append("file", selectedFile.file);

    if (adminUserId) {
      formData.append("adminUserId", adminUserId);
    }

    const response = await fetch("/api/media", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to upload media."
      );
    }

    return data.media.id as string;
  }

  async function savePost(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      const mediaIds: string[] = [];

      for (let index = 0; index < selectedFiles.length; index++) {
        const item = selectedFiles[index];

        if (item.mediaId) {
          mediaIds.push(item.mediaId);
          continue;
        }

        setSelectedFiles((current) =>
          current.map((file, fileIndex) =>
            fileIndex === index
              ? {
                  ...file,
                  uploading: true,
                  error: undefined,
                }
              : file
          )
        );

        try {
          const mediaId = await uploadFile(item);

          mediaIds.push(mediaId);

          setSelectedFiles((current) =>
            current.map((file, fileIndex) =>
              fileIndex === index
                ? {
                    ...file,
                    mediaId,
                    uploading: false,
                  }
                : file
            )
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Unable to upload media.";

          setSelectedFiles((current) =>
            current.map((file, fileIndex) =>
              fileIndex === index
                ? {
                    ...file,
                    uploading: false,
                    error: errorMessage,
                  }
                : file
            )
          );

          throw new Error(
            `Unable to upload ${item.file.name}: ${errorMessage}`
          );
        }
      }

      const response = await fetch("/api/posts", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: editingId,
          caption: form.caption,
          visibility: form.visibility,
          featured: form.featured,
          mediaIds,
          ...(adminUserId
            ? { adminUserId }
            : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message || "Unable to save post."
        );
        return;
      }

      if (editingId) {
        setPosts((current) =>
          current.map((post) =>
            post.id === editingId
              ? data.post
              : post
          )
        );
      } else {
        setPosts((current) => [
          data.post,
          ...current,
        ]);
      }

      setMessage(
        data.message || "Post saved successfully."
      );

      resetForm();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save post."
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditing(post: Post) {
    selectedFiles.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });

    setEditingId(post.id);

    setForm({
      caption: post.caption || "",
      visibility: post.visibility,
      featured: post.featured,
    });

    setSelectedFiles(
      post.media.map((postMedia) => ({
        file: new File([], postMedia.media.originalName),
        previewUrl: `/api/media/${postMedia.media.id}`,
        mediaId: postMedia.media.id,
      }))
    );

    setMessage("");
  }

  async function deletePost(id: string) {
    if (!window.confirm("Delete this post?")) {
      return;
    }

    setActionId(id);
    setMessage("");

    const query = new URLSearchParams({
      postId: id,
    });

    if (adminUserId) {
      query.set("adminUserId", adminUserId);
    }

    try {
      const response = await fetch(
        `/api/posts?${query.toString()}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message || "Unable to delete post."
        );
        return;
      }

      setPosts((current) =>
        current.filter((post) => post.id !== id)
      );

      if (editingId === id) {
        resetForm();
      }

      setMessage(
        data.message || "Post deleted successfully."
      );
    } catch {
      setMessage("Unable to delete post.");
    } finally {
      setActionId(null);
    }
  }


  return (
    <section className="mt-8 liquid-glass rounded-3xl p-6 shadow-2xl sm:p-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-[#D9A441]">
          Content &amp; Media
        </p>

        <h2 className="mt-3 text-2xl font-semibold">
          {adminUserId ? "Manage User Posts" : "Posts"}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
          Publish professional photos, videos and
          updates directly to your portfolio.
        </p>
      </div>

      {adminUserId && (
        <div className="mt-6 rounded-2xl border border-[#D9A441]/20 bg-[#D9A441]/5 p-4">
          <p className="text-sm font-medium text-[#D9A441]">
            Super Admin Mode
          </p>

          <p className="mt-1 text-xs leading-5 text-white/40">
            You are managing posts for the selected
            user.
          </p>
        </div>
      )}

      {message && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
          {message}
        </div>
      )}

      <form
        onSubmit={savePost}
        className="mt-8 space-y-6"
      >
        <div>
          <label className="text-sm text-white/60">
            Caption
          </label>

          <textarea
            value={form.caption}
            onChange={(event) =>
              updateField(
                "caption",
                event.target.value
              )
            }
            placeholder="Write something about this post..."
            rows={5}
            className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-white/25 focus:border-[#126BFF]/50"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="text-sm text-white/60">
              Visibility
            </label>

            <select
              value={form.visibility}
              onChange={(event) =>
                updateField(
                  "visibility",
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#126BFF]/50"
            >
              <option value="DRAFT">
                Draft
              </option>

              <option value="PUBLISHED">
                Published
              </option>
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(event) =>
                updateField(
                  "featured",
                  event.target.checked
                )
              }
              className="h-4 w-4 accent-[#126BFF]"
            />

            <span>
              <span className="block text-sm font-medium">
                Featured Post
              </span>

              <span className="mt-1 block text-xs text-white/35">
                Give this post extra prominence on
                your website.
              </span>
            </span>
          </label>
        </div>

        <div>
          <label className="text-sm text-white/60">
            Photos & Videos
          </label>

          <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 px-6 py-10 text-center transition hover:border-[#126BFF]/40 hover:bg-white/[0.025]">
            <span className="text-sm font-medium text-white/70">
              Add photos or videos
            </span>

            <span className="mt-2 text-xs text-white/35">
              JPG, PNG, WEBP, GIF, MP4, WEBM or MOV
            </span>

            <span className="mt-1 text-xs text-white/25">
              Up to 20 files per post
            </span>

            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileSelection}
              className="hidden"
            />
          </label>
        </div>

        {selectedFiles.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-white/65">
                Selected media
              </p>

              <span className="text-xs text-white/35">
                {selectedFiles.length} / 20
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {selectedFiles.map(
                (item, index) => {
                  const isVideo =
                    item.file.type.startsWith(
                      "video/"
                    ) ||
                    item.file.name.match(
                      /\.(mp4|webm|mov)$/i
                    );

                  return (
                    <div
                      key={`${item.previewUrl}-${index}`}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
                    >
                      <div className="relative aspect-video overflow-hidden bg-black">
                        {isVideo ? (
                          <video
                            src={item.previewUrl}
                            className="h-full w-full object-cover"
                            controls
                          />
                        ) : (
                          <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            className="h-full w-full object-cover"
                          />
                        )}

                        {item.uploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                            <span className="text-xs text-white/70">
                              Uploading...
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-3">
                        <p className="truncate text-xs text-white/50">
                          {item.file.name}
                        </p>

                        {item.error && (
                          <p className="mt-2 text-xs text-red-300">
                            {item.error}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              moveSelectedFile(
                                index,
                                "up"
                              )
                            }
                            disabled={
                              index === 0 ||
                              saving
                            }
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/55 hover:bg-white/10 disabled:opacity-30"
                          >
                            ↑
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              moveSelectedFile(
                                index,
                                "down"
                              )
                            }
                            disabled={
                              index ===
                                selectedFiles.length -
                                  1 ||
                              saving
                            }
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/55 hover:bg-white/10 disabled:opacity-30"
                          >
                            ↓
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              removeSelectedFile(
                                index
                              )
                            }
                            disabled={saving}
                            className="rounded-lg border border-red-400/10 bg-red-400/5 px-3 py-1.5 text-xs text-red-300 hover:bg-red-400/10 disabled:opacity-30"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={
              saving ||
              selectedFiles.some(
                (item) => item.uploading
              )
            }
            className="rounded-full bg-[#126BFF] px-6 py-3 text-sm font-medium transition hover:bg-[#2477ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Update Post"
                : form.visibility === "PUBLISHED"
                  ? "Publish Post"
                  : "Save Draft"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="mt-10 border-t border-white/10 pt-8">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold">
            {adminUserId
              ? "User Posts"
              : "Your Posts"}
          </h3>

          <span className="text-xs text-white/35">
            {posts.length}{" "}
            {posts.length === 1
              ? "post"
              : "posts"}
          </span>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/40">
            Loading posts...
          </div>
        ) : posts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center">
            <p className="text-sm text-white/40">
              No posts have been created yet.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {posts.map((post) => (
              <article
                key={post.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
              >
                {post.media.length > 0 && (
                  <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-3">
                    {post.media
                      .slice(0, 6)
                      .map((postMedia) => {
                        const media =
                          postMedia.media;

                        const isVideo =
                          media.type === "VIDEO";

                        return (
                          <div
                            key={postMedia.id}
                            className="relative aspect-video overflow-hidden bg-black"
                          >
                            {isVideo ? (
                              <video
                                src={`/api/media/${media.id}`}
                                className="h-full w-full object-cover"
                                controls
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={`/api/media/${media.id}`}
                                alt={
                                  media.altText ||
                                  media.originalName
                                }
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}

                <div className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] ${
                            post.visibility ===
                            "PUBLISHED"
                              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                              : "border-white/10 bg-white/5 text-white/40"
                          }`}
                        >
                          {post.visibility}
                        </span>

                        {post.featured && (
                          <span className="rounded-full border border-[#D9A441]/20 bg-[#D9A441]/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-[#D9A441]">
                            Featured
                          </span>
                        )}
                      </div>

                      {post.caption && (
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/60">
                          {post.caption}
                        </p>
                      )}

                      <p className="mt-4 text-xs text-white/25">
                        {post.media.length}{" "}
                        {post.media.length === 1
                          ? "media file"
                          : "media files"}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          startEditing(post)
                        }
                        disabled={
                          actionId === post.id
                        }
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deletePost(post.id)
                        }
                        disabled={
                          actionId === post.id
                        }
                        className="rounded-xl border border-red-400/10 bg-red-400/5 px-4 py-2 text-xs text-red-300 transition hover:bg-red-400/10 disabled:opacity-30"
                      >
                        {actionId === post.id
                          ? "..."
                          : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}