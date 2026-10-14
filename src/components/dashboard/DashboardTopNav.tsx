
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigationItems = [
  { label: "Overview", href: "/dashboard", number: "01" },
  { label: "Portfolio", href: "/dashboard/portfolio", number: "02" },
  { label: "Leads", href: "/dashboard/leads", number: "03" },
  {
    label: "Consultations",
    href: "/dashboard/consultations",
    number: "04",
  },
];

export function DashboardTopNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav
      aria-label="Workspace navigation"
      className="liquid-glass sticky top-0 z-50 rounded-none border-x-0 border-t-0 !border-b !border-white/10"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[76px] items-center justify-between gap-4">
          {/* Brand */}
          <Link
            href="/dashboard"
            aria-label="Crispus workspace home"
            onClick={() => setMenuOpen(false)}
            className="group flex shrink-0 items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"
          >
            <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl transition duration-300 group-hover:border-[#D9A441]/60 group-hover:bg-[#D9A441]/10">
              <span className="absolute inset-0 bg-gradient-to-br from-white/[0.12] to-transparent" />
              <span className="relative text-lg font-black tracking-tight text-white">
                C<span className="text-[#D9A441]">.</span>
              </span>
            </span>

            <span className="flex flex-col">
              <span className="text-sm font-bold tracking-wide text-white">
                Crispus<span className="text-[#D9A441]">.</span>
              </span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
                Workspace
              </span>
            </span>
          </Link>

          {/* Desktop navigation */}
          <div className="hidden items-center gap-1.5 md:flex">
            {navigationItems.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex items-center gap-2 overflow-hidden rounded-2xl border px-4 py-3 text-sm font-semibold outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#D9A441] ${
                    isActive
                      ? "border-[#D9A441]/35 bg-[#D9A441]/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]"
                      : "border-transparent text-white/60 hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#D9A441] to-transparent" />
                  )}

                  <span
                    className={`text-[10px] tabular-nums transition-colors ${
                      isActive
                        ? "text-[#D9A441]"
                        : "text-white/30 group-hover:text-white/60"
                    }`}
                  >
                    {item.number}
                  </span>

                  <span>{item.label}</span>

                  {isActive && (
                    <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#D9A441] shadow-[0_0_10px_rgba(217,164,65,0.7)]" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label={
              menuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={menuOpen}
            aria-controls="dashboard-mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className="group relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl transition duration-300 hover:border-[#D9A441]/50 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] md:hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent" />

            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className={`relative h-5 w-5 transition-transform duration-300 ${
                menuOpen ? "rotate-90" : "rotate-0"
              }`}
            >
              {menuOpen ? (
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Niagara-inspired cascading mobile navigation */}
        <div
          id="dashboard-mobile-navigation"
          aria-hidden={!menuOpen}
          className={`grid transition-[grid-template-rows,opacity,padding] duration-300 ease-out md:hidden ${
            menuOpen
              ? "grid-rows-[1fr] pb-4 opacity-100"
              : "pointer-events-none grid-rows-[0fr] pb-0 opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="liquid-glass overflow-hidden rounded-3xl border border-white/10 bg-[#080B14]/90 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
              <div className="px-3 pb-2 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
                  Workspace navigation
                </p>
              </div>

              <div className="flex flex-col gap-1">
                {navigationItems.map((item, index) => {
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      tabIndex={menuOpen ? 0 : -1}
                      style={{
                        transitionDelay: menuOpen
                          ? `${index * 45}ms`
                          : "0ms",
                      }}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-3.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] ${
                        menuOpen
                          ? "translate-y-0 opacity-100"
                          : "-translate-y-2 opacity-0"
                      } ${
                        isActive
                          ? "border-[#D9A441]/30 bg-[#D9A441]/[0.12] text-white"
                          : "border-transparent text-white/65 hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-bold tabular-nums ${
                          isActive
                            ? "border-[#D9A441]/30 bg-[#D9A441]/10 text-[#D9A441]"
                            : "border-white/10 bg-white/[0.04] text-white/45"
                        }`}
                      >
                        {item.number}
                      </span>

                      <span className="flex-1 text-sm font-semibold">
                        {item.label}
                      </span>

                      {isActive ? (
                        <span className="h-2 w-2 rounded-full bg-[#D9A441] shadow-[0_0_12px_rgba(217,164,65,0.65)]" />
                      ) : (
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-4 w-4 text-white/30"
                        >
                          <path
                            d="m9 18 6-6-6-6"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </Link>
                  );
                })}
              </div>

              <div className="mx-2 mt-2 border-t border-white/[0.08] pt-3">
                <p className="px-1 text-[10px] leading-relaxed text-white/35">
                  Your workspace. Your work. One place.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}