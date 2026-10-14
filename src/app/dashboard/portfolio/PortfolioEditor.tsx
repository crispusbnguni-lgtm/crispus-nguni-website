"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";

import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { MediaUploadField } from "@/components/dashboard/MediaUploadField";
import { ServicesManager } from "@/components/dashboard/ServicesManager";
import { ExperienceManager } from "@/components/dashboard/ExperienceManager";
import { SkillsManager } from "@/components/dashboard/SkillsManager";
import { ProjectsManager } from "@/components/dashboard/ProjectsManager";
import { TestimonialsManager } from "@/components/dashboard/TestimonialsManager";
import { InsightsManager } from "@/components/dashboard/InsightsManager";
import { PostsManager } from "@/components/dashboard/PostsManager";
import { ConsultationTypesManager } from "@/components/portfolio/ConsultationTypesManager";
import { AvailabilityManager } from "@/components/portfolio/AvailabilityManager";

type Portfolio = {
  name: string;
  title: string;
  bio: string | null;
  profileImage: string | null;
  location: string | null;
  phone: string | null;
  website: string | null;
  linkedin: string | null;
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
  tiktok: string | null;
  whatsapp: string | null;
  slug: string;
  published: boolean;
  template: string;
  theme: string;
  dashboardBackground: string | null;
  websiteBackground: string | null;
};

const emptyPortfolio: Portfolio = {
  name: "",
  title: "",
  bio: "",
  profileImage: "",
  location: "",
  phone: "",
  website: "",
  linkedin: "",
  instagram: "",
  facebook: "",
  youtube: "",
  tiktok: "",
  whatsapp: "",
  slug: "",
  published: false,
  template: "professional",
  theme: "dark",
  dashboardBackground: "",
  websiteBackground: "",
};

type PortfolioResponse = Partial<Portfolio>;

type BackgroundOption = {
  id: string;
  name: string;
  type: "COLOR" | "IMAGE";
  value: string;
  description: string | null;
  sortOrder: number;
};

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/[0.045] px-4 py-3 text-sm text-[var(--text)] outline-none backdrop-blur-xl transition duration-300 placeholder:text-white/30 hover:border-white/25 focus:border-[#126BFF]/70 focus:ring-2 focus:ring-[#126BFF]/15";

const selectClassName =
  "w-full rounded-xl border border-white/15 bg-slate-950/75 px-4 py-3 text-sm text-white outline-none backdrop-blur-xl transition duration-300 hover:border-white/25 focus:border-[#D9A441] focus:ring-2 focus:ring-[#D9A441]/15";

const labelClassName =
  "mb-2 block text-sm font-medium text-white/65";

const panelClassName =
  "rounded-3xl p-6 sm:p-8";

const panelVariants = {
  hidden: {
    opacity: 0,
    y: 24,
    scale: 0.99,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.075,
      delayChildren: 0.04,
    },
  },
};

function normalizePortfolio(
  data: PortfolioResponse
): Portfolio {
  return {
    name: data?.name ?? "",
    title: data?.title ?? "",
    bio: data?.bio ?? "",
    profileImage: data?.profileImage ?? "",
    location: data?.location ?? "",
    phone: data?.phone ?? "",
    website: data?.website ?? "",
    linkedin: data?.linkedin ?? "",
    instagram: data?.instagram ?? "",
    facebook: data?.facebook ?? "",
    youtube: data?.youtube ?? "",
    tiktok: data?.tiktok ?? "",
    whatsapp: data?.whatsapp ?? "",
    slug: data?.slug ?? "",
    published: Boolean(data?.published),
    template: data?.template ?? "professional",
    theme: data?.theme ?? "dark",
    dashboardBackground: data?.dashboardBackground ?? "",
    websiteBackground: data?.websiteBackground ?? "",
  };
}

