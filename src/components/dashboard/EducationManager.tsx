"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Education = {
  id: string;
  institution: string;
  degree: string;
  field: string | null;
  location: string | null;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string | null;
  sortOrder: number;
};

type EducationForm = {
  institution: string;
  degree: string;
  field: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
};

const emptyForm: EducationForm = {
  institution: "",
  degree: "",
  field: "",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  description: "",
};

function formatDate(date: string | null) {
  if (!date) {
    return "Present";
  }

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function toInputDate(date: string | null) {
  if (!date) {
    return "";
  }

  return new Date(date).toISOString().slice(0, 10);
}

export function EducationManager() {
  const searchParams = useSearchParams();

  const adminUserId =
    searchParams.get("adminUserId")?.trim() || "";

  const educationApiUrl = adminUserId
    ? `/api/education?adminUserId=${encodeURIComponent(adminUserId)}`
    : "/api/education";

  const [education, setEducation] = useState<Education[]>([]);
  const [form, setForm] = useState<EducationForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadEducation(apiUrl: string) {
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Unable to load education.");
        return;
      }

      setEducation(data.education || []);
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetch(educationApiUrl)
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load education."
          );
        }

        return data.education || [];
      })
      .then((data: Education[]) => {
        if (!cancelled) {
          setEducation(data);
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
  }, [educationApiUrl]);

  function updateField(
    field: keyof EducationForm,
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

  function startEditing(item: Education) {
    setEditingId(item.id);

    setForm({
      institution: item.institution,
      degree: item.degree,
      field: item.field ?? "",
      location: item.location ?? "",
      startDate: toInputDate(item.startDate),
      endDate: toInputDate(item.endDate),
      current: item.current,
      description: item.description ?? "",
    });

    setMessage("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(educationApiUrl, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          editingId
            ? {
                id: editingId,
                ...form,
              }
            : form
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Unable to save education.");
        return;
      }

      resetForm();
      await loadEducation(educationApiUrl);

      setMessage(
        editingId
          ? "Education updated successfully."
          : "Education added successfully."
      );
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEducation(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this education record?"
    );

    if (!confirmed) {
      return;
    }

    setMessage("");

    try {
      const response = await fetch(educationApiUrl, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Unable to delete education.");
        return;
      }

      await loadEducation(educationApiUrl);
      setMessage("Education deleted successfully.");
    } catch {
      setMessage("Unable to connect to the server.");
    }
  }

  async function moveEducation(
    id: string,
    direction: "up" | "down"
  ) {
    const index = education.findIndex(
      (item) => item.id === id
    );

    if (index === -1) {
      return;
    }

    const targetIndex =
      direction === "up" ? index - 1 : index + 1;

    if (
      targetIndex < 0 ||
      targetIndex >= education.length
    ) {
      return;
    }

    const reordered = [...education];

    [reordered[index], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[index],
    ];

    setEducation(reordered);

    try {
      await Promise.all(
        reordered.map((item, itemIndex) =>
          fetch(educationApiUrl, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: item.id,
              sortOrder: itemIndex,
            }),
          })
        )
      );
    } catch {
      setMessage("Unable to save education order.");
      await loadEducation(educationApiUrl);
    }
  }

  if (loading) {
    return (
      <section className="liquid-glass rounded-3xl p-6 sm:p-8">
        <div className="liquid-glass h-4 w-24 animate-pulse rounded" />
        <div className="liquid-glass mt-3 h-7 w-52 animate-pulse rounded" />
        <div className="liquid-glass mt-6 h-20 animate-pulse rounded-2xl" />
      </section>
    );
  }

  return (
    <section className="liquid-glass rounded-3xl p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#D9A441]">
            Qualifications
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            {adminUserId
              ? "Manage User Education"
              : "Education"}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
            Add academic qualifications, institutions and educational
            achievements to your professional portfolio.
          </p>
        </div>

        <div className="liquid-glass rounded-full px-3 py-1.5 text-xs text-white/60">
          {education.length}{" "}
          {education.length === 1 ? "record" : "records"}
        </div>
      </div>

      {adminUserId && (
        <div className="liquid-glass mt-6 rounded-2xl p-4">
          <p className="text-sm font-medium text-[#D9A441]">
            Super Admin Mode
          </p>

          <p className="mt-1 text-xs leading-5 text-white/40">
            You are managing the education records of the selected user.
          </p>
        </div>
      )}

      {message && (
        <div
          className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
            message.includes("successfully")
              ? "border-[#00C98B]/20 bg-[#00C98B]/5 text-[#00C98B]"
              : "border-red-400/20 bg-red-400/5 text-red-300"
          }`}
        >
          {message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="liquid-glass mt-8 rounded-2xl p-5 sm:p-6"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">
              {editingId ? "Edit Education" : "Add Education"}
            </h3>

            <p className="mt-1 text-xs text-white/35">
              Keep your academic history clear and professional.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="liquid-glass-button rounded-lg px-3 py-2 text-xs text-white/70 hover:text-white"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-white/60">
              Institution
            </label>

            <input
              value={form.institution}
              onChange={(event) =>
                updateField(
                  "institution",
                  event.target.value
                )
              }
              required
              className="liquid-glass w-full rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#D9A441]/60"
              placeholder="University or institution"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/60">
              Degree / Qualification
            </label>

            <input
              value={form.degree}
              onChange={(event) =>
                updateField(
                  "degree",
                  event.target.value
                )
              }
              required
              className="liquid-glass w-full rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#D9A441]/60"
              placeholder="Bachelor's Degree"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/60">
              Field of Study
            </label>

            <input
              value={form.field}
              onChange={(event) =>
                updateField(
                  "field",
                  event.target.value
                )
              }
              className="liquid-glass w-full rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#D9A441]/60"
              placeholder="Actuarial Science"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/60">
              Location
            </label>

            <input
              value={form.location}
              onChange={(event) =>
                updateField(
                  "location",
                  event.target.value
                )
              }
              className="liquid-glass w-full rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#D9A441]/60"
              placeholder="Eldoret, Kenya"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/60">
              Start Date
            </label>

            <input
              type="date"
              value={form.startDate}
              onChange={(event) =>
                updateField(
                  "startDate",
                  event.target.value
                )
              }
              required
              className="liquid-glass w-full rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#D9A441]/60"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/60">
              End Date
            </label>

            <input
              type="date"
              value={form.endDate}
              onChange={(event) =>
                updateField(
                  "endDate",
                  event.target.value
                )
              }
              disabled={form.current}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition disabled:cursor-not-allowed disabled:opacity-40 focus:border-[#126BFF]/60"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="liquid-glass flex cursor-pointer items-center gap-3 rounded-xl p-3">
              <input
                type="checkbox"
                checked={form.current}
                onChange={(event) =>
                  updateField(
                    "current",
                    event.target.checked
                  )
                }
                className="h-4 w-4 rounded border-white/20 bg-black/20 accent-[#126BFF]"
              />

              <span className="text-sm text-white/60">
                I am currently studying here
              </span>
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm text-white/60">
              Description
            </label>

            <textarea
              value={form.description}
              onChange={(event) =>
                updateField(
                  "description",
                  event.target.value
                )
              }
              rows={4}
              className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/20 focus:border-[#126BFF]/60"
              placeholder="Relevant achievements, coursework or highlights..."
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="liquid-glass-button mt-6 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : editingId
              ? "Update Education"
              : "Add Education"}
        </button>
      </form>

      <div className="mt-8 space-y-4">
        {education.length === 0 ? (
          <div className="liquid-glass rounded-2xl border-dashed p-8 text-center">
            <p className="text-sm text-white/35">
              No education records have been added yet.
            </p>
          </div>
        ) : (
          education.map((item, index) => (
            <article
              key={item.id}
              className="liquid-glass rounded-2xl p-5 transition hover:-translate-y-0.5"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[#D9A441]">
                    {item.degree}
                  </p>

                  <h3 className="mt-2 text-lg font-semibold">
                    {item.institution}
                  </h3>

                  {item.field && (
                    <p className="mt-1 text-sm text-[#D9A441]">
                      {item.field}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="liquid-glass rounded-full px-3 py-1.5 text-xs text-white/60">
                      {formatDate(item.startDate)} —{" "}
                      {item.current
                        ? "Present"
                        : formatDate(item.endDate)}
                    </span>

                    {item.location && (
                      <span className="liquid-glass rounded-full px-3 py-1.5 text-xs text-white/60">
                        {item.location}
                      </span>
                    )}

                    {item.current && (
                      <span className="rounded-full border border-[#00C98B]/20 bg-[#00C98B]/5 px-3 py-1.5 text-xs text-[#00C98B]">
                        Current
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="mt-4 text-sm leading-6 text-white/40">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      moveEducation(item.id, "up")
                    }
                    disabled={index === 0}
                    className="liquid-glass-button rounded-lg px-3 py-2 text-xs text-white/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                    aria-label="Move education up"
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      moveEducation(item.id, "down")
                    }
                    disabled={
                      index === education.length - 1
                    }
                    className="liquid-glass-button rounded-lg px-3 py-2 text-xs text-white/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                    aria-label="Move education down"
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      startEditing(item)
                    }
                    className="liquid-glass-button rounded-lg px-3 py-2 text-xs text-[#D9A441] hover:text-white"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      deleteEducation(item.id)
                    }
                    className="liquid-glass-button rounded-lg px-3 py-2 text-xs text-red-300 hover:border-red-300/40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}