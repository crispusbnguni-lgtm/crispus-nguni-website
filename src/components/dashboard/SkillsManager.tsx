"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Skill = {
  id: string;
  name: string;
  category: string | null;
  level: string | null;
  description: string | null;
  sortOrder: number;
};

async function fetchSkills(apiUrl: string): Promise<Skill[]> {
  const response = await fetch(apiUrl);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to load skills.");
  }

  return data.skills;
}

export function SkillsManager() {
  const searchParams = useSearchParams();
  const adminUserId = searchParams.get("adminUserId")?.trim() || "";

  const skillsApiUrl = adminUserId
    ? `/api/skills?adminUserId=${encodeURIComponent(adminUserId)}`
    : "/api/skills";

  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSkills() {
      try {
        const data = await fetchSkills(skillsApiUrl);

        if (!cancelled) {
          setSkills(data);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load skills."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSkills();

    return () => {
      cancelled = true;
    };
  }, [skillsApiUrl]);

  function resetForm() {
    setName("");
    setCategory("");
    setLevel("");
    setDescription("");
    setEditingId(null);
  }

  function handleEdit(skill: Skill) {
    setEditingId(skill.id);
    setName(skill.name);
    setCategory(skill.category || "");
    setLevel(skill.level || "");
    setDescription(skill.description || "");
    setMessage("");
  }

  function handleCancelEdit() {
    resetForm();
    setMessage("");
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setMessage("Skill name is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(skillsApiUrl, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingId,
          name: name.trim(),
          category,
          level,
          description,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            (editingId
              ? "Unable to update skill."
              : "Unable to add skill.")
        );
        return;
      }

      if (editingId) {
        setSkills((items) =>
          items.map((item) =>
            item.id === editingId ? data.skill : item
          )
        );

        setMessage("Skill updated successfully.");
      } else {
        setSkills((items) => [...items, data.skill]);
        setMessage("Skill added successfully.");
      }

      resetForm();
    } catch {
      setMessage(
        editingId
          ? "Something went wrong while updating the skill."
          : "Something went wrong while adding the skill."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleReorder(
    skillId: string,
    direction: "up" | "down"
  ) {
    setReorderingId(skillId);
    setMessage("");

    try {
      const response = await fetch(skillsApiUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: skillId,
          direction,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.message || "Unable to reorder skills.");
        return;
      }

      if (data.skills) {
        setSkills(data.skills);
      }

      setMessage("Skill order updated successfully.");
    } catch {
      setMessage("Something went wrong while reordering skills.");
    } finally {
      setReorderingId(null);
    }
  }

  async function handleDelete(skillId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this skill?"
    );

    if (!confirmed) return;

    setDeletingId(skillId);
    setMessage("");

    try {
      const response = await fetch(skillsApiUrl, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: skillId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.message || "Unable to delete skill.");
        return;
      }

      setSkills((items) =>
        items.filter((item) => item.id !== skillId)
      );

      if (editingId === skillId) {
        resetForm();
      }

      setMessage("Skill deleted successfully.");
    } catch {
      setMessage("Something went wrong while deleting the skill.");
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
            Skills
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-white">
            {adminUserId
              ? "Manage User Skills"
              : "Manage Your Skills"}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Add your professional skills, capabilities and areas of
            expertise to showcase your strengths.
          </p>
        </div>

        <span className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/60">
          {skills.length} {skills.length === 1 ? "skill" : "skills"}
        </span>
      </div>

      {adminUserId && (
        <div className="liquid-glass mt-6 rounded-2xl p-4">
          <p className="text-sm font-semibold text-[#D9A441]">
            Super Admin Mode
          </p>

          <p className="mt-1 text-xs leading-5 text-white/55">
            You are managing the skills of the selected user.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8">
        {editingId && (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#D9A441]/25 bg-[#D9A441]/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#D9A441]">
                Editing Skill
              </p>

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
            <label
              htmlFor="skill-name"
              className="mb-2 block text-sm text-white/70"
            >
              Skill Name
            </label>

            <input
              id="skill-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Financial Analysis"
              required
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="skill-category"
              className="mb-2 block text-sm text-white/70"
            >
              Category
            </label>

            <input
              id="skill-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Finance"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="skill-level"
              className="mb-2 block text-sm text-white/70"
            >
              Proficiency
            </label>

            <select
              id="skill-level"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              className={inputClass}
            >
              <option value="" className="bg-[#10131B]">
                Select proficiency
              </option>
              <option value="Beginner" className="bg-[#10131B]">
                Beginner
              </option>
              <option value="Intermediate" className="bg-[#10131B]">
                Intermediate
              </option>
              <option value="Advanced" className="bg-[#10131B]">
                Advanced
              </option>
              <option value="Expert" className="bg-[#10131B]">
                Expert
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="skill-description"
              className="mb-2 block text-sm text-white/70"
            >
              Short Description
            </label>

            <input
              id="skill-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Turning financial data into useful insights."
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={
              saving ||
              reorderingId !== null ||
              deletingId !== null
            }
            className={buttonClass}
          >
            {saving
              ? editingId
                ? "Saving..."
                : "Adding..."
              : editingId
                ? "Save Changes"
                : "Add Skill"}
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
              Expertise
            </p>

            <h3 className="mt-2 text-lg font-semibold text-white">
              Professional Skills
            </h3>
          </div>

          <p className="text-xs text-white/45">
            {loading ? "Loading records..." : `${skills.length} saved`}
          </p>
        </div>

        {loading ? (
          <div className="mt-5 space-y-3">
            <div className="liquid-glass h-24 animate-pulse rounded-2xl" />
            <div className="liquid-glass h-24 animate-pulse rounded-2xl" />
          </div>
        ) : skills.length === 0 ? (
          <div className="liquid-glass mt-5 rounded-2xl border-dashed p-8 text-center">
            <p className="text-sm font-medium text-white/75">
              No skills added yet
            </p>

            <p className="mt-2 text-sm leading-6 text-white/45">
              Add your areas of expertise to build a stronger
              professional portfolio.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {skills.map((skill, index) => {
              const isFirst = index === 0;
              const isLast = index === skills.length - 1;
              const isReordering = reorderingId === skill.id;

              return (
                <article
                  key={skill.id}
                  className="liquid-glass rounded-2xl p-5 sm:p-6"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold text-white">
                          {skill.name}
                        </h4>

                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-white/50">
                          Skill {index + 1}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {skill.category && (
                          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/55">
                            {skill.category}
                          </span>
                        )}

                        {skill.level && (
                          <span className="rounded-full border border-[#D9A441]/25 bg-[#D9A441]/[0.07] px-3 py-1.5 text-xs text-[#D9A441]">
                            {skill.level}
                          </span>
                        )}
                      </div>

                      {skill.description && (
                        <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-7 text-white/60">
                          {skill.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <button
                        type="button"
                        onClick={() => handleReorder(skill.id, "up")}
                        disabled={
                          isFirst ||
                          isReordering ||
                          saving ||
                          deletingId !== null
                        }
                        aria-label={`Move ${skill.name} up`}
                        className="liquid-glass-button px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        ↑ Up
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReorder(skill.id, "down")}
                        disabled={
                          isLast ||
                          isReordering ||
                          saving ||
                          deletingId !== null
                        }
                        aria-label={`Move ${skill.name} down`}
                        className="liquid-glass-button px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        ↓ Down
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEdit(skill)}
                        disabled={
                          isReordering ||
                          deletingId === skill.id ||
                          saving
                        }
                        className="liquid-glass-button px-4 py-2 text-sm text-[#D9A441] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(skill.id)}
                        disabled={
                          isReordering ||
                          deletingId === skill.id ||
                          saving
                        }
                        className="liquid-glass-button border-red-400/20 px-4 py-2 text-sm text-red-300 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {deletingId === skill.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>

                  {isReordering && (
                    <p className="mt-4 text-xs text-white/50">
                      Updating skill order...
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
