
"use client";

import { FormEvent, useState } from "react";

export type ConsultationBookingDetails = {
  fullName: string;
  email: string;
  phone: string;
  reason: string;
};

type ConsultationDetailsFormProps = {
  consultationTitle: string;
  selectedDate: string;
  selectedTime: string;
  timezone: string;
  onContinue: (details: ConsultationBookingDetails) => void;
};

export function ConsultationDetailsForm({
  consultationTitle,
  selectedDate,
  selectedTime,
  timezone,
  onContinue,
}: ConsultationDetailsFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    onContinue({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      reason: reason.trim(),
    });
  }

  const inputClassName =
    "w-full rounded-2xl border border-[var(--portfolio-border)] bg-[var(--portfolio-surface)] px-4 py-3.5 text-[var(--portfolio-text)] outline-none transition placeholder:opacity-50 focus:border-[var(--portfolio-accent)] focus:ring-2 focus:ring-[var(--portfolio-accent)]/20";

  const labelClassName =
    "mb-2 block text-sm font-medium text-[var(--portfolio-text)]";

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <div>
        <p className="portfolio-accent text-sm font-medium uppercase tracking-[0.3em]">
          Step 2 of 3
        </p>

        <h2 className="mt-4 text-3xl font-semibold tracking-tight">
          Your details
        </h2>

        <p className="portfolio-muted mt-3 leading-7">
          Tell us a little about yourself so the consultation can be
          prepared properly.
        </p>
      </div>

      <div className="portfolio-glass p-5">
        <p className="portfolio-accent text-xs uppercase tracking-[0.2em]">
          Selected appointment
        </p>

        <p className="mt-2 font-semibold">{consultationTitle}</p>

        <p className="portfolio-muted mt-1 text-sm">
          {selectedDate} at {selectedTime}
        </p>

        <p className="portfolio-muted mt-1 text-xs">{timezone}</p>
      </div>

      <div className="space-y-5">
        <div>
          <label htmlFor="fullName" className={labelClassName}>
            Full name
          </label>

          <input
            id="fullName"
            name="fullName"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Your full name"
            autoComplete="name"
            minLength={2}
            maxLength={100}
            required
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClassName}>
            Email address
          </label>

          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            maxLength={254}
            required
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="phone" className={labelClassName}>
            Phone / WhatsApp
          </label>

          <input
            id="phone"
            name="phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+254 7XX XXX XXX"
            autoComplete="tel"
            minLength={7}
            maxLength={30}
            required
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="reason" className={labelClassName}>
            What would you like to discuss?
          </label>

          <textarea
            id="reason"
            name="reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Briefly tell us what you need help with..."
            rows={5}
            minLength={3}
            maxLength={3000}
            required
            className={`${inputClassName} resize-y`}
          />
        </div>
      </div>

      <button
        type="submit"
        className="portfolio-primary-button w-full"
      >
        Review Your Booking
      </button>
    </form>
  );
}