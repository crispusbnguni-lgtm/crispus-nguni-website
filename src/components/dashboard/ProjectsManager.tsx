"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MediaUploadField } from "@/components/dashboard/MediaUploadField";

type Project = {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  link: string | null;
  category: string | null;
  technologies: string | null;
  featured: boolean;
  sortOrder: number;
};

const emptyForm = {
  title: "",
  description: "",
  image: "",
  link: "",
  category: "",
  technologies: "",
  featured: false,
};

export function ProjectsManager() {
  const searchParams = useSearchParams();

  const adminUserId =
    searchParams.get("adminUserId")?.trim() || "";

  const projectsApiUrl = adminUserId
    ? `/api/projects?adminUserId=${encodeURIComponent(adminUserId)}`
    : "/api/projects";

  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch(projectsApiUrl)
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load projects."
          );
        }

        return data.projects as Project[];
      })
      .then((data) => {
        if (!cancelled) {
          setProjects(data);
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
  }, [projectsApiUrl]);

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

  function startEditing(project: Project) {
    setEditingId(project.id);

    setForm({
      title: project.title,
      description: project.description || "",
      image: project.image || "",
      link: project.link || "",
      category: project.category || "",
      technologies: project.technologies || "",
      featured: project.featured,
    });

    setMessage("");
  }

  async function saveProject(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(projectsApiUrl, {
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
          data.message || "Unable to save project."
        );
        return;
      }

      if (editingId) {
        setProjects((current) =>
          current.map((project) =>
            project.id === editingId
              ? data.project
              : project
          )
        );
      } else {
        setProjects((current) => [
          ...current,
          data.project,
        ]);
      }

      setMessage(
        data.message || "Project saved successfully."
      );

      resetForm();
    } catch {
      setMessage("Unable to save project.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(id: string) {
    if (!window.confirm("Delete this project?")) {
      return;
    }

    setActionId(id);
    setMessage("");

    try {
      const response = await fetch(projectsApiUrl, {
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
          data.message || "Unable to delete project."
        );
        return;
      }

      setProjects((current) =>
        current.filter((project) => project.id !== id)
      );

      if (editingId === id) {
        resetForm();
      }

      setMessage(
        data.message || "Project deleted successfully."
      );
    } catch {
      setMessage("Unable to delete project.");
    } finally {
      setActionId(null);
    }
  }

  async function moveProject(
    id: string,
    direction: "up" | "down"
  ) {
    setActionId(id);
    setMessage("");

    try {
      const response = await fetch(projectsApiUrl, {
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
          data.message || "Unable to reorder projects."
        );
        return;
      }

      if (data.projects) {
        setProjects(data.projects);
      }

      setMessage(
        data.message || "Project order updated."
      );
    } catch {
      setMessage("Unable to reorder projects.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <section className="mt-8 liquid-glass rounded-3xl p-6 shadow-2xl sm:p-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-[#D9A441]">
          Portfolio Projects
        </p>

        <h2 className="mt-3 text-2xl font-semibold">
          {adminUserId
            ? "Manage User Projects"
            : "Projects & Work"}
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
          Showcase important projects, professional work, case studies
          and achievements on your portfolio.
        </p>
      </div>

      {adminUserId && (
        <div className="mt-6 rounded-2xl border border-[#D9A441]/20 bg-[#D9A441]/5 p-4">
          <p className="text-sm font-medium text-[#D9A441]">
            Super Admin Mode
          </p>

          <p className="mt-1 text-xs leading-5 text-white/40">
            You are managing the projects of the selected user.
          </p>
        </div>
      )}

      {message && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
          {message}
        </div>
      )}

      <form
        onSubmit={saveProject}
        className="mt-8 space-y-5"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="text-sm text-white/60">
              Project Title
            </label>

            <input
              type="text"
              value={form.title}
              onChange={(event) =>
                updateField(
                  "title",
                  event.target.value
                )
              }
              placeholder="e.g. Financial Education Platform"
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#126BFF]/50"
            />
          </div>

          <div>
            <label className="text-sm text-white/60">
              Category
            </label>

            <input
              type="text"
              value={form.category}
              onChange={(event) =>
                updateField(
                  "category",
                  event.target.value
                )
              }
              placeholder="e.g. Finance, Technology, Design"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#126BFF]/50"
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-white/60">
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
            placeholder="Describe the project, your role and the outcome."
            rows={4}
            className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-[#126BFF]/50"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <MediaUploadField
            label="Project Image"
            value={form.image}
            onChange={(value) =>
              updateField("image", value)
            }
            altText={
              form.title
                ? `${form.title} project image`
                : "Project image"
            }
            helpText="Upload a professional image representing this project. The image will be securely stored and used on the public portfolio."
          />

          <div>
            <label className="text-sm text-white/60">
              Project Link
            </label>

            <input
              type="url"
              value={form.link}
              onChange={(event) =>
                updateField(
                  "link",
                  event.target.value
                )
              }
              placeholder="https://..."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#126BFF]/50"
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-white/60">
            Technologies
          </label>

          <input
            type="text"
            value={form.technologies}
            onChange={(event) =>
              updateField(
                "technologies",
                event.target.value
              )
            }
            placeholder="e.g. Next.js, TypeScript, Prisma, PostgreSQL"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#126BFF]/50"
          />
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
              Featured Project
            </span>

            <span className="mt-1 block text-xs text-white/35">
              Highlight this project prominently on the portfolio.
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
                ? "Update Project"
                : "Add Project"}
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
              ? "User Projects"
              : "Your Projects"}
          </h3>

          <span className="text-xs text-white/35">
            {projects.length}{" "}
            {projects.length === 1
              ? "project"
              : "projects"}
          </span>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/40">
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center">
            <p className="text-sm text-white/40">
              No projects have been added yet.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {projects.map((project, index) => (
              <article
                key={project.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-5"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold">
                        {project.title}
                      </h4>

                      {project.featured && (
                        <span className="rounded-full border border-[#D9A441]/20 bg-[#D9A441]/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-[#D9A441]">
                          Featured
                        </span>
                      )}
                    </div>

                    {project.category && (
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#126BFF]">
                        {project.category}
                      </p>
                    )}

                    {project.description && (
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
                        {project.description}
                      </p>
                    )}

                    {project.technologies && (
                      <p className="mt-3 text-xs text-white/30">
                        {project.technologies}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        moveProject(
                          project.id,
                          "up"
                        )
                      }
                      disabled={
                        index === 0 ||
                        actionId === project.id
                      }
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        moveProject(
                          project.id,
                          "down"
                        )
                      }
                      disabled={
                        index ===
                          projects.length - 1 ||
                        actionId === project.id
                      }
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        startEditing(project)
                      }
                      disabled={
                        actionId === project.id
                      }
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteProject(project.id)
                      }
                      disabled={
                        actionId === project.id
                      }
                      className="rounded-xl border border-red-400/10 bg-red-400/5 px-4 py-2 text-xs text-red-300 transition hover:bg-red-400/10 disabled:opacity-30"
                    >
                      {actionId === project.id
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