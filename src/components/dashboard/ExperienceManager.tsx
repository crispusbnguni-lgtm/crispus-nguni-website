 "use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Experience = {
  id: string;
  jobTitle: string;
  company: string;
  employmentType: string | null;
  location: string | null;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string | null;
  sortOrder: number;
};

async function fetchExperience(apiUrl: string): Promise<Experience[]> {
  const response = await fetch(apiUrl);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to load experience.");
  }

  return data.experiences;
}

function formatDate(date: string | null) {
  if (!date) return "Present";

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function ExperienceManager() {
  const searchParams = useSearchParams();
  const adminUserId = searchParams.get("adminUserId")?.trim() || "";

  const experienceApiUrl = adminUserId
    ? `/api/experience?adminUserId=${encodeURIComponent(adminUserId)}`
    : "/api/experience";

  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [current, setCurrent] = useState(false);
  const [description, setDescription] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetchExperience(experienceApiUrl)
      .then((data) => {
        if (!cancelled) {
          setExperiences(data);
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
  }, [experienceApiUrl]);

  function resetForm() {
    setJobTitle("");
    setCompany("");
    setEmploymentType("");
    setLocation("");
    setStartDate("");
    setEndDate("");
    setCurrent(false);
    setDescription("");
    setEditingId(null);
  }

  function handleEdit(experience: Experience) {
    setEditingId(experience.id);
    setJobTitle(experience.jobTitle);
    setCompany(experience.company);
    setEmploymentType(experience.employmentType || "");
    setLocation(experience.location || "");
    setStartDate(experience.startDate.slice(0, 10));
    setEndDate(experience.endDate ? experience.endDate.slice(0, 10) : "");
    setCurrent(experience.current);
    setDescription(experience.description || "");
    setMessage("");
  }

  function handleCancelEdit() {
    resetForm();
    setMessage("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!jobTitle.trim() || !company.trim() || !startDate) {
      setMessage("Job title, company and start date are required.");
      return;
    }

    if (!current && endDate && endDate < startDate) {
      setMessage("End date cannot be before the start date.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(experienceApiUrl, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          jobTitle,
          company,
          employmentType,
          location,
          startDate,
          endDate: current ? "" : endDate,
          current,
          description,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            (editingId
              ? "Unable to update experience."
              : "Unable to add experience.")
        );
        return;
      }

      if (editingId) {
        setExperiences((items) =>
          items.map((item) => (item.id === editingId ? data.experience : item))
        );
        setMessage("Experience updated successfully.");
      } else {
        setExperiences((items) => [...items, data.experience]);
        setMessage("Experience added successfully.");
      }

      resetForm();
    } catch {
      setMessage(
        editingId
          ? "Something went wrong while updating experience."
          : "Something went wrong while adding experience."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleReorder(experienceId: string, direction: "up" | "down") {
    setReorderingId(experienceId);
    setMessage("");

    try {
      const response = await fetch(experienceApiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: experienceId, direction }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.message || "Unable to reorder experience.");
        return;
      }

      if (data.experiences) setExperiences(data.experiences);
      setMessage("Experience order updated successfully.");
    } catch {
      setMessage("Something went wrong while reordering experience.");
    } finally {
      setReorderingId(null);
    }
  }

  async function handleDelete(experienceId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this experience?"
    );

    if (!confirmed) return;

    setDeletingId(experienceId);
    setMessage("");

    try {
      const response = await fetch(experienceApiUrl, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: experienceId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.message || "Unable to delete experience.");
        return;
      }

      setExperiences((items) =>
        items.filter((item) => item.id !== experienceId)
      );

      if (editingId === experienceId) resetForm();

      setMessage("Experience deleted successfully.");
    } catch {
      setMessage("Something went wrong while deleting experience.");
    } finally {
      setDeletingId(null);
    }
  }

  const inputClass =
    "w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#D9A441]/60 focus:bg-white/[0.06]";

  const buttonClass =
    "liquid-glass-button inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <section className="liquid-glass mt-8 rounded-3xl p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#D9A441]">
            Experience
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-white">
            {adminUserId ? "Manage User Experience" : "Manage Your Experience"}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Add your professional experience, employment history and career journey.
          </p>
        </div>

        <span className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/60">
          {experiences.length} {experiences.length === 1 ? "position" : "positions"}
        </span>
      </div>

      {adminUserId && (
        <div className="liquid-glass mt-6 rounded-2xl p-4">
          <p className="text-sm font-semibold text-[#D9A441]">Super Admin Mode</p>
          <p className="mt-1 text-xs leading-5 text-white/55">
            You are managing the selected user&apos;s professional experience.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8">
        {editingId && (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#D9A441]/25 bg-[#D9A441]/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#D9A441]">Editing Experience</p>
              <p className="mt-1 text-xs text-white/55">
                Update the fields below and save your changes.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancelEdit}
              className={buttonClass}
            >
              Cancel Edit
            </button>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="experience-job-title" className="mb-2 block text-sm text-white/70">
              Job Title
            </label>
            <input
              id="experience-job-title"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              placeholder="Financial Advisor"
              required
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="experience-company" className="mb-2 block text-sm text-white/70">
              Company / Organization
            </label>
            <input
              id="experience-company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Britam"
              required
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="experience-type" className="mb-2 block text-sm text-white/70">
              Employment Type
            </label>
            <select
              id="experience-type"
              value={employmentType}
              onChange={(event) => setEmploymentType(event.target.value)}
              className={inputClass}
            >
              <option value="" className="bg-[#10131B]">Select employment type</option>
              <option value="Full-time" className="bg-[#10131B]">Full-time</option>
              <option value="Part-time" className="bg-[#10131B]">Part-time</option>
              <option value="Contract" className="bg-[#10131B]">Contract</option>
              <option value="Freelance" className="bg-[#10131B]">Freelance</option>
              <option value="Internship" className="bg-[#10131B]">Internship</option>
              <option value="Volunteer" className="bg-[#10131B]">Volunteer</option>
            </select>
          </div>

          <div>
            <label htmlFor="experience-location" className="mb-2 block text-sm text-white/70">
              Location
            </label>
            <input
              id="experience-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Nairobi, Kenya"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="experience-start-date" className="mb-2 block text-sm text-white/70">
              Start Date
            </label>
            <input
              id="experience-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="experience-end-date" className="mb-2 block text-sm text-white/70">
              End Date
            </label>
            <input
              id="experience-end-date"
              type="date"
              value={endDate}
              disabled={current}
              onChange={(event) => setEndDate(event.target.value)}
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-40`}
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <input
                type="checkbox"
                checked={current}
                onChange={(event) => {
                  setCurrent(event.target.checked);
                  if (event.target.checked) setEndDate("");
                }}
                className="h-4 w-4 rounded border-white/20 bg-black/20 accent-[#D9A441]"
              />
              <span className="text-sm text-white/70">I currently work here</span>
            </label>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="experience-description" className="mb-2 block text-sm text-white/70">
              Description
            </label>
            <textarea
              id="experience-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe your responsibilities, achievements and contributions."
              rows={5}
              className={`${inputClass} resize-none leading-6`}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving || reorderingId !== null || deletingId !== null}
            className={buttonClass}
          >
            {saving
              ? editingId
                ? "Saving..."
                : "Adding..."
              : editingId
                ? "Save Changes"
                : "Add Experience"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={saving}
              className={buttonClass}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {message && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
            message.toLowerCase().includes("successfully")
              ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
              : "border-white/10 bg-white/[0.04] text-white/70"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mt-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
              Career history
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              Professional Experience
            </h3>
          </div>
          <p className="text-xs text-white/45">
            {loading ? "Loading records..." : `${experiences.length} saved`}
          </p>
        </div>

        {loading ? (
          <div className="mt-5 space-y-3">
            <div className="liquid-glass h-24 animate-pulse rounded-2xl" />
            <div className="liquid-glass h-24 animate-pulse rounded-2xl" />
          </div>
        ) : experiences.length === 0 ? (
          <div className="liquid-glass mt-5 rounded-2xl border-dashed p-8 text-center">
            <p className="text-sm font-medium text-white/75">No experience added yet</p>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Add your current role and previous positions to build your professional story.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {experiences.map((experience, index) => {
              const isFirst = index === 0;
              const isLast = index === experiences.length - 1;
              const isReordering = reorderingId === experience.id;

              return (
                <article
                  key={experience.id}
                  className="liquid-glass rounded-2xl p-5 sm:p-6"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold text-white">
                          {experience.jobTitle}
                        </h4>
                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-white/50">
                          Position {index + 1}
                        </span>
                        {experience.current && (
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                            Current
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm font-medium text-[#D9A441]">
                        {experience.company}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/50">
                        {experience.employmentType && <span>{experience.employmentType}</span>}
                        {experience.location && <span>{experience.location}</span>}
                        <span>
                          {formatDate(experience.startDate)} —{" "}
                          {experience.current ? "Present" : formatDate(experience.endDate)}
                        </span>
                      </div>

                      {experience.description && (
                        <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-7 text-white/60">
                          {experience.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <button
                        type="button"
                        onClick={() => handleReorder(experience.id, "up")}
                        disabled={isFirst || isReordering || saving || deletingId !== null}
                        aria-label={`Move ${experience.jobTitle} up`}
                        className="liquid-glass-button px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        ↑ Up
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReorder(experience.id, "down")}
                        disabled={isLast || isReordering || saving || deletingId !== null}
                        aria-label={`Move ${experience.jobTitle} down`}
                        className="liquid-glass-button px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        ↓ Down
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(experience)}
                        disabled={isReordering || deletingId === experience.id || saving}
                        className="liquid-glass-button px-4 py-2 text-sm text-[#D9A441] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(experience.id)}
                        disabled={isReordering || deletingId === experience.id || saving}
                        className="liquid-glass-button border-red-400/20 px-4 py-2 text-sm text-red-300 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {deletingId === experience.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>

                  {isReordering && (
                    <p className="mt-4 text-xs text-white/50">
                      Updating experience order...
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
