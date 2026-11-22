
"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  Activity,
  ChevronLeft,
  Command,
  Images,
  LayoutDashboard,
  Menu,
  MonitorCog,
  PanelsTopLeft,
  ShieldCheck,
  ScrollText,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import styles from "./AdminShell.module.css";
import { useAdminReducedMotion } from "./useAdminReducedMotion";

type NavigationProps = Readonly<{
  children: ReactNode;
  administratorName: string;
}>;

const navigationGroups = [
  {
    label: "Overview",
    links: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    label: "People & Access",
    links: [
      { label: "All Accounts", href: "/admin/accounts", icon: UsersRound },
      { label: "Sessions & Devices", href: "/admin/sessions", icon: ShieldCheck },
    ],
  },
  {
    label: "Content & Experience",
    links: [
      {
        label: "Welcome Page Editor",
        href: "/admin/backgrounds/welcome-page",
        icon: PanelsTopLeft,
      },
      {
        label: "Background Library",
        href: "/admin/backgrounds",
        icon: Images,
      },
      {
        label: "Display Studio",
        href: "/admin#display-studio",
        icon: MonitorCog,
      },
    ],
  },
  {
    label: "Insights & Governance",
    links: [
      { label: "Audit History", href: "/admin/audit", icon: ScrollText },
      { label: "Platform Operations", href: "/admin/operations", icon: Activity },
    ],
  },
] as const;

const pageTitles: ReadonlyArray<readonly [string, string]> = [
  ["/admin/accounts", "All Accounts"],
  ["/admin/sessions", "Sessions & Devices"],
  ["/admin/backgrounds/welcome-page", "Welcome Page Editor"],
  ["/admin/backgrounds", "Background Library"],
  ["/admin/audit", "Audit History"],
  ["/admin/operations", "Platform Operations"],
  ["/admin/users", "Account Overview"],
];

