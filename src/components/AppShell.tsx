import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  HiOutlineHome,
  HiOutlineCube,
  HiOutlineBanknotes,
  HiOutlineTruck,
  HiOutlineCog6Tooth,
  HiOutlineChartBar,
  HiOutlineUserCircle,
  HiOutlineKey,
  HiOutlineArrowRightOnRectangle,
  HiOutlineBell,
  HiOutlineMagnifyingGlass,
  HiOutlineBars3,
  HiOutlineXMark,
  HiOutlineWrenchScrewdriver,
} from "react-icons/hi2";
import { useAuth } from "@/lib/auth";
import { Logo, Slogan } from "./Logo";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: HiOutlineHome, enabled: true },
  { to: "/inventory", label: "Inventory", icon: HiOutlineCube, enabled: true },
  { to: "/payroll", label: "Payroll", icon: HiOutlineBanknotes, enabled: true },
  { to: "/fleet", label: "Fleet", icon: HiOutlineTruck, enabled: true },
  { to: "/production", label: "Production", icon: HiOutlineWrenchScrewdriver, enabled: true },
  { to: "/reports", label: "Reports", icon: HiOutlineChartBar, enabled: true },
  { to: "/settings", label: "Settings", icon: HiOutlineCog6Tooth, enabled: true },
] as const;

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 lg:flex">
        <SidebarContent />
      </aside>

      {/* Sidebar (mobile drawer) */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="bg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              key="drawer"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 flex w-64 lg:hidden"
            >
              <SidebarContent onClose={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-5 pt-5">
        <Logo tone="light" />
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-sidebar-foreground/80 hover:bg-sidebar-accent"
            aria-label="Close menu"
          >
            <HiOutlineXMark className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="px-5 pt-3">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/50">
          Manage · Monitor · <span className="text-aqua">Maximize</span>
        </p>
      </div>

      <nav className="mt-7 flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const content = (
            <span
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                active
                  ? "bg-sidebar-accent text-white shadow-[inset_0_1px_0_0_oklch(1_0_0/0.06)]"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-white",
                !item.enabled && "opacity-50"
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-aqua"
                />
              )}
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {!item.enabled && (
                <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                  Soon
                </span>
              )}
            </span>
          );
          return item.enabled ? (
            <Link key={item.to} to={item.to}>
              {content}
            </Link>
          ) : (
            <div key={item.to} className="cursor-not-allowed" aria-disabled>
              {content}
            </div>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-4">
        <div className="flex items-center gap-2 text-aqua">
          <span className="h-2 w-2 rounded-full bg-aqua shadow-[0_0_0_4px_oklch(0.74_0.13_205/0.25)]" />
          <span className="text-xs font-semibold uppercase tracking-wider">All systems</span>
        </div>
        <p className="mt-2 text-xs text-sidebar-foreground/65">
          Operations nominal. Modules expand as you grow.
        </p>
      </div>
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          onClick={onMenu}
          className="rounded-md p-2 text-ink hover:bg-muted lg:hidden"
          aria-label="Open menu"
        >
          <HiOutlineBars3 className="h-5 w-5" />
        </button>

        <div className="relative hidden flex-1 sm:block">
          <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search across SmartOps…"
            className="h-10 w-full max-w-md rounded-lg border border-input bg-surface/60 pl-9 pr-3 text-sm outline-none transition focus:border-aqua focus:bg-surface focus:ring-2 focus:ring-aqua/30"
          />
        </div>
        <div className="flex-1 sm:hidden" />

        <button
          className="relative rounded-lg border border-border bg-surface p-2 text-muted-foreground transition hover:text-ink"
          aria-label="Notifications"
        >
          <HiOutlineBell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-aqua ring-2 ring-background" />
        </button>

        <UserMenu />
      </div>
    </header>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (!user) return null;
  const initials = user.fullName
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const items = [
    { label: "My Profile", icon: HiOutlineUserCircle, to: "/profile" },
    { label: "Change Password", icon: HiOutlineKey, to: "/change-password" },
    { label: "Settings", icon: HiOutlineCog6Tooth, to: "/settings" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-full border border-border bg-surface py-1 pl-1 pr-3 transition hover:shadow-[var(--shadow-3d)]"
      >
        <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-xs font-semibold text-white">
          {user.profileImage ? (
            <img src={user.profileImage} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-tight text-ink">{user.fullName}</span>
          <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {user.role}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="glass absolute right-0 mt-2 w-60 overflow-hidden rounded-xl p-1.5"
          >
            <div className="px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-ink">{user.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="my-1 h-px bg-border" />
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink transition hover:bg-muted"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {it.label}
                </Link>
              );
            })}
            <div className="my-1 h-px bg-border" />
            <button
              onClick={() => {
                logout();
                router.navigate({ to: "/login", replace: true });
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-destructive transition hover:bg-destructive/10"
            >
              <HiOutlineArrowRightOnRectangle className="h-4 w-4" />
              Logout
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export { Slogan };
