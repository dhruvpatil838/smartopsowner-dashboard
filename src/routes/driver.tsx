import { Link, Outlet, useRouterState, Navigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  HiOutlineHome,
  HiOutlineMap,
  HiOutlineTruck,
  HiOutlineMapPin,
  HiOutlineCamera,
  HiOutlineExclamationTriangle,
  HiOutlineCalendarDays,
  HiOutlineBell,
  HiOutlineUserCircle,
  HiOutlineArrowRightOnRectangle,
  HiOutlineBars3,
  HiOutlineXMark,
  HiOutlineCheck,
} from "react-icons/hi2";
import { useAuth } from "@/lib/auth";
import { RoleGuard } from "@/components/RoleGuard";
import { useDriverRealtime } from "@/hooks/use-realtime";
import { driverApi } from "@/lib/driver-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/driver")({
  head: () => ({ meta: [{ title: "Driver Dashboard — SmartOps" }] }),
  component: DriverLayout,
});

const NAV = [
  { to: "/driver", label: "Dashboard", icon: HiOutlineHome, exact: true },
  { to: "/driver/trips", label: "My Trips", icon: HiOutlineTruck },
  { to: "/driver/gps", label: "GPS Tracking", icon: HiOutlineMap },
  { to: "/driver/deliveries", label: "Deliveries", icon: HiOutlineMapPin },
  { to: "/driver/pod", label: "POD Upload", icon: HiOutlineCamera },
  { to: "/driver/incidents", label: "Incidents", icon: HiOutlineExclamationTriangle },
  { to: "/driver/schedule", label: "Schedule", icon: HiOutlineCalendarDays },
  { to: "/driver/notifications", label: "Notifications", icon: HiOutlineBell },
  { to: "/driver/profile", label: "Profile", icon: HiOutlineUserCircle },
] as const;

function useDriverEmail(): string | null {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    driverApi
      .getProfile()
      .then((p) => active && setEmail(p.user.email))
      .catch(() => active && setEmail(null));
    return () => {
      active = false;
    };
  }, []);
  return email;
}

function DriverLayout() {
  const { user, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const driverEmail = useDriverEmail();
  const { unreadCount, lastEvent, clearLastEvent } = useDriverRealtime(driverEmail);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="text-slate-500">Loading driver dashboard…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <RoleGuard allow={["driver"]}>
      <div className="flex min-h-screen w-full bg-slate-50 text-slate-900">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:flex">
        <Sidebar
          onLogout={logout}
          userName={user.fullName}
          unreadCount={unreadCount}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 lg:hidden">
            <Sidebar
              onLogout={logout}
              userName={user.fullName}
              unreadCount={unreadCount}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <HiOutlineBars3 className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-slate-900">Driver Dashboard</h1>
            <p className="text-xs text-slate-500">Manage trips, deliveries & GPS in real time</p>
          </div>

          {/* Live notification bell */}
          <Link
            to="/driver/notifications"
            className="relative rounded-full p-2 text-slate-600 transition hover:bg-slate-100"
            aria-label="Notifications"
          >
            <HiOutlineBell className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>

          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-900">{user.fullName}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Realtime toast */}
      <AnimatePresence>
        {lastEvent && (
          <motion.div
            initial={{ opacity: 0, y: 24, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 24, x: "-50%" }}
            className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
          >
            <Link
              to="/driver/notifications"
              onClick={clearLastEvent}
              className="block rounded-xl border border-blue-200 bg-white p-3 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700">
                  <HiOutlineBell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                    New update
                  </p>
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {lastEvent.title}
                  </p>
                  {lastEvent.body && (
                    <p className="line-clamp-2 text-xs text-slate-500">{lastEvent.body}</p>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    clearLastEvent();
                  }}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
                  aria-label="Dismiss"
                >
                  <HiOutlineXMark className="h-4 w-4" />
                </button>
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </RoleGuard>
  );
}

function Sidebar({
  onClose,
  onLogout,
  userName,
  unreadCount,
}: {
  onClose?: () => void;
  onLogout: () => void;
  userName: string;
  unreadCount: number;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-b from-blue-700 to-blue-900 text-white">
      <div className="flex items-center justify-between px-5 pt-5">
        <div>
          <p className="text-lg font-bold tracking-tight">SmartOps Driver</p>
          <p className="text-[11px] uppercase tracking-widest text-blue-200">Logistics suite</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-blue-100 hover:bg-blue-800"
            aria-label="Close menu"
          >
            <HiOutlineXMark className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="mt-6 flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            "exact" in item && item.exact
              ? pathname === item.to
              : pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                active
                  ? "bg-white text-blue-800 shadow"
                  : "text-blue-100 hover:bg-blue-800/60 hover:text-white",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.to === "/driver/notifications" && unreadCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl bg-blue-800/60 p-4">
        <p className="truncate text-sm font-semibold">{userName}</p>
        <p className="text-xs text-blue-200">Driver</p>
        <button
          onClick={onLogout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
        >
          <HiOutlineArrowRightOnRectangle className="h-4 w-4" /> Logout
        </button>
      </div>
    </div>
  );
}
