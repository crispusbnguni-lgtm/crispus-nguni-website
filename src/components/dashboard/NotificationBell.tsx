
"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  success: boolean;
  notifications?: NotificationItem[];
  unreadCount?: number;
  message?: string;
};

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const panelTransition = {
  type: "spring" as const,
  stiffness: 360,
  damping: 30,
  mass: 0.8,
};

export function NotificationBell() {
  const reduceMotion = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    NotificationItem[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);


  const panelRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  const [panelPosition, setPanelPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  

  const positionPanel = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const panelWidth = Math.min(384, window.innerWidth - 32);

    const left = Math.max(
      16,
      Math.min(
        rect.right - panelWidth,
        window.innerWidth - panelWidth - 16,
      ),
    );

    const panelHeight = dropdownRef.current?.offsetHeight ?? 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenAbove =
      spaceBelow < Math.min(panelHeight, 320) + 16 &&
      rect.top > spaceBelow;

    const top = shouldOpenAbove
      ? Math.max(16, rect.top - panelHeight - 8)
      : Math.min(
          rect.bottom + 8,
          window.innerHeight - 100,
        );

    setPanelPosition({ top, left });
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/notifications", {
        method: "GET",
        cache: "no-store",
      });

      const data =
        (await response.json()) as NotificationsResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load notifications.",
        );
      }

      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load notifications.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    

    positionPanel();

    const frame = window.requestAnimationFrame(positionPanel);

    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [open, positionPanel]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        panelRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }

      restoreFocusRef.current = false;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        restoreFocusRef.current = true;
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open && restoreFocusRef.current) {
      triggerRef.current?.focus();
      restoreFocusRef.current = false;
    }
  }, [open]);

  async function updateReadStatus(
    action: "mark-read" | "mark-all-read",
    notificationId?: string,
  ) {
    setUpdating(true);
    setError("");

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ...(notificationId ? { notificationId } : {}),
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        message?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to update notification.",
        );
      }

      const now = new Date().toISOString();

      if (action === "mark-all-read") {
        setNotifications((current) =>
          current.map((notification) => ({
            ...notification,
            readAt: notification.readAt ?? now,
          })),
        );

        setUnreadCount(0);
      } else if (notificationId) {
        const notification = notifications.find(
          (item) => item.id === notificationId,
        );

        setNotifications((current) =>
          current.map((item) =>
            item.id === notificationId
              ? {
                  ...item,
                  readAt: item.readAt ?? now,
                }
              : item,
          ),
        );

        if (notification && !notification.readAt) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update notifications.",
      );
    } finally {
      setUpdating(false);
    }
  }

  function handleNotificationClick(
    notification: NotificationItem,
  ) {
    if (!notification.readAt) {
      void updateReadStatus("mark-read", notification.id);
    }

    setOpen(false);
  }

  const motionTransition = reduceMotion
    ? { duration: 0 }
    : panelTransition;

  return (
    <div className="relative" ref={panelRef}>
      <motion.button
        type="button"
        ref={triggerRef}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          const nextOpen = !open;

          if (nextOpen) {
            positionPanel();
            setOpen(true);
            void loadNotifications();
          } else {
            setOpen(false);
          }
        }}
        whileHover={reduceMotion ? undefined : { scale: 1.055 }}
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        transition={motionTransition}
        className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.13] bg-white/[0.055] text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_4px_14px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-colors duration-300 hover:border-[#D9A441]/50 hover:bg-white/[0.11] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]/60"
      >
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/[0.12] via-transparent to-[#D9A441]/[0.07]"
          animate={
            reduceMotion
              ? undefined
              : { opacity: open ? 1 : 0.45 }
          }
        />

        <motion.svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="relative z-10 h-5 w-5"
          animate={
            reduceMotion
              ? undefined
              : open
                ? { rotate: 0 }
                : { rotate: [0, -5, 5, -3, 0] }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : open
                ? motionTransition
                : {
                    duration: 0.7,
                    ease: "easeInOut",
                    repeat: unreadCount > 0 ? Infinity : 0,
                    repeatDelay: 5,
                  }
          }
        >
          <path
            d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 21h4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </motion.svg>

        <AnimatePresence initial={false}>
          {unreadCount > 0 && (
            <motion.span
              key="unread-count"
              initial={
                reduceMotion
                  ? false
                  : { opacity: 0, scale: 0.4, y: 3 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.5, y: -2 }
              }
              transition={motionTransition}
              className="absolute -right-1 -top-1 z-20 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#101116] bg-gradient-to-br from-[#F2D18A] via-[#D9A441] to-[#B98224] px-1 text-[10px] font-bold text-[#17130B] shadow-lg shadow-[#D9A441]/25"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={dropdownRef}
                key="notification-panel"
                initial={
                  reduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: -12,
                        scale: 0.96,
                        filter: "blur(6px)",
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  filter: "blur(0px)",
                }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        y: -6,
                        scale: 0.98,
                        filter: "blur(3px)",
                      }
                }
                transition={motionTransition}
                onAnimationComplete={positionPanel}
                style={{
                  position: "fixed",
                  top: panelPosition?.top ?? 64,
                  left: panelPosition?.left ?? 16,
                  transformOrigin: "top right",
                  zIndex: 99999,
                  visibility: panelPosition ? "visible" : "hidden",
                  willChange: reduceMotion
                    ? "auto"
                    : "transform, opacity, filter",
                }}
                className="w-[min(24rem,calc(100vw-2rem))]"
              >
                <LiquidLensSurface
                  radius={24}
                  intensity="strong"
                  className="notification-glass-panel"
                >
                  <section
                    role="dialog"
                    aria-label="Notifications"
                    aria-modal="false"
                    className="overflow-hidden rounded-3xl"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.10] px-4 py-4">
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold tracking-wide text-white">
                          Notifications
                        </h2>

                        <p className="mt-1 text-xs text-white/50">
                          {unreadCount === 0
                            ? "You’re all caught up"
                            : `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
                        </p>
                      </div>

                      <AnimatePresence initial={false}>
                        {unreadCount > 0 && (
                          <motion.button
                            key="mark-all-read"
                            type="button"
                            disabled={updating}
                            initial={
                              reduceMotion
                                ? false
                                : { opacity: 0, x: 8 }
                            }
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 5 }}
                            transition={motionTransition}
                            whileHover={
                              reduceMotion ? undefined : { y: -1 }
                            }
                            whileTap={
                              reduceMotion ? undefined : { scale: 0.97 }
                            }
                            onClick={() =>
                              void updateReadStatus("mark-all-read")
                            }
                            className="shrink-0 rounded-xl border border-[#D9A441]/20 bg-[#D9A441]/[0.07] px-3 py-2 text-xs font-medium text-[#F0D49A] transition-colors hover:border-[#D9A441]/40 hover:bg-[#D9A441]/[0.14] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]/60 disabled:opacity-50"
                          >
                            Mark all read
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>

                    <AnimatePresence initial={false}>
                      {error && (
                        <motion.div
                          key="notification-error"
                          role="alert"
                          initial={
                            reduceMotion
                              ? false
                              : { opacity: 0, height: 0 }
                          }
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={motionTransition}
                          className="overflow-hidden"
                        >
                          <div className="border-b border-red-300/15 bg-red-400/[0.08] px-4 py-3 text-xs leading-5 text-red-100">
                            {error}

                            <button
                              type="button"
                              onClick={() => void loadNotifications()}
                              className="ml-2 font-medium text-[#F0D49A] underline underline-offset-2 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60"
                            >
                              Retry
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>


<div
  className="notification-content-frost max-h-[min(28rem,65vh)] overflow-y-auto overscroll-contain"
  role="status"
  aria-live="polite"
  aria-atomic="false"
>
                      <AnimatePresence mode="wait" initial={false}>
                        {loading && notifications.length === 0 ? (
                          <motion.div
                            key="loading"
                            initial={
                              reduceMotion
                                ? false
                                : { opacity: 0, y: 5 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={motionTransition}
                            className="px-4 py-10 text-center"
                          >
                            <motion.span
                              aria-hidden="true"
                              className="mx-auto block h-6 w-6 rounded-full border-2 border-white/15 border-t-[#E7BD68]"
                              animate={
                                reduceMotion
                                  ? undefined
                                  : { rotate: 360 }
                              }
                              transition={{
                                duration: 0.8,
                                repeat: Infinity,
                                ease: "linear",
                              }}
                            />

                            <p className="mt-3 text-sm text-white/55">
                              Loading notifications…
                            </p>
                          </motion.div>
                        ) : notifications.length === 0 ? (
                          <motion.div
                            key="empty"
                            initial={
                              reduceMotion
                                ? false
                                : { opacity: 0, y: 8 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={motionTransition}
                            className="px-5 py-10 text-center"
                          >
                            <motion.div
                              initial={
                                reduceMotion
                                  ? false
                                  : { scale: 0.75, opacity: 0 }
                              }
                              animate={{ scale: 1, opacity: 1 }}
                              transition={motionTransition}
                              className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D9A441]/25 bg-gradient-to-br from-white/[0.09] to-[#D9A441]/[0.07] text-[#E7BD68] shadow-inner shadow-white/[0.04]"
                            >
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                fill="none"
                                className="h-5 w-5"
                              >
                                <path
                                  d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M10 21h4"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </motion.div>

                            <p className="mt-4 text-sm font-semibold text-white">
                              Nothing new yet
                            </p>

                            <p className="mx-auto mt-1.5 max-w-[230px] text-xs leading-5 text-white/50">
                              New lead and consultation alerts will
                              appear here when they are created.
                            </p>
                          </motion.div>
                        ) : (
                          <motion.ul
                            key="notifications"
                            initial="hidden"
                            animate="visible"
                            variants={{
                              hidden: {},
                              visible: {
                                transition: {
                                  staggerChildren: reduceMotion
                                    ? 0
                                    : 0.055,
                                },
                              },
                            }}
                            className="divide-y divide-white/[0.075]"
                          >
                            {notifications.map((notification) => {
                              const content = (
                                <div
                                  className={`group flex gap-3 px-4 py-4 transition-colors duration-300 hover:bg-white/[0.075] ${
                                    notification.readAt
                                      ? ""
                                      : "bg-[#D9A441]/[0.055]"
                                  }`}
                                >
                                  <motion.span
                                    aria-hidden="true"
                                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                      notification.readAt
                                        ? "bg-white/20"
                                        : "bg-[#E7BD68] shadow-[0_0_12px_rgba(217,164,65,0.42)]"
                                    }`}
                                    whileHover={
                                      reduceMotion
                                        ? undefined
                                        : { scale: 1.3 }
                                    }
                                  />

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                      <p className="text-sm font-medium leading-5 text-white transition-colors duration-200 group-hover:text-[#F4D79A]">
                                        {notification.title}
                                      </p>

                                      {!notification.readAt && (
                                        <span className="mt-1 shrink-0 rounded-full border border-[#D9A441]/20 bg-[#D9A441]/[0.09] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#E7BD68]">
                                          New
                                        </span>
                                      )}
                                    </div>

                                    <p className="mt-1 break-words text-xs leading-5 text-white/65">
                                      {notification.message}
                                    </p>

                                    <p className="mt-2 text-[10px] tracking-wide text-white/40">
                                      {formatTime(notification.createdAt)}
                                    </p>
                                  </div>
                                </div>
                              );

                              return (
                                <motion.li
                                  key={notification.id}
                                  variants={{
                                    hidden: reduceMotion
                                      ? {}
                                      : { opacity: 0, y: 9 },
                                    visible: {
                                      opacity: 1,
                                      y: 0,
                                      transition: motionTransition,
                                    },
                                  }}
                                >
                                  {notification.link ? (
                                    <Link
                                      href={notification.link}
                                      onClick={() =>
                                        handleNotificationClick(notification)
                                      }
                                      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D9A441]/70"
                                    >
                                      {content}
                                    </Link>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={updating}
                                      onClick={() =>
                                        void updateReadStatus(
                                          "mark-read",
                                          notification.id,
                                        )
                                      }
                                      className="block w-full text-left disabled:opacity-60"
                                    >
                                      {content}
                                    </button>
                                  )}
                                </motion.li>
                              );
                            })}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-white/[0.10] bg-black/[0.06] px-4 py-3">
                      <span className="text-[10px] tracking-wide text-white/40">
                        Showing up to 50 recent notifications
                      </span>

                      <motion.button
                        type="button"
                        whileHover={
                          reduceMotion ? undefined : { x: 2 }
                        }
                        whileTap={
                          reduceMotion ? undefined : { scale: 0.96 }
                        }
                        transition={motionTransition}
                        onClick={() => void loadNotifications()}
                        disabled={loading}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-white/65 transition-colors hover:text-[#F0D49A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]/60 disabled:opacity-50"
                      >
                        {loading ? "Refreshing…" : "Refresh"}
                      </motion.button>
                    </div>
                  </section>
                </LiquidLensSurface>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}