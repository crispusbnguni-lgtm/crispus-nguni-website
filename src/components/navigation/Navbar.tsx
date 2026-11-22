
"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  House,
  Info,
  LogIn,
  Mail,
  UserPlus,
  BriefcaseBusiness,
  Workflow,
  Menu,
  X,
} from "lucide-react";
import { LensGlass } from "@/components/ui/LensGlass";
import type { WelcomePageGlassSettings } from "@/lib/welcome-page";
import { useReader } from "@/components/ui/ReaderProvider";
import { DisplayStudioControlCentre } from "@/components/navigation/DisplayStudioControlCentre";

const links = [
  { label: "Explore portfolios", href: "/explore", Icon: Compass },
  { label: "About Crispus", href: "/about", Icon: Info },
  { label: "How it works", href: "/how-it-works", Icon: Workflow },
  { label: "Services", href: "/services", Icon: BriefcaseBusiness },
  { label: "Contact", href: "/contact", Icon: Mail },
];

function IconLink({
  href,
  label,
  active,
  children,
  onClick,
  className = "",
}: {
  href: string;
  label: string;
  active: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      data-tooltip={label}
      className={`navbar-icon-control ${active ? "navbar-icon-control-active" : ""} ${className}`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </Link>
  );
}

function SignupIcon({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <IconLink
      href="/signup"
      label="Create account"
      active={active}
      onClick={onClick}
      className="navbar-icon-signup"
    >
      <UserPlus aria-hidden="true" />
    </IconLink>
  );
}

export function Navbar({
  glassConfig,
}: {
  glassConfig?: WelcomePageGlassSettings;
} = {}) {
  const [open, setOpen] = useState(false);
  const mobileMenuButton = useRef<HTMLButtonElement>(null);
  const { preferences } = useReader();
  const pathname = usePathname() ?? "/";

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  const glassLevel = preferences.glassLevel;
  const transparencyLevel = preferences.transparency;

  const glassStyle = {
    "--navbar-glass-blur": `${Math.round(8 + preferences.frostLevel * 32)}px`,
    "--navbar-glass-tint": 0.025 + (1 - transparencyLevel) * 0.2,
    "--navbar-glass-saturation": `${120 + glassLevel * 60}%`,
  } as CSSProperties;

  useEffect(() => {
    const menuButton = mobileMenuButton.current;

    if (!open) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    const menu = document.getElementById("public-mobile-navigation");
    menu?.querySelector<HTMLAnchorElement>("a[href]")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      menuButton?.focus();
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  const items = [
    { label: "Home", href: "/", Icon: House },
    ...links,
    { label: "Sign in", href: "/login", Icon: LogIn },
  ];

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="navbar-liquid-glass" style={glassStyle}>
        <nav
          aria-label="Main navigation"
          className="mx-auto w-full max-w-7xl overflow-visible"
        >
          <LensGlass
            className="navbar-glass w-full"
            radius={glassConfig?.radius ?? 22}
            glassConfig={glassConfig}
            style={{
              overflow: "visible",
              background: `color-mix(in srgb, var(--surface) ${(0.025 + (1 - transparencyLevel) * 0.2) * 100}%, transparent)`,
              border: "1px solid var(--liquid-edge, var(--border))",
              boxShadow:
                "inset 0 1px 0 var(--liquid-highlight, rgba(255,255,255,0.12)), 0 12px 36px rgba(0,0,0,0.12)",
            }}
          >
            <div className="relative flex h-[62px] items-center justify-between gap-3 px-3 sm:h-[68px] sm:px-5">
              <Link
                href="/"
                onClick={closeMenu}
                aria-label="Crispus home"
                aria-current={pathname === "/" ? "page" : undefined}
                className="navbar-brand group relative z-10 inline-flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl"
              >
                <House size={19} aria-hidden="true" />
                <span>
                  Crispus
                  <span className="text-[#126BFF] transition-colors duration-300 group-hover:text-[#D9A441]">
                    .
                  </span>
                </span>
              </Link>

              <div
                className="navbar-desktop-actions hidden items-center lg:flex"
                aria-label="Public destinations"
              >
                {links.map(({ label, href, Icon }) => (
                  <IconLink
                    key={href}
                    href={href}
                    label={label}
                    active={isActive(href)}
                    onClick={closeMenu}
                  >
                    <Icon aria-hidden="true" />
                  </IconLink>
                ))}

                <DisplayStudioControlCentre className="navbar-icon-control" />

                <IconLink
                  href="/login"
                  label="Sign in"
                  active={isActive("/login")}
                  onClick={closeMenu}
                >
                  <LogIn aria-hidden="true" />
                </IconLink>

                <SignupIcon
                  active={isActive("/signup")}
                  onClick={closeMenu}
                />
              </div>

              <div className="flex shrink-0 items-center gap-2 lg:hidden">
                <button
                  ref={mobileMenuButton}
                  type="button"
                  onClick={() => setOpen((current) => !current)}
                  className="navbar-menu-button"
                  aria-label={
                    open ? "Close navigation menu" : "Open navigation menu"
                  }
                  aria-expanded={open}
                  aria-controls="public-mobile-navigation"
                >
                  {open ? (
                    <X aria-hidden="true" size={20} />
                  ) : (
                    <Menu aria-hidden="true" size={20} />
                  )}
                </button>
              </div>
            </div>
          </LensGlass>

          {open && (
            <LensGlass
              className="navbar-waterfall"
              radius={22}
              glassConfig={glassConfig}
              style={{ overflow: "visible" }}
            >
              <div
                id="public-mobile-navigation"
                aria-label="Public navigation"
                className="navbar-mobile-icon-grid"
              >
                {items.map(({ label, href, Icon }) => (
                  <IconLink
                    key={href}
                    href={href}
                    label={label}
                    active={isActive(href)}
                    onClick={closeMenu}
                  >
                    <Icon aria-hidden="true" />
                  </IconLink>
                ))}

                <DisplayStudioControlCentre
                  mobile
                  className="navbar-icon-control"
                  onClose={closeMenu}
                />

                <SignupIcon
                  active={isActive("/signup")}
                  onClick={closeMenu}
                />
              </div>
            </LensGlass>
          )}
        </nav>
      </div>
    </header>
  );
}
