import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  HiOutlineBell,
  HiOutlineCheck,
  HiOutlineTrash,
  HiOutlineTruck,
  HiOutlineExclamationTriangle,
  HiOutlineMap,
  HiOutlineCheckCircle,
} from "react-icons/hi2";
import { DCard, DSection, DButton, DBadge, DEmpty } from "@/components/driver/DriverUI";
import { driverApi, type DriverNotification } from "@/lib/driver-api";

export const Route = createFileRoute("/driver/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Driver Dashboard" }] }),
  component: NotificationsPage,
});

const ICONS = {
  trip_assigned: HiOutlineTruck,
  delivery_delayed: HiOutlineExclamationTriangle,
  route_change: HiOutlineMap,
  delivery_completed: HiOutlineCheckCircle,
  system: HiOutlineBell,
} as const;

const TONES: Record<DriverNotification["type"], "blue" | "amber" | "red" | "green" | "slate"> = {
  trip_assigned: "blue",
  delivery_delayed: "red",
  route_change: "amber",
  delivery_completed: "green",
  system: "slate",
};

function NotificationsPage() {
  const [list, setList] = useState<DriverNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setList(await driverApi.listNotifications());
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  async function markRead(n: DriverNotification) {
    await driverApi.markRead(n._id);
    reload();
  }
  async function markAll() {
    await driverApi.markAllRead();
    reload();
  }
  async function remove(n: DriverNotification) {
    await driverApi.deleteNotification(n._id);
    reload();
  }

  const unread = list.filter((n) => !n.read).length;

  return (
    <div>
      <DSection
        title="Notifications"
        description={`${unread} unread${list.length ? ` of ${list.length}` : ""}`}
        actions={
          unread > 0 ? (
            <DButton variant="secondary" onClick={markAll}>
              Mark all as read
            </DButton>
          ) : undefined
        }
      />

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {loading ? (
        <DEmpty>Loading…</DEmpty>
      ) : list.length === 0 ? (
        <DEmpty>No notifications yet.</DEmpty>
      ) : (
        <div className="space-y-3">
          {list.map((n) => {
            const Icon = ICONS[n.type];
            return (
              <DCard key={n._id} className={n.read ? "opacity-70" : ""}>
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
                    {n.message && <p className="mt-1 text-sm text-slate-600">{n.message}</p>}
                    <p className="mt-1 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
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
