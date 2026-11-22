"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

type DuplicateLead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  createdAt: string;
};

const sources = [
  ["MANUAL", "Manual / not specified"],
  ["REFERRAL", "Referral"],
  ["EVENT", "Event"],
  ["WALK_IN", "Walk-in"],
  ["CAMPAIGN", "Campaign"],
  ["SOCIAL_MEDIA", "Social media (other)"],
  ["FACEBOOK", "Facebook"],
  ["INSTAGRAM", "Instagram"],
  ["LINKEDIN", "LinkedIn"],
  ["TIKTOK", "TikTok"],
  ["WHATSAPP", "WhatsApp"],
  ["WEBSITE", "Website"],
  ["EMAIL", "Email"],
  ["GOOGLE", "Google"],
  ["ADVERTISEMENT", "Advertisement"],
  ["OTHER", "Other / unknown"],
] as const;

const fieldClass =
  "w-full rounded-xl border border-white/15 bg-white/[0.045] px-3.5 py-3 text-sm text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none backdrop-blur-2xl transition placeholder:text-[var(--text-muted)] focus:border-[#D9A441]/60 focus:ring-2 focus:ring-[#D9A441]/10";
const labelClass = "mb-2 block text-sm font-medium text-[var(--text-muted)]";
const requiredClass = "ml-1 text-[#D9A441]";
const cardClass =
  "rounded-3xl border border-white/[0.12] bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_55px_rgba(0,0,0,0.12)] backdrop-blur-2xl";

function SourceLabel({ htmlFor, children, required = false }: {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className={labelClass} htmlFor={htmlFor}>
      {children}
      {required && <span className={requiredClass} aria-label="required">*</span>}
    </label>
  );
}