function isCurrentDestination(
  pathname: string,
  href: string,
  hash: string,
) {
  if (href === "/admin#display-studio") {
    return pathname === "/admin" && hash === "#display-studio";
  }

  if (href === "/admin") {
    return pathname === "/admin" && hash !== "#display-studio";
  }

  if (href === "/admin/accounts") {
    return (
      pathname === href ||
      pathname.startsWith("/admin/users/")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPageTitle(pathname: string, hash: string) {
  if (pathname === "/admin" && hash === "#display-studio") {
    return "Display Studio";
  }

  if (pathname === "/admin") {
    return "Command Centre";
  }

  return (
    pageTitles.find(
      ([route]) => pathname === route || pathname.startsWith(`${route}/`),
    )?.[1] ??
    (pathname.startsWith("/admin/users/")
      ? "Account Overview"
      : "Super Admin")
  );
}

export function AdminNavigation({
  children,
  administratorName,
}: NavigationProps) {
  const pathname = usePathname();
  const shouldReduceMotion = useAdminReducedMotion();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [activeHash, setActiveHash] = useState("");
  const [appearance, setAppearance] = useState<"dark" | "light">("dark");

  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = document.documentElement;

    const updateRootPreferences = () => {
      setActiveHash(window.location.hash);
      setAppearance(
        root.dataset.theme === "dark" ? "dark" : "light",
      );
    };

    updateRootPreferences();

    window.addEventListener("hashchange", updateRootPreferences);

    const observer = new MutationObserver(updateRootPreferences);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      window.removeEventListener("hashchange", updateRootPreferences);
      observer.disconnect();
    };
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const trigger = mobileTriggerRef.current;

    const dialog = document.getElementById("admin-mobile-navigation");
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    focusable?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }

      if (event.key !== "Tab" || !focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [mobileOpen]);

  const pageTitle = getPageTitle(pathname, activeHash);
  const motionDuration = shouldReduceMotion ? 0 : 0.24;

  const renderLinks = (mobile = false) => (
    <div className={styles.navigationGroups}>
      {navigationGroups.map((group) => (
        <section
          className={styles.navigationGroup}
          key={group.label}
          aria-label={group.label}
        >
          <h2
            className={`${styles.groupLabel} ${
              collapsed && !mobile ? styles.groupLabelCollapsed : ""
            }`}
          >
            {group.label}
          </h2>

          <div className={styles.linkStack}>
            {group.links.map((item) => {
              const active = isCurrentDestination(
                pathname,
                item.href,
                activeHash,
              );

              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (mobile) setMobileOpen(false);
                  }}
                  aria-label={
                    collapsed && !mobile ? item.label : undefined
                  }
                  aria-current={active ? "page" : undefined}
                  title={
                    collapsed && !mobile ? item.label : undefined
                  }
                  className={`${styles.navigationLink} ${
                    active ? styles.navigationLinkActive : ""
                  } ${
                    collapsed && !mobile
                      ? styles.navigationLinkCollapsed
                      : ""
                  }`}
                >
                  <Icon
                    aria-hidden="true"
                    size={18}
                    strokeWidth={1.8}
                  />

                  {(!collapsed || mobile) && <span>{item.label}</span>}

                  {active && (
                    <span
                      className={styles.activeMarker}
                      aria-hidden="true"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  const desktopWidth = collapsed ? "xl:w-[5.75rem]" : "xl:w-[17rem]";
  const contentOffset = collapsed
    ? "xl:pl-[6.5rem]"
    : "xl:pl-[18rem]";

  return (
    <div
      className={styles.shell}
      data-admin-theme={appearance}
    >
      <div
        aria-hidden="true"
        className={styles.ambientLight}
      />

      <motion.aside
        animate={{ width: collapsed ? 92 : 272 }}
        transition={{
          duration: motionDuration,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={`fixed inset-y-4 left-4 z-30 hidden ${desktopWidth} xl:block`}
      >
        <LiquidLensSurface
          className={styles.sidebarSurface}
          intensity="medium"
          radius={28}
        >
          <div className={styles.brandRow}>
            <Link
              href="/admin"
              aria-label="Crispus home"
              className={styles.brandMark}
            >
              <Command
                size={21}
                strokeWidth={1.7}
                aria-hidden="true"
              />
            </Link>

            {!collapsed && (
              <div className={styles.brandCopy}>
                <span className={styles.brandTitle}>CRISPUS</span>
                <span className={styles.brandSubtitle}>
                  CONTROL CENTRE
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={
                collapsed ? "Expand navigation" : "Collapse navigation"
              }
              aria-expanded={!collapsed}
              aria-controls="admin-desktop-navigation"
              className={`${styles.collapseButton} ${
                collapsed ? styles.collapseButtonCollapsed : ""
              }`}
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.adminIdentity}>
            <span className={styles.identityOrb} aria-hidden="true">
              {administratorName.trim().charAt(0).toUpperCase() || "S"}
            </span>

            {!collapsed && (
              <span className={styles.identityCopy}>
                <span className={styles.identityName}>
                  {administratorName || "Super Admin"}
                </span>
                <span className={styles.identityRole}>
                  Super Administrator
                </span>
              </span>
            )}
          </div>

          <nav
            id="admin-desktop-navigation"
            aria-label="Super Admin navigation"
            className={styles.sidebarNav}
          >
            {renderLinks()}
          </nav>

          <div className={styles.sidebarFooter}>
            <Link
              href="/dashboard/workspace"
              className={`${styles.workspaceLink} ${
                collapsed ? styles.workspaceLinkCollapsed : ""
              }`}
            >
              <ArrowUpRight size={17} aria-hidden="true" />
              {!collapsed && <span>My Personal Workspace</span>}
            </Link>

            {!collapsed && (
              <p className={styles.footerCaption}>
                Administrative workspace
              </p>
            )}
          </div>
        </LiquidLensSurface>
      </motion.aside>

      <div
        className={`min-h-screen transition-[padding] duration-300 ${contentOffset}`}
      >
        <header className={styles.topBar}>
          <button
            ref={mobileTriggerRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open admin navigation"
            aria-expanded={mobileOpen}
            aria-controls="admin-mobile-navigation"
            className={styles.mobileMenuButton}
          >
            <Menu size={19} aria-hidden="true" />
          </button>

          <div className={styles.pageContext}>
            <span className={styles.contextEyebrow}>SUPER ADMIN</span>
            <span className={styles.contextTitle}>{pageTitle}</span>
          </div>

          <div className={styles.topBarActions}>
            <span className={styles.sessionPill}>
              <span aria-hidden="true" />
              Administrator session
            </span>

            <Link
              href="/dashboard/workspace"
              className={styles.topDashboardLink}
            >
              My Personal Workspace
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </header>

        <div className={styles.contentFrame}>{children}</div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className={styles.mobileLayer}
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: motionDuration }}
          >
            <button
              className={styles.mobileScrim}
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            />

            <motion.aside
              id="admin-mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="Super Admin navigation"
              initial={
                shouldReduceMotion ? false : { x: -28, opacity: 0.8 }
              }
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -28, opacity: 0.8 }}
              transition={{
                duration: motionDuration,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={styles.mobileDrawer}
            >
              <LiquidLensSurface
                className={styles.mobileDrawerSurface}
                intensity="medium"
                radius={26}
              >
                <div className={styles.mobileDrawerHeader}>
                  <div className={styles.brandRow}>
                    <span className={styles.brandMark}>
                      <Command size={20} aria-hidden="true" />
                    </span>

                    <div className={styles.brandCopy}>
                      <span className={styles.brandTitle}>CRISPUS</span>
                      <span className={styles.brandSubtitle}>
                        CONTROL CENTRE
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close admin navigation"
                    className={styles.collapseButton}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>

                <div className={styles.mobileIdentity}>
                  {administratorName || "Super Admin"}
                  <span>Super Administrator</span>
                </div>

                <nav
                  aria-label="Super Admin navigation"
                  className={styles.mobileNav}
                >
                  {renderLinks(true)}
                </nav>

                <Link
                  href="/dashboard/workspace"
                  onClick={() => setMobileOpen(false)}
                  className={styles.workspaceLink}
                >
                  <ArrowUpRight size={17} aria-hidden="true" />
                  <span>My Personal Workspace</span>
                </Link>
              </LiquidLensSurface>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
