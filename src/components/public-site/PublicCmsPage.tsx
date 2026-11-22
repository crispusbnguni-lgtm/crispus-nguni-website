
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import WelcomePageBackground from "@/components/welcome-page/WelcomePageBackground";
import { loadPublicPage } from "@/lib/public-page-data";
import type { PublicSitePageKey } from "@/lib/public-site-pages";
import { LensGlass } from "@/components/ui/LensGlass";
import type { CSSProperties } from "react";

export async function PublicCmsPage({
  pageKey,
}: {
  pageKey: PublicSitePageKey;
}) {
  const {
    content,
    backgroundImage,
    backgroundPosition,
    backgroundColor,
  } = await loadPublicPage(pageKey);

  return (
    <main
      className="crispus-public-page public-cms-page relative isolate min-h-screen overflow-x-clip text-white"
      style={
        {
          backgroundColor: "var(--bg)",
          "--cms-accent": content.accentColor,
        } as CSSProperties
      }
    >
      <WelcomePageBackground
        backgroundImage={backgroundImage}
        backgroundColor={backgroundColor}
        backgroundPosition={backgroundPosition}
      />

      <Navbar />

      <article className="reader-content relative z-10 mx-auto max-w-7xl px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
        <header className="mx-auto max-w-4xl text-center">
          <p
            className="text-sm font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--public-accent)" }}
          >
            {content.eyebrow}
          </p>

          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
            {content.title}
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-white/75 sm:text-xl">
            {content.subtitle}
          </p>

          <LensGlass className="mt-8 inline-flex rounded-2xl" radius={18}>
            <Link
              href={content.ctaHref}
              className="public-cms-cta inline-flex min-h-12 items-center rounded-2xl px-6 py-3 font-semibold text-white ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {content.ctaLabel}
            </Link>
          </LensGlass>
        </header>

        <div className="mx-auto mt-16 grid max-w-5xl gap-5">
          {content.sections
            .filter((item) => item.visible)
            .map((section) => (
              <LensGlass
                key={section.id}
                className="public-cms-section rounded-3xl p-6 shadow-xl sm:p-9"
                radius={28}
              >
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {section.title}
                </h2>

                {section.body && (
                  <p className="mt-4 max-w-4xl whitespace-pre-line leading-8 text-white/75">
                    {section.body}
                  </p>
                )}

                {section.mediaUrl && (
                  <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-2xl">
                    <Image
                      src={section.mediaUrl}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 100vw, 1024px"
                      className="object-cover"
                    />
                  </div>
                )}

                {section.items.length > 0 && (
                  <div
                    className={`mt-7 grid gap-4 ${
                      section.kind === "steps"
                        ? "md:grid-cols-2"
                        : "sm:grid-cols-2"
                    }`}
                  >
                    {section.items.map((item, index) => (
                      <LensGlass
                        key={`${section.id}-${index}`}
                        className="public-cms-card rounded-2xl p-5"
                        radius={20}
                      >
                        {section.kind === "steps" && (
                          <span className="text-xs font-semibold text-[var(--public-accent)]">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        )}

                        <h3 className="mt-1 font-semibold">{item.title}</h3>

                        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-white/70">
                          {item.body}
                        </p>
                      </LensGlass>
                    ))}
                  </div>
                )}
              </LensGlass>
            ))}
        </div>

        {pageKey === "contact" &&
          (content.contactEmail ||
            content.contactPhone ||
            content.contactLocation) && (
            <LensGlass
              className="public-cms-section mx-auto mt-8 max-w-5xl rounded-3xl p-6 sm:p-8"
              radius={28}
            >
              <h2 className="text-xl font-semibold">Contact details</h2>

              <div className="mt-4 flex flex-col gap-3 text-white/80 sm:flex-row sm:flex-wrap sm:gap-6">
                {content.contactEmail && (
                  <a
                    className="underline underline-offset-4"
                    href={`mailto:${content.contactEmail}`}
                  >
                    {content.contactEmail}
                  </a>
                )}

                {content.contactPhone && (
                  <a
                    className="underline underline-offset-4"
                    href={`tel:${content.contactPhone.replace(/[^+\d]/g, "")}`}
                  >
                    {content.contactPhone}
                  </a>
                )}

                {content.contactLocation && (
                  <span>{content.contactLocation}</span>
                )}
              </div>
            </LensGlass>
          )}
      </article>
    </main>
  );
}
