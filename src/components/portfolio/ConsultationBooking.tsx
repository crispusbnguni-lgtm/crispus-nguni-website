
"use client";

import { useCallback, useMemo, useState } from "react";
import { ConsultationConfirmation } from "./ConsultationConfirmation";
import { ConsultationDetailsForm } from "./ConsultationDetailsForm";

type ConsultationBookingProps = {
  slug: string;
  portfolioId: string;
  consultationTypeId: string;
  consultationTitle: string;
  durationMinutes: number;
  meetingMethod: string | null;
};

type ConsultationSlot = {
  start: string;
  end: string;
};

type BookingDetails = {
  fullName: string;
  email: string;
  phone: string;
  reason: string;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  slots?: ConsultationSlot[];
  booking?: {
    id?: string;
    reference?: string;
  };
  consultation?: {
    id?: string;
    reference?: string;
  };
  [key: string]: unknown;
};

type BookingStep = "datetime" | "details" | "confirmation" | "success";

const TIME_ZONE = "Africa/Nairobi";

async function readApiResponse(
  response: Response,
): Promise<ApiResponse> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();

    return {
      success: false,
      message:
        text.trim() ||
        `The server returned an unexpected response (HTTP ${response.status}).`,
    };
  }

  try {
    return (await response.json()) as ApiResponse;
  } catch {
    return {
      success: false,
      message: "The server returned an invalid response.",
    };
  }
}

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTimeLabel(value: string): string {
  return new Intl.DateTimeFormat("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

function formatShortDate(date: Date): {
  weekday: string;
  day: string;
  month: string;
} {
  return {
    weekday: new Intl.DateTimeFormat("en-KE", {
      weekday: "short",
    }).format(date),
    day: new Intl.DateTimeFormat("en-KE", {
      day: "numeric",
    }).format(date),
    month: new Intl.DateTimeFormat("en-KE", {
      month: "short",
    }).format(date),
  };
}

export function ConsultationBooking({
  slug,
  portfolioId,
  consultationTypeId,
  consultationTitle,
  durationMinutes,
  meetingMethod,
}: ConsultationBookingProps) {
  const [step, setStep] = useState<BookingStep>("datetime");
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<ConsultationSlot[]>([]);
  const [selectedSlot, setSelectedSlot] =
    useState<ConsultationSlot | null>(null);
  const [bookingDetails, setBookingDetails] =
    useState<BookingDetails | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [bookingReference, setBookingReference] = useState("");

  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();

    for (let index = 0; index < 14; index += 1) {
      dates.push(
        new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + index,
        ),
      );
    }

    return dates;
  }, []);

  const loadSlots = useCallback(
    async (date: string) => {
      setSelectedDate(date);
      setSelectedSlot(null);
      setSlots([]);
      setSlotError("");
      setLoadingSlots(true);

      try {
        const params = new URLSearchParams({
          portfolioId,
          consultationTypeId,
          date,
        });

        const response = await fetch(
          `/api/consultations/availability/slots?${params.toString()}`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
            cache: "no-store",
          },
        );

        const data = await readApiResponse(response);

        if (!response.ok || data.success === false) {
          throw new Error(
            data.message ||
              data.error ||
              `Unable to load available times (HTTP ${response.status}).`,
          );
        }

        if (!Array.isArray(data.slots)) {
          throw new Error(
            "The server response did not contain an available-times list.",
          );
        }

        const validSlots = data.slots.filter(
          (slot): slot is ConsultationSlot =>
            typeof slot?.start === "string" &&
            typeof slot?.end === "string" &&
            !Number.isNaN(Date.parse(slot.start)) &&
            !Number.isNaN(Date.parse(slot.end)),
        );

        setSlots(validSlots);

        if (validSlots.length === 0) {
          setSlotError(
            "There are no available times on this date. Please choose another day.",
          );
        }
      } catch (error) {
        console.error("Loading consultation slots failed:", error);
        setSlotError(
          error instanceof Error
            ? error.message
            : "Unable to load available times. Please try again.",
        );
      } finally {
        setLoadingSlots(false);
      }
    },
    [portfolioId, consultationTypeId],
  );

  const handleSlotSelection = (slot: ConsultationSlot) => {
    setSelectedSlot(slot);
    setSlotError("");
    setBookingError("");
  };

  const handleDetailsContinue = (details: BookingDetails) => {
    if (!selectedSlot) {
      setSlotError("Please select a consultation time first.");
      setStep("datetime");
      return;
    }

    setBookingDetails(details);
    setBookingError("");
    setStep("confirmation");
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !bookingDetails) {
      setBookingError(
        "Your booking details are incomplete. Please review your selection.",
      );
      setStep(!selectedSlot ? "datetime" : "details");
      return;
    }

    setSubmitting(true);
    setBookingError("");

    try {
      const response = await fetch("/api/consultations/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          portfolioSlug: slug,
          consultationTypeId,
          scheduledAt: selectedSlot.start,
          fullName: bookingDetails.fullName.trim(),
          email: bookingDetails.email.trim(),
          phone: bookingDetails.phone.trim(),
          reason: bookingDetails.reason.trim(),
        }),
      });

      const data = await readApiResponse(response);

      if (!response.ok || data.success === false) {
        const diagnostic = {
          status: response.status,
          statusText: response.statusText,
          response: data,
        };

        console.error("Consultation booking API failed:", diagnostic);

        const message =
          data.message ||
          data.error ||
          `The server returned HTTP ${response.status}.`;

        if (response.status === 409) {
          setSelectedSlot(null);
          await loadSlots(selectedDate);
          throw new Error(
            data.message ||
              "That time is no longer available. Please select another time.",
          );
        }

        setBookingError(
          `Booking failed (HTTP ${response.status}): ${message}`,
        );

        alert(
          `Consultation booking failed\n\nHTTP status: ${response.status} ${response.statusText}\n\nAPI response:\n${JSON.stringify(data, null, 2)}`,
        );

        return;
      }

      const reference =
        data.booking?.reference ||
        data.consultation?.reference ||
        data.booking?.id ||
        data.consultation?.id ||
        "";

      setBookingReference(reference);
      setStep("success");
    } catch (error) {
      console.error("Consultation booking failed:", error);

      setBookingError(
        error instanceof Error
          ? error.message
          : "Your booking could not be completed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToDateTime = () => {
    setBookingError("");
    setStep("datetime");
  };

  const handleBackToDetails = () => {
    setBookingError("");
    setStep("details");
  };

  if (step === "success") {
    return (
      <section className="portfolio-glass mx-auto w-full max-w-2xl p-6 sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
          ✓
        </div>

        <div className="mt-5 text-center">
          <p className="portfolio-accent text-sm font-semibold uppercase tracking-[0.2em]">
            Booking successful
          </p>

          <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
            Your consultation is booked
          </h2>

          <p className="portfolio-muted mt-3 text-sm leading-6">
            Thank you, {bookingDetails?.fullName}. Your consultation request
            has been recorded.
          </p>
        </div>

        <div className="portfolio-glass mt-8 space-y-4 p-5">
          <div>
            <p className="portfolio-muted text-sm">Consultation</p>
            <p className="mt-1 font-semibold">{consultationTitle}</p>
          </div>

          <div>
            <p className="portfolio-muted text-sm">Date</p>
            <p className="mt-1 font-semibold">
              {selectedSlot
                ? formatLongDate(selectedSlot.start)
                : "Confirmed"}
            </p>
          </div>

          <div>
            <p className="portfolio-muted text-sm">Time</p>
            <p className="mt-1 font-semibold">
              {selectedSlot
                ? `${formatTimeLabel(selectedSlot.start)} – ${formatTimeLabel(
                    selectedSlot.end,
                  )}`
                : "Confirmed"}{" "}
              East Africa Time
            </p>
          </div>

          {bookingReference && (
            <div>
              <p className="portfolio-muted text-sm">Booking reference</p>
              <p className="mt-1 break-all font-semibold">
                {bookingReference}
              </p>
            </div>
          )}

          <div>
            <p className="portfolio-muted text-sm">Confirmation email</p>
            <p className="mt-1 break-all font-medium">
              {bookingDetails?.email}
            </p>
          </div>
        </div>

        <p className="portfolio-muted mt-5 text-center text-sm leading-6">
          Please check your email for any further consultation details.
        </p>
      </section>
    );
  }

  if (step === "details") {
    return (
      <div>
        {bookingError && (
          <div
            role="alert"
            className="portfolio-glass mb-5 border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600"
          >
            {bookingError}
          </div>
        )}

        <ConsultationDetailsForm
          consultationTitle={consultationTitle}
          selectedDate={selectedDate}
          selectedTime={selectedSlot?.start ?? ""}
          timezone={TIME_ZONE}
          onContinue={handleDetailsContinue}
        />
      </div>
    );
  }

  if (step === "confirmation") {
    if (!selectedSlot || !bookingDetails) {
      return (
        <div
          role="alert"
          className="portfolio-glass border-red-500/40 bg-red-500/10 p-5 text-sm text-red-600"
        >
          Your selection is incomplete. Please go back and select a date and
          time again.
          <button
            type="button"
            onClick={handleBackToDateTime}
            className="ml-2 font-semibold underline"
          >
            Go back
          </button>
        </div>
      );
    }

    return (
      <div>
        {bookingError && (
          <div
            role="alert"
            className="portfolio-glass mb-5 border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600"
          >
            {bookingError}
          </div>
        )}

        <ConsultationConfirmation
          consultationTitle={consultationTitle}
          selectedDate={selectedSlot.start}
          selectedTime={formatTimeLabel(selectedSlot.start)}
          timezone={TIME_ZONE}
          fullName={bookingDetails.fullName}
          email={bookingDetails.email}
          phone={bookingDetails.phone}
          reason={bookingDetails.reason}
          onBack={handleBackToDetails}
          onConfirm={handleConfirmBooking}
        />

        {submitting && (
          <p className="portfolio-muted mt-4 text-center text-sm">
            Submitting your booking securely…
          </p>
        )}
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-4xl">
      <div className="mb-8">
        <p className="portfolio-accent text-sm font-semibold uppercase tracking-[0.18em]">
          Step 1 of 3
        </p>

        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
          Choose a date and time
        </h2>

        <p className="portfolio-muted mt-2 text-sm leading-6">
          Select a date to see the available consultation times.
        </p>
      </div>

      <div className="portfolio-glass mb-7 p-5">
        <h3 className="text-lg font-semibold">{consultationTitle}</h3>

        <div className="portfolio-muted mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span>{durationMinutes} minutes</span>
          {meetingMethod && <span>{meetingMethod}</span>}
          <span>East Africa Time (EAT)</span>
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-semibold">Select a date</h3>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-7">
          {availableDates.map((date) => {
            const dateKey = getDateKey(date);
            const formatted = formatShortDate(date);
            const selected = selectedDate === dateKey;

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => void loadSlots(dateKey)}
                disabled={loadingSlots}
                aria-pressed={selected}
                className={`flex min-h-[112px] flex-col items-center justify-center rounded-2xl border p-3 text-center transition ${
                  selected
                    ? "border-[var(--portfolio-accent)] bg-[var(--portfolio-accent)] font-semibold text-[#17130A] shadow-lg"
                    : "border-[var(--portfolio-border)] bg-[var(--portfolio-surface)] text-[var(--portfolio-text)] hover:-translate-y-0.5 hover:border-[var(--portfolio-accent)]"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span className="block text-xs font-medium">
                  {formatted.weekday}
                </span>

                <span className="my-1 block text-2xl font-bold">
                  {formatted.day}
                </span>

                <span className="block text-xs">{formatted.month}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-semibold">Available times</h3>

          {loadingSlots && (
            <span className="portfolio-muted text-sm">Loading times…</span>
          )}
        </div>

        {slotError && (
          <div
            role="alert"
            className="portfolio-glass mb-5 border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600"
          >
            {slotError}
          </div>
        )}

        {!selectedDate && !loadingSlots && (
          <div className="portfolio-glass portfolio-muted p-8 text-center text-sm">
            Choose a date above to see available times.
          </div>
        )}

        {selectedDate && !loadingSlots && slots.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {slots.map((slot) => {
              const selected = selectedSlot?.start === slot.start;

              return (
                <button
                  key={slot.start}
                  type="button"
                  onClick={() => handleSlotSelection(slot)}
                  aria-pressed={selected}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    selected
                      ? "border-[var(--portfolio-accent)] bg-[var(--portfolio-accent)] text-[#17130A]"
                      : "border-[var(--portfolio-border)] bg-[var(--portfolio-surface)] text-[var(--portfolio-text)] hover:border-[var(--portfolio-accent)]"
                  }`}
                >
                  {formatTimeLabel(slot.start)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-4 border-t border-[var(--portfolio-border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="portfolio-muted text-sm">
          {selectedSlot
            ? `Selected: ${formatLongDate(selectedSlot.start)} at ${formatTimeLabel(
                selectedSlot.start,
              )}`
            : "Choose an available time to continue."}
        </p>

        <button
          type="button"
          onClick={() => {
            setBookingError("");
            setStep("details");
          }}
          disabled={!selectedSlot || loadingSlots}
          className="portfolio-primary-button disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to your details
        </button>
      </div>
    </section>
  );
}