function SectionHeading({
  eyebrow,
  title,
  description,
  accent = "blue",
}: {
  eyebrow: string;
  title: string;
  description: string;
  accent?: "blue" | "gold";
}) {
  const accentClass =
    accent === "gold"
      ? "text-[#D9A441]"
      : "text-[#5A9AFF]";

  return (
    <div>
      <p
        className={`text-xs font-semibold uppercase tracking-[0.22em] ${accentClass}`}
      >
        {eyebrow}
      </p>

      <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
        {title}
      </h2>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
        {description}
      </p>
    </div>
  );
}

function AnimatedPanel({
  children,
  className = "",
  intensity = "medium",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: "subtle" | "medium" | "strong";
  delay?: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={panelVariants}
      initial={shouldReduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.06 }}
      transition={{ delay }}
      whileHover={
        shouldReduceMotion
          ? undefined
          : {
              y: -2,
              transition: {
                duration: 0.22,
                ease: "easeOut",
              },
            }
      }
      className="min-w-0"
    >
      <LiquidLensSurface
        intensity={intensity}
        className={`${panelClassName} ${className}`}
      >
        {children}
      </LiquidLensSurface>
    </motion.div>
  );
}

export default function PortfolioEditorPage() {
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();

  const adminUserId =
    searchParams.get("adminUserId")?.trim() || "";

  const isAdminEditing = Boolean(adminUserId);

  const portfolioApiUrl = useMemo(() => {
    if (!adminUserId) {
      return "/api/portfolio";
    }

    return `/api/portfolio?adminUserId=${encodeURIComponent(
      adminUserId
    )}`;
  }, [adminUserId]);

  const [portfolio, setPortfolio] =
    useState<Portfolio>(emptyPortfolio);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");

  const [backgroundOptions, setBackgroundOptions] =
    useState<BackgroundOption[]>([]);

  const [backgroundsLoading, setBackgroundsLoading] =
    useState(true);

  const [backgroundsError, setBackgroundsError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPortfolio() {
      setLoading(true);
      setMessage("");

      try {
        const response = await fetch(portfolioApiUrl, {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          if (!cancelled) {
            setMessage(
              data.message ||
                "Unable to load the portfolio."
            );
          }
          return;
        }

        if (!data.portfolio) {
          if (!cancelled) {
            setMessage(
              "Portfolio information was not returned."
            );
          }
          return;
        }

        if (!cancelled) {
          setPortfolio(
            normalizePortfolio(data.portfolio)
          );
        }
      } catch {
        if (!cancelled) {
          setMessage("Unable to connect to the server.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPortfolio();

    return () => {
      cancelled = true;
    };
  }, [portfolioApiUrl]);

  useEffect(() => {
    let cancelled = false;

    async function loadBackgroundOptions() {
      setBackgroundsLoading(true);
      setBackgroundsError("");

      try {
        const response = await fetch(
          "/api/background-options",
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "Unable to load background presets."
          );
        }

        if (!cancelled) {
          setBackgroundOptions(data.backgrounds ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setBackgroundsError(
            error instanceof Error
              ? error.message
              : "Unable to load background presets."
          );
        }
      } finally {
        if (!cancelled) {
          setBackgroundsLoading(false);
        }
      }
    }

    loadBackgroundOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(
    field: keyof Portfolio,
    value: string | boolean
  ) {
    setPortfolio((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(portfolioApiUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...portfolio,
          ...(adminUserId ? { adminUserId } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message || "Unable to save changes."
        );
        return;
      }

      if (!data.portfolio) {
        setMessage(
          "The server saved the portfolio but did not return the updated portfolio."
        );
        return;
      }

      setPortfolio(
        normalizePortfolio(data.portfolio)
      );

      setMessage(
        isAdminEditing
          ? "User portfolio saved successfully."
          : "Portfolio saved successfully."
      );
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublishing() {
    setPublishing(true);
    setMessage("");

    const nextPublishedState = !portfolio.published;

    try {
      const response = await fetch(portfolioApiUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...portfolio,
          published: nextPublishedState,
          ...(adminUserId ? { adminUserId } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            `Unable to ${
              nextPublishedState
                ? "publish"
                : "unpublish"
            } the portfolio.`
        );
        return;
      }

      if (!data.portfolio) {
        setMessage(
          "The server changed the publishing status but did not return the updated portfolio."
        );
        return;
      }

      setPortfolio(
        normalizePortfolio(data.portfolio)
      );

      setMessage(
        data.portfolio.published
          ? isAdminEditing
            ? "The user's portfolio is now published."
            : "Your portfolio is now published."
          : isAdminEditing
            ? "The user's portfolio has been unpublished."
            : "Your portfolio has been unpublished."
      );
    } catch {
      setMessage(
        `Unable to ${
          nextPublishedState
            ? "publish"
            : "unpublish"
        } the portfolio.`
      );
    } finally {
      setPublishing(false);
    }
  }

  const isSuccessMessage =
    message.includes("successfully") ||
    message.includes("published") ||
    message.includes("unpublished");



  if (loading) {
    return (
      <main className="portfolio-editor relative isolate min-h-screen overflow-hidden px-4 py-10 text-[var(--text)] sm:px-6 sm:py-14">
        <div className="relative z-10 mx-auto flex min-h-[65vh] max-w-3xl items-center justify-center">
          <LiquidLensSurface
            intensity="strong"
            className="w-full max-w-md rounded-3xl p-8 text-center sm:p-12"
          >
            <motion.div
              initial={
                shouldReduceMotion
                  ? false
                  : { opacity: 0, scale: 0.9, y: 12 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-white/10"
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : { rotate: 360 }
                  }
                  transition={{
                    duration: 8,
                    ease: "linear",
                    repeat: Infinity,
                  }}
                />

                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#5A9AFF] border-r-[#D9A441]/70"
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : { rotate: 360 }
                  }
                  transition={{
                    duration: 1.1,
                    ease: "linear",
                    repeat: Infinity,
                  }}
                />

                <motion.div
                  className="h-3 w-3 rounded-full bg-[#5A9AFF]"
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : {
                          scale: [1, 1.35, 1],
                          opacity: [0.75, 1, 0.75],
                        }
                  }
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{
                    boxShadow:
                      "0 0 24px rgba(90,154,255,0.65)",
                  }}
                />
              </div>

              <p className="mt-7 text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                Crispus
                <span className="text-[#5A9AFF]">.</span>
              </p>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Preparing your portfolio
              </h1>

              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/45">
                Loading your professional workspace and
                retrieving your portfolio information.
              </p>

              <div className="mx-auto mt-7 h-1.5 max-w-48 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full w-1/2 rounded-full bg-[#5A9AFF]"
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : { x: ["-100%", "200%"] }
                  }
                  transition={{
                    duration: 1.35,
                    ease: "easeInOut",
                    repeat: Infinity,
                  }}
                />
              </div>
            </motion.div>
          </LiquidLensSurface>
        </div>
      </main>
    );
  }

  return (
    <motion.main
  className="portfolio-editor relative isolate min-h-screen overflow-hidden px-4 py-8 text-[var(--text)] sm:px-6 sm:py-10"
  initial={shouldReduceMotion ? false : { opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{
    duration: shouldReduceMotion ? 0 : 0.45,
    ease: "easeOut",
  }}
>
      <motion.div
        className="relative z-10 mx-auto max-w-5xl"
        variants={containerVariants}
        initial={shouldReduceMotion ? false : "hidden"}
        animate="visible"
      >
        {/* Admin notice */}
        <AnimatePresence>
          {isAdminEditing && (
            <motion.div
              key="admin-notice"
              variants={panelVariants}
              initial={
                shouldReduceMotion
                  ? false
                  : "hidden"
              }
              animate="visible"
              exit={
                shouldReduceMotion
                  ? undefined
                  : {
                      opacity: 0,
                      y: -8,
                      transition: { duration: 0.2 },
                    }
              }
              className="mb-6"
            >
              <LiquidLensSurface
                intensity="strong"
                className="rounded-2xl border border-[#D9A441]/20 p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D9A441]">
                      Super Admin Mode
                    </p>

                    <p className="mt-2 text-sm text-white/75">
                      You are managing another user&apos;s
                      professional portfolio.
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                      Changes made here apply to the selected
                      user&apos;s portfolio.
                    </p>
                  </div>

                  <motion.div
                    whileHover={
                      shouldReduceMotion
                        ? undefined
                        : { y: -2, scale: 1.015 }
                    }
                    whileTap={
                      shouldReduceMotion
                        ? undefined
                        : { scale: 0.98 }
                    }
                  >
                    <Link
                      href={`/admin/users/${adminUserId}`}
                      className="inline-flex rounded-xl border border-[#D9A441]/25 bg-[#D9A441]/10 px-4 py-2.5 text-sm text-[#D9A441] transition-colors hover:bg-[#D9A441]/20"
                    >
                      Back to User
                    </Link>
                  </motion.div>
                </div>
              </LiquidLensSurface>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.header
          variants={panelVariants}
          className="mb-10 flex flex-col gap-5 border-b border-white/10 pb-8 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <Link
              href="/"
              className="inline-flex text-2xl font-semibold tracking-tight text-white transition-opacity hover:opacity-80"
            >
              Crispus
              <span className="text-[#126BFF]">.</span>
            </Link>

            <p className="mt-2 text-sm text-white/45">
              {isAdminEditing
                ? "Super Admin Portfolio Management"
                : "Portfolio Editor"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {portfolio.slug && portfolio.published && (
              <motion.div
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : { y: -2 }
                }
                whileTap={
                  shouldReduceMotion
                    ? undefined
                    : { scale: 0.98 }
                }
              >
                <Link
                  href={`/p/${portfolio.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl border border-[#126BFF]/25 bg-[#126BFF]/10 px-4 py-2.5 text-sm text-[#77ADFF] transition-colors hover:bg-[#126BFF]/20 hover:text-white"
                >
                  View Website
                </Link>
              </motion.div>
            )}

            <motion.div
              whileHover={
                shouldReduceMotion
                  ? undefined
                  : { y: -2 }
              }
              whileTap={
                shouldReduceMotion
                  ? undefined
                  : { scale: 0.98 }
              }
            >
              <Link
                href={
                  isAdminEditing
                    ? `/admin/users/${adminUserId}`
                    : "/dashboard"
                }
                className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                {isAdminEditing
                  ? "Back to User"
                  : "Back to Dashboard"}
              </Link>
            </motion.div>
          </div>
        </motion.header>

        {/* Page introduction */}
        <motion.section
          variants={panelVariants}
          className="mb-10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#D9A441]">
            {isAdminEditing
              ? "Managed Portfolio"
              : "Your Portfolio"}
          </p>

          <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            {isAdminEditing
              ? "Manage the professional profile."
              : "Edit your professional profile."}
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-white/50 sm:text-lg sm:leading-8">
            {isAdminEditing
              ? "Manage the information and professional content belonging to this user."
              : "Manage the information and professional content that appears on your portfolio website."}
          </p>
        </motion.section>

        {/* Publishing status */}
        <AnimatedPanel
          className="mb-6"
          intensity="strong"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D9A441]">
                Website Status
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  {portfolio.published
                    ? isAdminEditing
                      ? "This website is live"
                      : "Your website is live"
                    : isAdminEditing
                      ? "This website is unpublished"
                      : "Your website is unpublished"}
                </h2>

                <motion.span
                  key={
                    portfolio.published
                      ? "published"
                      : "draft"
                  }
                  initial={
                    shouldReduceMotion
                      ? false
                      : { opacity: 0, scale: 0.85 }
                  }
                  animate={{ opacity: 1, scale: 1 }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    portfolio.published
                      ? "border-[#00C98B]/25 bg-[#00C98B]/10 text-[#00C98B]"
                      : "border-white/10 bg-white/[0.04] text-white/50"
                  }`}
                >
                  {portfolio.published
                    ? "Published"
                    : "Draft"}
                </motion.span>
              </div>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                {portfolio.published
                  ? "Visitors can access this public portfolio using its portfolio address."
                  : "This portfolio is saved privately. Publish it when it is ready for visitors to see it."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <motion.button
                type="button"
                onClick={togglePublishing}
                disabled={publishing || saving}
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : { y: -2, scale: 1.015 }
                }
                whileTap={
                  shouldReduceMotion
                    ? undefined
                    : { scale: 0.97 }
                }
                className={`rounded-xl px-5 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  portfolio.published
                    ? "border border-red-400/20 bg-red-400/10 text-red-300 hover:bg-red-400/20"
                    : "bg-[#00C98B] text-[#03130F] hover:bg-[#16d99b]"
                }`}
                style={{
                  boxShadow:
                    !portfolio.published &&
                    !publishing &&
                    !saving
                      ? "0 0 28px rgba(0,201,139,0.12)"
                      : undefined,
                }}
              >
                {publishing
                  ? portfolio.published
                    ? "Unpublishing..."
                    : "Publishing..."
                  : portfolio.published
                    ? "Unpublish Website"
                    : "Publish Website"}
              </motion.button>

              {portfolio.published && portfolio.slug && (
                <motion.div
                  whileHover={
                    shouldReduceMotion
                      ? undefined
                      : { y: -2 }
                  }
                  whileTap={
                    shouldReduceMotion
                      ? undefined
                      : { scale: 0.98 }
                  }
                >
                  <Link
                    href={`/p/${portfolio.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    View Live Website
                  </Link>
                </motion.div>
              )}
            </div>
          </div>
        </AnimatedPanel>

        {/* Main portfolio form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* Basic information */}
          <AnimatedPanel>
            <SectionHeading
              eyebrow="Identity"
              title="Basic Information"
              description="Manage your name, professional identity, introduction, profile photo, and portfolio address."
            />

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="portfolio-name"
                  className={labelClassName}
                >
                  Full Name
                </label>

                <input
                  id="portfolio-name"
                  value={portfolio.name}
                  onChange={(event) =>
                    updateField("name", event.target.value)
                  }
                  required
                  autoComplete="name"
                  className={inputClassName}
                  placeholder="Full name"
                />
              </div>

              <div>
                <label
                  htmlFor="portfolio-title"
                  className={labelClassName}
                >
                  Professional Title
                </label>

                <input
                  id="portfolio-title"
                  value={portfolio.title}
                  onChange={(event) =>
                    updateField("title", event.target.value)
                  }
                  required
                  className={inputClassName}
                  placeholder="Professional title"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="portfolio-bio"
                  className={labelClassName}
                >
                  Bio
                </label>

                <textarea
                  id="portfolio-bio"
                  value={portfolio.bio ?? ""}
                  onChange={(event) =>
                    updateField("bio", event.target.value)
                  }
                  rows={5}
                  className={`${inputClassName} resize-y leading-6`}
                  placeholder="Tell visitors about yourself..."
                />
              </div>

              <div>
                <label
                  htmlFor="portfolio-location"
                  className={labelClassName}
                >
                  Location
                </label>

                <input
                  id="portfolio-location"
                  value={portfolio.location ?? ""}
                  onChange={(event) =>
                    updateField(
                      "location",
                      event.target.value
                    )
                  }
                  autoComplete="address-level2"
                  className={inputClassName}
                  placeholder="City, Country"
                />
              </div>

              <div className="sm:col-span-2">
                <MediaUploadField
                  label="Profile Photo"
                  value={portfolio.profileImage ?? ""}
                  onChange={(value) =>
                    updateField("profileImage", value)
                  }
                  altText={
                    portfolio.name
                      ? `${portfolio.name} profile photo`
                      : "Profile photo"
                  }
                  helpText="Use a clear, professional photo. This image will be used throughout the public portfolio."
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="portfolio-slug"
                  className={labelClassName}
                >
                  Portfolio Slug
                </label>

                <input
                  id="portfolio-slug"
                  value={portfolio.slug}
                  readOnly
                  className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-white/45 outline-none"
                />

                <p className="mt-2 text-xs leading-5 text-white/35">
                  This unique address identifies the
                  portfolio. Public address management is
                  handled separately by the platform.
                </p>
              </div>
            </div>
          </AnimatedPanel>

          {/* Contact information */}
          <AnimatedPanel>
            <SectionHeading
              eyebrow="Reachability"
              title="Contact Information"
              description="Give visitors professional ways to contact you."
            />

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="portfolio-phone"
                  className={labelClassName}
                >
                  Phone
                </label>

                <input
                  id="portfolio-phone"
                  type="tel"
                  value={portfolio.phone ?? ""}
                  onChange={(event) =>
                    updateField("phone", event.target.value)
                  }
                  autoComplete="tel"
                  className={inputClassName}
                  placeholder="+254..."
                />
              </div>

              <div>
                <label
                  htmlFor="portfolio-website"
                  className={labelClassName}
                >
                  Website
                </label>

                <input
                  id="portfolio-website"
                  type="url"
                  value={portfolio.website ?? ""}
                  onChange={(event) =>
                    updateField(
                      "website",
                      event.target.value
                    )
                  }
                  className={inputClassName}
                  placeholder="https://example.com"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="portfolio-whatsapp"
                  className={labelClassName}
                >
                  WhatsApp
                </label>

                <input
                  id="portfolio-whatsapp"
                  type="url"
                  value={portfolio.whatsapp ?? ""}
                  onChange={(event) =>
                    updateField(
                      "whatsapp",
                      event.target.value
                    )
                  }
                  className={inputClassName}
                  placeholder="https://wa.me/..."
                />
              </div>
            </div>
          </AnimatedPanel>

          {/* Social profiles */}
          <AnimatedPanel>
            <SectionHeading
              eyebrow="Online Presence"
              title="Social Profiles"
              description="Connect your professional and social media profiles to your portfolio."
            />

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              {(
                [
                  ["linkedin", "LinkedIn"],
                  ["instagram", "Instagram"],
                  ["facebook", "Facebook"],
                  ["youtube", "YouTube"],
                  ["tiktok", "TikTok"],
                ] as const
              ).map(([field, label], index) => (
                <motion.div
                  key={field}
                  initial={
                    shouldReduceMotion
                      ? false
                      : { opacity: 0, y: 10 }
                  }
                  whileInView={{
                    opacity: 1,
                    y: 0,
                  }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.35,
                    delay: index * 0.055,
                  }}
                  className="min-w-0"
                >
                  <label
                    htmlFor={`portfolio-${field}`}
                    className={labelClassName}
                  >
                    {label}
                  </label>

                  <input
                    id={`portfolio-${field}`}
                    type="url"
                    value={portfolio[field] ?? ""}
                    onChange={(event) =>
                      updateField(
                        field,
                        event.target.value
                      )
                    }
                    className={inputClassName}
                    placeholder={`${label} URL`}
                  />
                </motion.div>
              ))}
            </div>
          </AnimatedPanel>

          {/* Individual design settings */}
          <AnimatedPanel intensity="strong">
            <SectionHeading
              eyebrow="Design Settings"
              title="Personalize your website"
              description="Choose the appearance of your private dashboard and public portfolio. These settings belong to this user's portfolio."
              accent="gold"
            />

            <div className="mt-7 grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="template"
                  className={labelClassName}
                >
                  Website Template
                </label>

                <select
                  id="template"
                  value={portfolio.template}
                  onChange={(event) =>
                    updateField("template", event.target.value)
                  }
                  className={selectClassName}
                >
                  <option value="professional">
                    Professional
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="theme"
                  className={labelClassName}
                >
                  Website Theme
                </label>

                <select
                  id="theme"
                  value={portfolio.theme}
                  onChange={(event) =>
                    updateField("theme", event.target.value)
                  }
                  className={selectClassName}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="sepia">Sepia</option>
                </select>
              </div>

              {/* Dashboard background */}
              <div>
                <label
                  htmlFor="dashboardBackground"
                  className={labelClassName}
                >
                  Private Dashboard Background
                </label>

                <select
                  id="dashboardBackground"
                  value={portfolio.dashboardBackground ?? ""}
                  onChange={(event) =>
                    updateField(
                      "dashboardBackground",
                      event.target.value
                    )
                  }
                  className={selectClassName}
                >
                  <option value="">Default Background</option>

                  {backgroundOptions.map((background) => (
                    <option
                      key={background.id}
                      value={background.value}
                    >
                      {background.name} (
                      {background.type === "COLOR"
                        ? "Color"
                        : "Image"}
                      )
                    </option>
                  ))}
                </select>

                <AnimatePresence mode="wait">
                  {portfolio.dashboardBackground && (
                    <motion.div
                      key={portfolio.dashboardBackground}
                      initial={
                        shouldReduceMotion
                          ? false
                          : { opacity: 0, y: 6 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.22 }}
                      className="mt-3 overflow-hidden rounded-xl border border-white/15"
                    >
                      <div
                        className="h-20"
                        style={{
                          backgroundColor:
                            portfolio.dashboardBackground.startsWith(
                              "#"
                            )
                              ? portfolio.dashboardBackground
                              : undefined,
                          backgroundImage:
                            /^https?:\/\//i.test(
                              portfolio.dashboardBackground
                            )
                              ? `url("${portfolio.dashboardBackground}")`
                              : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />

                      <p className="border-t border-white/10 bg-black/20 px-3 py-2 text-xs text-white/50">
                        Dashboard background preview
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Public website background */}
              <div>
                <label
                  htmlFor="websiteBackground"
                  className={labelClassName}
                >
                  Public Website Background
                </label>

                <select
                  id="websiteBackground"
                  value={portfolio.websiteBackground ?? ""}
                  onChange={(event) =>
                    updateField(
                      "websiteBackground",
                      event.target.value
                    )
                  }
                  className={selectClassName}
                >
                  <option value="">Default Background</option>

                  {backgroundOptions.map((background) => (
                    <option
                      key={background.id}
                      value={background.value}
                    >
                      {background.name} (
                      {background.type === "COLOR"
                        ? "Color"
                        : "Image"}
                      )
                    </option>
                  ))}
                </select>

                <AnimatePresence mode="wait">
                  {portfolio.websiteBackground && (
                    <motion.div
                      key={portfolio.websiteBackground}
                      initial={
                        shouldReduceMotion
                          ? false
                          : { opacity: 0, y: 6 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.22 }}
                      className="mt-3 overflow-hidden rounded-xl border border-white/15"
                    >
                      <div
                        className="h-20"
                        style={{
                          backgroundColor:
                            portfolio.websiteBackground.startsWith(
                              "#"
                            )
                              ? portfolio.websiteBackground
                              : undefined,
                          backgroundImage:
                            /^https?:\/\//i.test(
                              portfolio.websiteBackground
                            )
                              ? `url("${portfolio.websiteBackground}")`
                              : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />

                      <p className="border-t border-white/10 bg-black/20 px-3 py-2 text-xs text-white/50">
                        Public website background preview
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence>
              {backgroundsLoading && (
                <motion.p
                  key="background-loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-5 flex items-center gap-2 text-sm text-white/50"
                >
                  <motion.span
                    className="h-2 w-2 rounded-full bg-[#5A9AFF]"
                    animate={
                      shouldReduceMotion
                        ? undefined
                        : { opacity: [0.35, 1, 0.35] }
                    }
                    transition={{
                      duration: 1.1,
                      repeat: Infinity,
                    }}
                  />
                  Loading background library...
                </motion.p>
              )}

              {backgroundsError && (
                <motion.p
                  key="background-error"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-5 text-sm text-red-400"
                >
                  {backgroundsError}
                </motion.p>
              )}

              {!backgroundsLoading &&
                !backgroundsError &&
                backgroundOptions.length === 0 && (
                  <motion.p
                    key="background-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-5 text-sm text-white/50"
                  >
                    No enabled background presets yet. Ask
                    the Super Admin to add some.
                  </motion.p>
                )}
            </AnimatePresence>

            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-xs leading-6 text-white/45">
                Your choices are saved when you click the Save
                button below. The dashboard and public website
                must also apply these settings to display the
                selected backgrounds.
              </p>
            </div>
          </AnimatedPanel>

          {/* Sticky save bar */}
          <motion.div
            className="sticky bottom-4 z-20"
            initial={
              shouldReduceMotion
                ? false
                : { opacity: 0, y: 14 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.12,
            }}
          >
            <LiquidLensSurface
              intensity="strong"
              className="rounded-2xl p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <AnimatePresence mode="wait">
                    {message ? (
                      <motion.p
                        key={message}
                        initial={
                          shouldReduceMotion
                            ? false
                            : { opacity: 0, y: 5 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className={`text-sm leading-6 ${
                          isSuccessMessage
                            ? "text-[#00C98B]"
                            : "text-red-400"
                        }`}
                        role="status"
                        aria-live="polite"
                      >
                        {message}
                      </motion.p>
                    ) : (
                      <motion.p
                        key="save-guidance"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs leading-5 text-white/45"
                      >
                        {isAdminEditing
                          ? "Save the user's portfolio before leaving this page."
                          : "Save your profile information before leaving this page."}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <motion.button
                  type="submit"
                  disabled={saving || publishing}
                  whileHover={
                    shouldReduceMotion ||
                    saving ||
                    publishing
                      ? undefined
                      : {
                          y: -2,
                          scale: 1.015,
                        }
                  }
                  whileTap={
                    shouldReduceMotion
                      ? undefined
                      : { scale: 0.98 }
                  }
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#126BFF] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2477ff] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    boxShadow:
                      saving || publishing
                        ? undefined
                        : "0 4px 24px rgba(18,107,255,0.18)",
                  }}
                >
                  {saving && (
                    <motion.span
                      className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                      animate={
                        shouldReduceMotion
                          ? undefined
                          : { rotate: 360 }
                      }
                      transition={{
                        duration: 0.8,
                        ease: "linear",
                        repeat: Infinity,
                      }}
                    />
                  )}

                  {saving
                    ? "Saving..."
                    : isAdminEditing
                      ? "Save User Portfolio"
                      : "Save Changes"}
                </motion.button>
              </div>
            </LiquidLensSurface>
          </motion.div>
        </form>

        {/* Portfolio content management */}
        <motion.section
          variants={panelVariants}
          className="mt-14 space-y-8"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#D9A441]">
              Portfolio Content
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {isAdminEditing
                ? "Manage this professional website."
                : "Build your professional website."}
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/45 sm:text-base">
              Manage the content that powers each section of
              the public portfolio. Changes are connected to
              the portfolio engine and displayed through the
              professional website.
            </p>
          </div>

          <motion.div
            variants={containerVariants}
            initial={shouldReduceMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.025 }}
            className="space-y-8"
          >
            <motion.div variants={panelVariants}>
              <ServicesManager />
            </motion.div>

            <motion.div variants={panelVariants}>
              <ExperienceManager />
            </motion.div>

            <motion.div variants={panelVariants}>
              <SkillsManager />
            </motion.div>

            <motion.div variants={panelVariants}>
              <ProjectsManager />
            </motion.div>

            <motion.div variants={panelVariants}>
              <TestimonialsManager />
            </motion.div>

            <motion.div variants={panelVariants}>
              <InsightsManager />
            </motion.div>

            <motion.div variants={panelVariants}>
              <PostsManager />
            </motion.div>

            <motion.div variants={panelVariants}>
              <ConsultationTypesManager
                adminUserId={adminUserId}
              />
            </motion.div>

            <motion.div variants={panelVariants}>
              <AvailabilityManager
                adminUserId={adminUserId}
              />
            </motion.div>
          </motion.div>
        </motion.section>
      </motion.div>
    </motion.main>
  );
}