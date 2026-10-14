"use client";

import { FormEvent, useState } from "react";

const consultationTypes = [
  "Financial Education",
  "Wealth Planning",
  "Insurance & Protection",
  "Investment Discussion",
  "Retirement Planning",
  "Business & Financial Planning",
  "General Consultation",
];

type ConsultationFormProps = {
  portfolioSlug: string;
  professionalName: string;
};

export function ConsultationForm({
  portfolioSlug,
  professionalName,
}: ConsultationFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSubmitting(true);
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const consultationType = String(
      formData.get("consultationType") ?? ""
    ).trim();

    const data = {
      portfolioSlug,
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      consultationType,
      message: formData.get("message"),
    };

    try {
      const response = await fetch("/api/consultation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            "Unable to submit your request."
        );
      }

      setSubmitted(true);
      form.reset();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-[32px] border border-[#126BFF]/20 bg-white/[0.035] p-8 backdrop-blur-xl sm:p-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#126BFF]/10 text-2xl text-[#126BFF]">
          ✓
        </div>

        <p className="mt-8 text-sm font-medium uppercase tracking-[0.25em] text-[#D9A441]">
          Request Received
        </p>

        <h2 className="mt-4 text-3xl font-semibold">
          Thank you.
        </h2>

        <p className="mt-5 max-w-xl leading-7 text-white/50">
          Your consultation request has been sent to{" "}
          <span className="text-white/80">
            {professionalName}
          </span>
          . They can now review your request and follow up with you.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[32px] border border-white/10 bg-white/[0.035] p-8 backdrop-blur-xl sm:p-10"
    >
      <p className="text-sm font-medium uppercase tracking-[0.25em] text-[#126BFF]">
        Request a Consultation
      </p>

      <h2 className="mt-4 text-3xl font-semibold">
        Start the conversation.
      </h2>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="consultation-name"
            className="mb-2 block text-sm text-white/60"
          >
            Name
          </label>

          <input
            id="consultation-name"
            name="name"
            required
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-[#126BFF]/50"
            placeholder="Your name"
          />
        </div>

        <div>
          <label
            htmlFor="consultation-email"
            className="mb-2 block text-sm text-white/60"
          >
            Email
          </label>

          <input
            id="consultation-email"
            name="email"
            type="email"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-[#126BFF]/50"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="consultation-phone"
            className="mb-2 block text-sm text-white/60"
          >
            Phone / WhatsApp
          </label>

          <input
            id="consultation-phone"
            name="phone"
            required
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-[#126BFF]/50"
            placeholder="+254..."
          />
        </div>

        <div>
          <label
            htmlFor="consultation-type"
            className="mb-2 block text-sm text-white/60"
          >
            What would you like to discuss?
          </label>

          <select
            id="consultation-type"
            name="consultationType"
            required
            defaultValue=""
            className="w-full rounded-2xl border border-white/10 bg-[#090C14] px-4 py-3.5 text-white outline-none transition focus:border-[#126BFF]/50"
          >
            <option value="" disabled>
              Select a topic
            </option>

            {consultationTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5">
        <label
          htmlFor="consultation-message"
          className="mb-2 block text-sm text-white/60"
        >
          Tell us a little about what you need
        </label>

        <textarea
          id="consultation-message"
          name="message"
          required
          rows={6}
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-[#126BFF]/50"
          placeholder="What would you like to discuss?"
        />
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-7 inline-flex rounded-full bg-[#126BFF] px-7 py-3.5 font-medium text-white transition hover:bg-[#2477ff] hover:shadow-[0_0_35px_rgba(18,107,255,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? "Sending Request..."
          : "Request Consultation"}
      </button>

      <p className="mt-4 text-xs leading-5 text-white/30">
        Your information will be shared with{" "}
        {professionalName} so they can respond to your consultation
        request.
      </p>
    </form>
  );
}