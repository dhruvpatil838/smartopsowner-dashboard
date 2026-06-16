import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineTruck,
  HiOutlineMapPin,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineGlobeAlt,
  HiOutlineSparkles,
  HiOutlineChartBar,
  HiOutlineDocumentCheck,
  HiOutlineEye,
  HiOutlineBolt,
} from "react-icons/hi2";
import { DCard, DStat, DBadge, DEmpty, TRIP_STATUS_TONE, prettyStatus } from "@/components/driver/DriverUI";
import { driverApi, type Trip } from "@/lib/driver-api";

export const Route = createFileRoute("/driver/")({
  head: () => ({ meta: [{ title: "Driver Dashboard — SmartOps" }] }),
  component: DriverHome,
});

function DriverHome() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    driverApi
      .listTrips()
      .then(setTrips)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const assigned = trips.length;
    const active = trips.filter((t) => t.status === "in_transit").length;
    const completed = trips.filter((t) => t.status === "delivered").length;
    const pending = trips.filter((t) => t.status === "pending").length;
    const today = new Date().toDateString();
    const todayKm = trips
      .filter((t) => new Date(t.startDate).toDateString() === today)
      .reduce((s, t) => s + (t.distanceKm || 0), 0);
    const successRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
    return { assigned, active, completed, pending, todayKm, successRate };
  }, [trips]);

  return (
    <div>
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-100">
          Welcome back, driver
        </p>
        <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Today at a glance</h2>
        <p className="mt-1 max-w-xl text-sm text-blue-100">
          Track assigned trips, update delivery status, share GPS, and confirm proof of delivery — all
          from one place.
        </p>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DStat label="Assigned Trips" value={loading ? "…" : stats.assigned} icon={HiOutlineTruck} />
        <DStat
          label="Active Deliveries"
          value={loading ? "…" : stats.active}
          icon={HiOutlineBolt}
          tone="blue"
        />
        <DStat
          label="Completed Deliveries"
          value={loading ? "…" : stats.completed}
          icon={HiOutlineCheckCircle}
          tone="green"
        />
        <DStat
          label="Pending Deliveries"
          value={loading ? "…" : stats.pending}
          icon={HiOutlineClock}
          tone="amber"
        />
        <DStat
          label="Today's Distance"
          value={loading ? "…" : `${stats.todayKm.toLocaleString()} km`}
          icon={HiOutlineGlobeAlt}
          tone="slate"
        />
        <DStat
          label="Delivery Success Rate"
          value={loading ? "…" : `${stats.successRate}%`}
          icon={HiOutlineChartBar}
          tone="green"
        />
      </div>

      <h3 className="mt-8 mb-3 text-lg font-bold text-slate-900">Recent trips</h3>
      {loading ? (
        <DEmpty>Loading trips…</DEmpty>
      ) : trips.length === 0 ? (
        <DEmpty>No trips assigned yet. Add one in “My Trips”.</DEmpty>
      ) : (
        <DCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Trip</th>
                  <th className="px-4 py-3 text-left">Route</th>
                  <th className="px-4 py-3 text-left">Vehicle</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {trips.slice(0, 6).map((t) => (
                  <tr key={t._id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-900">{t.tripCode}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {t.source} → {t.destination}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{t.vehicleNumber || "—"}</td>
                    <td className="px-4 py-3">
                      <DBadge tone={TRIP_STATUS_TONE[t.status]}>{prettyStatus(t.status)}</DBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DCard>
      )}

      <h3 className="mt-10 mb-3 text-lg font-bold text-slate-900">Why drivers love SmartOps</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Benefit icon={HiOutlineEye} title="Improved Delivery Visibility" body="See every trip status in real time across the fleet." />
        <Benefit icon={HiOutlineDocumentCheck} title="Reduced Paperwork" body="Digital POD with photos & signatures replaces paper logs." />
        <Benefit icon={HiOutlineMapPin} title="Real-Time Trip Monitoring" body="Share GPS coordinates and ETA with operations live." />
        <Benefit icon={HiOutlineSparkles} title="Faster Confirmation" body="Confirm deliveries in seconds with one-tap workflows." />
      </div>
    </div>
  );
}

function Benefit({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <DCard>
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-blue-700">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
    </DCard>
  );
}
