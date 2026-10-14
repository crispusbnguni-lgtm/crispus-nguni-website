
"use client";

type ConsultationConfirmationProps = {
  consultationTitle: string;
  selectedDate: string;
  selectedTime: string;
  timezone: string;
  fullName: string;
  email: string;
  phone: string;
  reason: string;
  onBack: () => void;
  onConfirm: () => void;
};

export function ConsultationConfirmation({
  consultationTitle,
  selectedDate,
  selectedTime,
  timezone,
  fullName,
  email,
  phone,
  reason,
  onBack,
  onConfirm,
}: ConsultationConfirmationProps) {
  const labelClassName =
    "text-xs uppercase tracking-[0.15em] portfolio-muted";

  const valueClassName =
    "portfolio-muted mt-1 text-sm leading-6";

  return (
    <div className="space-y-7">
      {/* Heading */}
      <div>
        <p className="portfolio-accent text-sm font-medium uppercase tracking-[0.3em]">
          Step 3 of 3
        </p>

        <h2 className="mt-4 text-3xl font-semibold tracking-tight">
          Review your consultation
        </h2>

        <p className="portfolio-muted mt-3 leading-7">
          Check the details below before requesting your consultation.
        </p>
      </div>

      {/* Consultation details */}
      <section className="portfolio-glass p-6 sm:p-7">
        <p className="portfolio-accent text-xs uppercase tracking-[0.2em]">
          Consultation
        </p>

        <h3 className="mt-3 text-xl font-semibold">
          {consultationTitle}
        </h3>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <p className={labelClassName}>Date</p>
            <p className={valueClassName}>{selectedDate}</p>
          </div>

          <div>
            <p className={labelClassName}>Time</p>
            <p className={valueClassName}>{selectedTime}</p>
          </div>
        </div>

        <p className="portfolio-muted mt-5 text-xs">
          {timezone}
        </p>
      </section>

      {/* Personal details */}
      <section className="portfolio-glass p-6 sm:p-7">
        <p className="portfolio-accent text-xs uppercase tracking-[0.2em]">
          Your details
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <p className={labelClassName}>Full name</p>
            <p className={valueClassName}>{fullName}</p>
          </div>

          <div>
            <p className={labelClassName}>Email</p>
            <p className={`${valueClassName} break-all`}>
              {email}
            </p>
          </div>

          <div>
            <p className={labelClassName}>Phone / WhatsApp</p>
            <p className={valueClassName}>{phone}</p>
          </div>

          <div>
            <p className={labelClassName}>
              Reason for consultation
            </p>

            <p className={`${valueClassName} whitespace-pre-wrap`}>
              {reason}
            </p>
          </div>
        </div>
      </section>

      {/* Submission notice */}
      <div className="portfolio-glass p-5">
        <div className="flex items-start gap-3">
          <span className="portfolio-accent mt-0.5">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="12" r="9" />
              <path
                d="M12 11v5m0-8h.01"
                strokeLinecap="round"
              />
            </svg>
          </span>

          <p className="portfolio-muted text-sm leading-6">
            Your consultation request will be reviewed and confirmed
            after submission. Please make sure your contact details
            are correct.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          className="portfolio-secondary-button w-full"
        >
          Edit Details
        </button>

        <button
          type="button"
          onClick={onConfirm}
          className="portfolio-primary-button w-full"
        >
          Request Consultation
        </button>
      </div>
    </div>
  );
}