export default function AddLeadPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateLead[]>([]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setDuplicates([]);

    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    const email = value("email");
    const phone = value("phone");
    if (!email && !phone) {
      setError("Add at least one contact method: phone or email.");
      return;
    }

    const decisionValue = value("decisionMaker");
    const payload = {
      name: value("name"),
      phone,
      email,
      company: value("company"),
      location: value("location"),
      interestedIn: value("interestedIn"),
      budget: value("budget"),
      timeline: value("timeline"),
      decisionMaker:
        decisionValue === "yes" ? true : decisionValue === "no" ? false : null,
      source: value("source"),
      sourceDetail: value("sourceDetail"),
      notes: value("notes"),
      nextFollowUpAt: value("nextFollowUpAt")
        ? new Date(value("nextFollowUpAt")).toISOString()
        : null,
    };

    setSaving(true);
    try {
      const response = await fetch("/api/dashboard/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (response.status === 409 && result?.code === "LEAD_DUPLICATE") {
        setDuplicates(Array.isArray(result.leads) ? result.leads : []);
        setError(result.message || "Review the matching lead before continuing.");
        return;
      }
      if (!response.ok || !result?.success || !result.lead?.id) {
        throw new Error(result?.message || "Unable to create this lead.");
      }
      router.push(`/dashboard/leads/${encodeURIComponent(result.lead.id)}`);
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to create this lead.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 text-[var(--text)] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard/leads"
          className="text-sm text-[var(--text-muted)] transition hover:text-[#D9A441]"
        >
          ← Back to lead inbox
        </Link>

        <header className="mb-7 mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#D9A441]">
            Sales workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Add new lead
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Capture a contact and what you know so far. Unknown details stay unknown; manual entry does not add buying-intent points.
          </p>
        </header>

        {error && (
          <div role="alert" className="mb-5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-4 text-sm text-amber-100">
            <p>{error}</p>
            {duplicates.length > 0 && (
              <ul className="mt-3 space-y-2">
                {duplicates.map((lead) => (
                  <li key={lead.id} className="flex flex-col gap-1 rounded-xl border border-white/10 bg-black/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      <strong className="text-white">{lead.name}</strong>
                      <span className="ml-2 text-white/65">
                        {[lead.email, lead.phone].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <Link
                      href={`/dashboard/leads/${encodeURIComponent(lead.id)}`}
                      className="shrink-0 font-semibold text-[#E8C77C] underline underline-offset-4"
                    >
                      Review existing lead →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form onSubmit={submit} className={`${cardClass} space-y-7 p-5 sm:p-8`}>
          <section>
            <h2 className="text-lg font-semibold">Contact details</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Name is required. Provide at least one valid phone number or email address.</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <SourceLabel htmlFor="name" required>Full name</SourceLabel>
                <input id="name" name="name" required maxLength={120} autoComplete="name" className={fieldClass} />
              </div>
              <div>
                <SourceLabel htmlFor="phone">Phone number</SourceLabel>
                <input id="phone" name="phone" type="tel" maxLength={40} autoComplete="tel" placeholder="+254 700 000 000" className={fieldClass} />
                <p className="mt-1.5 text-xs text-[var(--text-muted)]">Include the country code for reliable matching.</p>
              </div>
              <div>
                <SourceLabel htmlFor="email">Email address</SourceLabel>
                <input id="email" name="email" type="email" maxLength={254} autoComplete="email" className={fieldClass} />
              </div>
              <div>
                <SourceLabel htmlFor="company">Company</SourceLabel>
                <input id="company" name="company" maxLength={160} autoComplete="organization" className={fieldClass} />
              </div>
              <div>
                <SourceLabel htmlFor="location">Location</SourceLabel>
                <input id="location" name="location" maxLength={160} autoComplete="address-level2" className={fieldClass} />
              </div>
            </div>
          </section>

          <section className="border-t border-white/10 pt-6">
            <h2 className="text-lg font-semibold">Interest and qualification</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Only enter details the lead has actually shared.</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <SourceLabel htmlFor="interestedIn">Interested in / product</SourceLabel>
                <input id="interestedIn" name="interestedIn" maxLength={300} className={fieldClass} />
              </div>
              <div>
                <SourceLabel htmlFor="decisionMaker">Decision-maker status</SourceLabel>
                <select id="decisionMaker" name="decisionMaker" defaultValue="" className={fieldClass}>
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <SourceLabel htmlFor="budget">Budget</SourceLabel>
                <input id="budget" name="budget" maxLength={120} placeholder="Only if shared" className={fieldClass} />
              </div>
              <div>
                <SourceLabel htmlFor="timeline">Buying timeline</SourceLabel>
                <input id="timeline" name="timeline" maxLength={120} placeholder="Only if shared" className={fieldClass} />
              </div>
            </div>
          </section>

          <section className="border-t border-white/10 pt-6">
            <h2 className="text-lg font-semibold">Acquisition source</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">This records where the lead came from. The dashboard separately records that it was entered manually.</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <SourceLabel htmlFor="source" required>Source</SourceLabel>
                <select id="source" name="source" defaultValue="MANUAL" required className={fieldClass}>
                  {sources.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <SourceLabel htmlFor="sourceDetail">Source details</SourceLabel>
                <input id="sourceDetail" name="sourceDetail" maxLength={200} placeholder="Event, campaign, or referrer name" className={fieldClass} />
              </div>
              <div className="sm:col-span-2">
                <SourceLabel htmlFor="notes">Notes</SourceLabel>
                <textarea id="notes" name="notes" rows={4} maxLength={5000} placeholder="Context to remember or the next conversation topic" className={`${fieldClass} resize-y`} />
              </div>
              <div>
                <SourceLabel htmlFor="nextFollowUpAt">Next follow-up</SourceLabel>
                <input id="nextFollowUpAt" name="nextFollowUpAt" type="datetime-local" className={fieldClass} />
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-end">
            <Link href="/dashboard/leads" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-medium text-white/75 transition hover:bg-white/[0.06]">Cancel</Link>
            <button type="submit" disabled={saving} className="min-h-12 rounded-xl border border-[#D9A441]/40 bg-[#D9A441] px-6 text-sm font-semibold text-[#15110A] shadow-[0_8px_24px_rgba(217,164,65,0.12)] transition hover:bg-[#E8B957] disabled:cursor-wait disabled:opacity-60">
              {saving ? "Saving lead…" : "Add lead"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
