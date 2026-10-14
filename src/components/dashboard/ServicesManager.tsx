"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Service = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  price: string | null;
  link: string | null;
  sortOrder?: number;
};

export function ServicesManager() {
  const searchParams = useSearchParams();
  const adminUserId = searchParams.get("adminUserId")?.trim() || "";

  const servicesApiUrl = adminUserId
    ? `/api/services?adminUserId=${encodeURIComponent(adminUserId)}`
    : "/api/services";

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [price, setPrice] = useState("");
  const [link, setLink] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadServices() {
      try {
        const response = await fetch(servicesApiUrl);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load services.");
        }

        if (!cancelled) {
          setServices(data.services);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load services."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    
    loadServices();

    return () => {
      cancelled = true;
    };
  }, [servicesApiUrl]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setIcon("");
    setPrice("");
    setLink("");
    setEditingId(null);
  }

  function handleEdit(service: Service) {
    setEditingId(service.id);
    setTitle(service.title);
    setDescription(service.description || "");
    setIcon(service.icon || "");
    setPrice(service.price || "");
    setLink(service.link || "");
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

    if (!title.trim()) {
      setMessage("Service title is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(servicesApiUrl, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingId,
          title: title.trim(),
          description,
          icon,
          price,
          link,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            (editingId
              ? "Unable to update service."
              : "Unable to create service.")
        );
        return;
      }

      if (editingId) {
        setServices((items) =>
          items.map((service) =>
            service.id === editingId ? data.service : service
          )
        );
        setMessage("Service updated successfully.");
      } else {
        setServices((items) => [...items, data.service]);
        setMessage("Service added successfully.");
      }

      resetForm();
    } catch {
      setMessage(
        editingId
          ? "Something went wrong while updating the service."
          : "Something went wrong while adding the service."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleReorder(
    serviceId: string,
    direction: "up" | "down"
  ) {
    setReorderingId(serviceId);
    setMessage("");

    try {
      const response = await fetch(servicesApiUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: serviceId,
          direction,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.message || "Unable to reorder service.");
        return;
      }

      if (data.services) {
        setServices(data.services);
      }

      setMessage("Service order updated successfully.");
    } catch {
      setMessage("Something went wrong while reordering the service.");
    } finally {
      setReorderingId(null);
    }
  }

  async function handleDelete(serviceId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this service?"
    );

    if (!confirmed) return;

    setDeletingId(serviceId);
    setMessage("");

    try {
      const response = await fetch(servicesApiUrl, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: serviceId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.message || "Unable to delete service.");
        return;
      }

      setServices((items) =>
        items.filter((service) => service.id !== serviceId)
      );

      if (editingId === serviceId) {
        resetForm();
      }

      setMessage("Service deleted successfully.");
    } catch {
      setMessage("Something went wrong while deleting the service.");
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
            Services
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-white">
            {adminUserId
              ? "Manage User Services"
              : "Manage Your Services"}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Add, edit, reorder and manage the professional services,
            solutions or products displayed on your portfolio.
          </p>
        </div>

        <span className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/60">
          {services.length}{" "}
          {services.length === 1 ? "service" : "services"}
        </span>
      </div>

      {adminUserId && (
        <div className="liquid-glass mt-6 rounded-2xl p-4">
          <p className="text-sm font-semibold text-[#D9A441]">
            Super Admin Mode
          </p>
          <p className="mt-1 text-xs leading-5 text-white/55">
            You are managing services for the selected user.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8">
        {editingId && (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#D9A441]/25 bg-[#D9A441]/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#D9A441]">
                Editing Service
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
              htmlFor="service-title"
              className="mb-2 block text-sm text-white/70"
            >
              Service Title
            </label>
            <input
              id="service-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Financial Planning"
              required
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="service-icon"
              className="mb-2 block text-sm text-white/70"
            >
              Icon or Symbol
            </label>
            <input
              id="service-icon"
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              placeholder="💼 or ✦"
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="service-description"
              className="mb-2 block text-sm text-white/70"
            >
              Description
            </label>
            <textarea
              id="service-description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Describe what this service provides."
              rows={4}
              className={`${inputClass} resize-none leading-6`}
            />
          </div>

          <div>
            <label
              htmlFor="service-price"
              className="mb-2 block text-sm text-white/70"
            >
              Price / Starting From
            </label>
            <input
              id="service-price"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="From KSh 5,000"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="service-link"
              className="mb-2 block text-sm text-white/70"
            >
              Service Link
            </label>
            <input
              id="service-link"
              type="url"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://example.com"
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
                : "Add Service"}
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
              Portfolio offerings
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              Current Services
            </h3>
          </div>

          <p className="text-xs text-white/45">
            {loading
              ? "Loading services..."
              : `${services.length} saved`}
          </p>
        </div>

        {loading ? (
          <div className="mt-5 space-y-3">
            <div className="liquid-glass h-24 animate-pulse rounded-2xl" />
            <div className="liquid-glass h-24 animate-pulse rounded-2xl" />
          </div>
        ) : services.length === 0 ? (
          <div className="liquid-glass mt-5 rounded-2xl border-dashed p-8 text-center">
            <p className="text-sm font-medium text-white/75">
              No services added yet
            </p>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Add your services to showcase what visitors can access
              through your professional portfolio.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {services.map((service, index) => {
              const isFirst = index === 0;
              const isLast = index === services.length - 1;
              const isReordering = reorderingId === service.id;

              return (
                <article
                  key={service.id}
                  className="liquid-glass rounded-2xl p-5 sm:p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D9A441]/20 bg-[#D9A441]/[0.07] text-lg text-[#D9A441]">
                        {service.icon || "✦"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-semibold text-white">
                            {service.title}
                          </h4>

                          <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-white/50">
                            Position {index + 1}
                          </span>
                        </div>

                        {service.description && (
                          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-white/60">
                            {service.description}
                          </p>
                        )}

                        {service.price && (
                          <p className="mt-3 text-sm font-medium text-[#D9A441]">
                            {service.price}
                          </p>
                        )}

                        {service.link && (
                          <a
                            href={service.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex text-sm text-[#D9A441] underline-offset-4 transition hover:text-white hover:underline"
                          >
                            View Service Link  
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          handleReorder(service.id, "up")
                        }
                        disabled={
                          isFirst ||
                          isReordering ||
                          saving ||
                          deletingId !== null
                        }
                        aria-label={`Move ${service.title} up`}
                        className="liquid-glass-button px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        ↑ Up
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleReorder(service.id, "down")
                        }
                        disabled={
                          isLast ||
                          isReordering ||
                          saving ||
                          deletingId !== null
                        }
                        aria-label={`Move ${service.title} down`}
                        className="liquid-glass-button px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        ↓ Down
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEdit(service)}
                        disabled={
                          isReordering ||
                          deletingId === service.id ||
                          saving
                        }
                        className="liquid-glass-button px-4 py-2 text-sm text-[#D9A441] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(service.id)}
                        disabled={
                          isReordering ||
                          deletingId === service.id ||
                          saving
                        }
                        className="liquid-glass-button border-red-400/20 px-4 py-2 text-sm text-red-300 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {deletingId === service.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  </div>

                  {isReordering && (
                    <p className="mt-4 text-xs text-white/50">
                      Updating service order...
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
