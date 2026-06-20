import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  HiOutlineBell,
  HiOutlineCheck,
  HiOutlineTrash,
  HiOutlineTruck,
  HiOutlineArrowPath,
  HiOutlineMinusCircle,
} from "react-icons/hi2";
import { DCard, DSection, DButton, DBadge, DEmpty } from "@/components/driver/DriverUI";
import { useDriverRealtime } from "@/hooks/use-realtime";
import type { TripNotification } from "@/lib/tripApi";
import { tripApi } from "@/lib/tripApi";
import { driverApi } from "@/lib/driver-api";

export const Route = createFileRoute("/driver/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Driver Dashboard" }] }),
  component: NotificationsPage,
});

const ICONS: Record<TripNotification["type"], React.ComponentType<{ className?: string }>> = {
  trip_assigned: HiOutlineTruck,
  trip_unassigned: HiOutlineMinusCircle,
  status_changed: HiOutlineArrowPath,
};

const TONES: Record<TripNotification["type"], "blue" | "amber" | "green" | "slate"> = {
  trip_assigned: "blue",
  trip_unassigned: "slate",
  status_changed: "amber",
};

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

function NotificationsPage() {
  const driverEmail = useDriverEmail();
  const { driver, notifications, unreadCount, loading, error, reload } =
    useDriverRealtime(driverEmail);

  async function markRead(n: TripNotification) {
    await tripApi.markNotificationRead(n.id);
  }
  async function markAll() {
    if (!driver) return;
    await tripApi.markAllNotificationsRead(driver.id);
    reload();
  }
  async function remove(n: TripNotification) {
    await tripApi.deleteNotification(n.id);
  }

  return (
    <div>
      <DSection
        title="Notifications"
        description={`${unreadCount} unread${notifications.length ? ` of ${notifications.length}` : ""}`}
        actions={
          unreadCount > 0 ? (
            <DButton variant="secondary" onClick={markAll}>
              <HiOutlineCheck className="h-4 w-4" /> Mark all as read
            </DButton>
          ) : undefined
        }
      />

      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-blue-600">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
        </span>
        Live — updates instantly as trips are assigned or change status.
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <DEmpty>Loading notifications…</DEmpty>
      ) : notifications.length === 0 ? (
        <DEmpty>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <HiOutlineBell className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">No notifications yet.</p>
            <p className="text-xs text-slate-400">
              You'll be alerted here the moment a trip is assigned to you.
            </p>
          </div>
        </DEmpty>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const Icon = ICONS[n.type];
            return (
              <DCard key={n.id} className={n.read ? "opacity-70" : "ring-2 ring-blue-200"}>
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{n.title}</p>
                      <DBadge tone={TONES[n.type]}>{n.type.replace(/_/g, " ")}</DBadge>
                      {!n.read && (
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          New
                        </span>
                      )}
                    </div>
                    {n.body && <p className="mt-1 text-sm text-slate-600">{n.body}</p>}
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                    {n.trip_code && (
                      <Link
                        to="/driver/trips"
                        className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:underline"
                      >
                        View trip {n.trip_code} →
                      </Link>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {!n.read && (
                      <button
                        onClick={() => markRead(n)}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-700"
                        aria-label="Mark read"
                      >
                        <HiOutlineCheck className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => remove(n)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete"
                    >
                      <HiOutlineTrash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </DCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
