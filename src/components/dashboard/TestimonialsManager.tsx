"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MediaUploadField } from "@/components/dashboard/MediaUploadField";

type Testimonial = {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  message: string;
  image: string | null;
  rating: number | null;
  featured: boolean;
  sortOrder: number;
};

const emptyForm = {
  name: "",
  role: "",
  company: "",
  message: "",
  image: "",
  rating: "",
  featured: false,
};

export function TestimonialsManager() {
  const searchParams = useSearchParams();

  const adminUserId =
    searchParams.get("adminUserId")?.trim() || "";

  const testimonialsApiUrl = adminUserId
    ? `/api/testimonials?adminUserId=${encodeURIComponent(
        adminUserId
      )}`
    : "/api/testimonials";

  const [testimonials, setTestimonials] = useState<
    Testimonial[]
  >([]);
  const [form, setForm] = useState(emptyForm);
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

    fetch(testimonialsApiUrl)
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load testimonials."
          );
        }

        return data.testimonials as Testimonial[];
      })
      .then((data) => {
        if (!cancelled) {
          setTestimonials(data);
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
  }, [testimonialsApiUrl]);

  function updateField(
    field: keyof typeof emptyForm,
    value: string | boolean
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEditing(testimonial: Testimonial) {
    setEditingId(testimonial.id);

    setForm({
      name: testimonial.name,
      role: testimonial.role || "",
      company: testimonial.company || "",
      message: testimonial.message,
      image: testimonial.image || "",
      rating:
        testimonial.rating !== null
          ? String(testimonial.rating)
          : "",
      featured: testimonial.featured,
    });

    setMessage("");
  }

  async function saveTestimonial(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(testimonialsApiUrl, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingId,
          ...form,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message || "Unable to save testimonial."
        );
        return;
      }

      if (editingId) {
        setTestimonials((current) =>
          current.map((testimonial) =>
            testimonial.id === editingId
              ? data.testimonial
              : testimonial
          )
        );
      } else {
        setTestimonials((current) => [
          ...current,
          data.testimonial,
        ]);
      }

      setMessage(
        data.message || "Testimonial saved successfully."
      );

      resetForm();
    } catch {
      setMessage("Unable to save testimonial.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTestimonial(id: string) {
    if (!window.confirm("Delete this testimonial?")) {
      return;
    }

    setActionId(id);
    setMessage("");

    try {
      const response = await fetch(testimonialsApiUrl, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message || "Unable to delete testimonial."
        );
        return;
      }

      setTestimonials((current) =>
        current.filter(
          (testimonial) => testimonial.id !== id
        )
      );

      if (editingId === id) {
        resetForm();
      }

      setMessage(
        data.message || "Testimonial deleted successfully."
      );
    } catch {
      setMessage("Unable to delete testimonial.");
    } finally {
      setActionId(null);
    }
  }

  async function moveTestimonial(
    id: string,
    direction: "up" | "down"
  ) {
    setActionId(id);
    setMessage("");

    try {
      const response = await fetch(testimonialsApiUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          direction,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            "Unable to reorder testimonials."
        );
        return;
      }

      if (data.testimonials) {
        setTestimonials(data.testimonials);
      }

      setMessage(
        data.message || "Testimonial order updated."
      );
    } catch {
      setMessage("Unable to reorder testimonials.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <section className="mt-8 liquid-glass rounded-3xl p-6 shadow-2xl sm:p-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-[#D9A441]">
          Social Proof
        </p>

        <h2 className="mt-3 text-2xl font-semibold">
          {adminUserId
            ? "Manage User Testimonials"
            : "Testimonials"}
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
          Add testimonials from clients, colleagues, employers
          or people you have worked with.
        </p>
      </div>

      {adminUserId && (
        <div className="mt-6 rounded-2xl border border-[#D9A441]/20 bg-[#D9A441]/5 p-4">
          <p className="text-sm font-medium text-[#D9A441]">
            Super Admin Mode
          </p>

          <p className="mt-1 text-xs leading-5 text-white/40">
            You are managing the testimonials of the selected user.
          </p>
        </div>
      )}

      {message && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
          {message}
        </div>
      )}

      <form
        onSubmit={saveTestimonial}
        className="mt-8 space-y-5"
      >
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label className="text-sm text-white/60">
              Name
            </label>

            <input
              type="text"
              value={form.name}
              onChange={(event) =>
                updateField(
                  "name",
                  event.target.value
                )
              }
              placeholder="Client name"
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#126BFF]/50"
            />
          </div>

          <div>
            <label className="text-sm text-white/60">
              Role / Title
            </label>

            <input
              type="text"
              value={form.role}
              onChange={(event) =>
                updateField(
                  "role",
                  event.target.value
                )
              }
              placeholder="e.g. CEO, Client, Manager"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#126BFF]/50"
            />
          </div>

          <div>
            <label className="text-sm text-white/60">
              Company
            </label>

            <input
              type="text"
              value={form.company}
              onChange={(event) =>
                updateField(
                  "company",
                  event.target.value
                )
              }
              placeholder="Company or organisation"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#126BFF]/50"
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-white/60">
            Testimonial
          </label>

          <textarea
            value={form.message}
            onChange={(event) =>
              updateField(
                "message",
                event.target.value
              )
            }
            placeholder="What did this person say about your work?"
            rows={5}
            required
            className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-white/25 focus:border-[#126BFF]/50"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <MediaUploadField
            label="Testimonial Photo"
            value={form.image}
            onChange={(value) =>
              updateField("image", value)
            }
            altText={
              form.name
                ? `${form.name} testimonial photo`
                : "Testimonial photo"
            }
            helpText="Upload a professional photo of the person giving the testimonial."
          />

          <div>
            <label className="text-sm text-white/60">
              Rating
            </label>

            <select
              value={form.rating}
              onChange={(event) =>
                updateField(
                  "rating",
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#126BFF]/50"
            >
              <option value="">No rating</option>
              <option value="5">5 / 5</option>
              <option value="4">4 / 5</option>
              <option value="3">3 / 5</option>
              <option value="2">2 / 5</option>
              <option value="1">1 / 5</option>
            </select>
          </div>
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
              Featured Testimonial
            </span>

            <span className="mt-1 block text-xs text-white/35">
              Give this testimonial more visual prominence.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#126BFF] px-6 py-3 text-sm font-medium transition hover:bg-[#2477ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Update Testimonial"
                : "Add Testimonial"}
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
              ? "User Testimonials"
              : "Your Testimonials"}
          </h3>

          <span className="text-xs text-white/35">
            {testimonials.length}{" "}
            {testimonials.length === 1
              ? "testimonial"
              : "testimonials"}
          </span>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/40">
            Loading testimonials...
          </div>
        ) : testimonials.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center">
            <p className="text-sm text-white/40">
              No testimonials have been added yet.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {testimonials.map((testimonial, index) => (
              <article
                key={testimonial.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-5"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    {testimonial.image ? (
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl">
                        <Image
                          src={testimonial.image}
                          alt={testimonial.name}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#126BFF]/10 text-lg text-[#126BFF]">
                        {testimonial.name
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold">
                          {testimonial.name}
                        </h4>

                        {testimonial.featured && (
                          <span className="rounded-full border border-[#D9A441]/20 bg-[#D9A441]/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-[#D9A441]">
                            Featured
                          </span>
                        )}
                      </div>

                      {(testimonial.role ||
                        testimonial.company) && (
                        <p className="mt-1 text-xs text-white/35">
                          {testimonial.role}

                          {testimonial.role &&
                            testimonial.company
                            ? " · "
                            : ""}

                          {testimonial.company}
                        </p>
                      )}

                      {testimonial.rating && (
                        <p className="mt-2 text-sm tracking-wider text-[#D9A441]">
                          {"★".repeat(
                            testimonial.rating
                          )}

                          <span className="text-white/15">
                            {"★".repeat(
                              5 - testimonial.rating
                            )}
                          </span>
                        </p>
                      )}

                      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
                        {testimonial.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        moveTestimonial(
                          testimonial.id,
                          "up"
                        )
                      }
                      disabled={
                        index === 0 ||
                        actionId === testimonial.id
                      }
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        moveTestimonial(
                          testimonial.id,
                          "down"
                        )
                      }
                      disabled={
                        index ===
                          testimonials.length - 1 ||
                        actionId === testimonial.id
                      }
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        startEditing(testimonial)
                      }
                      disabled={
                        actionId === testimonial.id
                      }
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteTestimonial(
                          testimonial.id
                        )
                      }
                      disabled={
                        actionId === testimonial.id
                      }
                      className="rounded-xl border border-red-400/10 bg-red-400/5 px-4 py-2 text-xs text-red-300 transition hover:bg-red-400/10 disabled:opacity-30"
                    >
                      {actionId === testimonial.id
                        ? "..."
                        : "Delete"}
                    </button>
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