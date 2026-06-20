import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  HiOutlineArrowLeft,
  HiOutlinePhone,
  HiOutlineIdentification,
  HiOutlineTruck,
  HiOutlineUserCircle,
  HiOutlineClipboardDocumentCheck,
  HiOutlineCalendar,
  HiOutlineClock,
  HiOutlineMap,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineExclamationTriangle,
  HiOutlineDocumentCheck,
} from "react-icons/hi2";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { driverManagementApi, type DriverRecord } from "@/lib/driverManagementApi";
import { managedTripsApi, type ManagedTrip, type TripStatus } from "@/lib/managedTripsApi";

export const Route = createFileRoute("/_authenticated/driver/$driverId")({
  head: ({ params }) => ({ meta: [{ title: `Driver Details — SmartOps` }] }),
  component: DriverDetailPage,
});

const STATUS_CONFIG: Record<TripStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  in_transit: { label: "In Transit", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  delivered: { label: "Delivered", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  delayed: { label: "Delayed", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  cancelled: { label: "Cancelled", color: "text-slate-500", bg: "bg-slate-50 border-slate-200" },
};

function DriverDetailPage() {
  const { driverId } = Route.useParams();
  const [driver, setDriver] = useState<DriverRecord | null>(null);
  const [trips, setTrips] = useState<ManagedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [driverData, tripsData] = await Promise.all([
          driverManagementApi.get(driverId),
          managedTripsApi.list({ driverId }),
        ]);
        setDriver(driverData);
        setTrips(tripsData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load driver details");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [driverId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="h-4 w-4 animate-pulse rounded-full bg-aqua" />
          <p className="text-sm">Loading driver profile…</p>
        </div>
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="card-3d max-w-md rounded-2xl p-8 text-center">
          <HiOutlineExclamationTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-4 font-display text-xl font-bold text-ink">Driver Not Found</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error || "The requested driver could not be loaded."}</p>
          <Link
            to="/driver-management"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-aqua px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
          >
            <HiOutlineArrowLeft className="h-4 w-4" /> Back to Drivers
          </Link>
        </div>
      </div>
    );
  }

  const completedTrips = trips.filter((t) => t.status === "delivered").length;
  const inProgressTrips = trips.filter((t) => t.status === "in_transit" || t.status === "pending").length;
  const delayedTrips = trips.filter((t) => t.status === "delayed").length;

  return (
    <div>
      {/* Back link */}
      <Link
        to="/driver-management"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-ink"
      >
        <HiOutlineArrowLeft className="h-4 w-4" />
        Back to Driver Management
      </Link>

      {/* Driver header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card-3d relative mb-6 overflow-hidden rounded-2xl p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-aqua/25 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-2xl font-bold text-white shadow-[var(--shadow-aqua)]">
            {initials(driver.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{driver.name}</h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold",
                  driver.status === "active"
                    ? "border-aqua/30 bg-aqua-soft text-ink"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    driver.status === "active" ? "bg-aqua" : "bg-muted-foreground"
                  )}
                />
                {driver.status === "active" ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Driver since {new Date(driver.createdAt).toLocaleDateString()}
            </p>
            {driver.vehicleAssigned && (
              <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-aqua">
                <HiOutlineTruck className="h-4 w-4" />
                Vehicle: {driver.vehicleAssigned}
              </p>
            )}
          </div>
          <Link
            to="/driver-management"
            onClick={() => {}}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:bg-muted"
          >
            Edit Driver
          </Link>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={HiOutlineClipboardDocumentCheck}
          label="Total Trips"
          value={trips.length}
          tone="aqua"
        />
        <StatCard
          icon={HiOutlineCheckCircle}
          label="Completed"
          value={completedTrips}
          tone="emerald"
        />
        <StatCard
          icon={HiOutlineClock}
          label="In Progress"
          value={inProgressTrips}
          tone="blue"
        />
        <StatCard
          icon={HiOutlineExclamationTriangle}
          label="Delayed"
          value={delayedTrips}
          tone="amber"
        />
      </div>

      {/* Driver details */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="card-3d rounded-2xl p-5"
          >
            <h3 className="font-display text-lg font-bold text-ink">Driver Information</h3>
            <div className="mt-4 space-y-3">
              <DetailItem icon={HiOutlinePhone} label="Phone" value={driver.phone} />
              <DetailItem icon={HiOutlineIdentification} label="License No" value={driver.licenseNumber} mono />
              <DetailItem icon={HiOutlineTruck} label="Vehicle Assigned" value={driver.vehicleAssigned || "—"} />
              <DetailItem
                icon={HiOutlineUserCircle}
                label="Status"
                value={driver.status === "active" ? "On Duty" : "Off Duty"}
              />
              <DetailItem icon={HiOutlineCalendar} label="Joined" value={new Date(driver.createdAt).toLocaleDateString()} />
              <DetailItem icon={HiOutlineDocumentCheck} label="Trips Completed" value={driver.tripsCompleted?.toString() ?? "0"} />
            </div>
          </motion.div>
        </div>

        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="card-3d rounded-2xl p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-ink">Trip History</h3>
              <Link
                to="/trips"
                className="text-sm font-medium text-aqua hover:underline"
              >
                View all trips
              </Link>
            </div>

            {trips.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-aqua-soft text-aqua">
                  <HiOutlineMap className="h-7 w-7" />
                </div>
                <p className="font-display text-base font-semibold text-ink">No trips assigned</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  This driver hasn't been assigned to any trips yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {trips.slice(0, 10).map((trip) => {
                  const status = STATUS_CONFIG[trip.status];
                  return (
                    <motion.div
                      key={trip._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink">{trip.tripCode}</span>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-xs font-semibold",
                              status.bg,
                              status.color
                            )}
                          >
                            {status.label}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{trip.source}</span>
                          <HiOutlineArrowLeft className="h-3 w-3 rotate-180" />
                          <span className="truncate">{trip.destination}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(trip.startDate).toLocaleDateString()}
                          {trip.distanceKm > 0 && ` · ${trip.distanceKm} km`}
                        </p>
                      </div>
                      <Link
                        to="/trips"
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-aqua transition hover:bg-aqua-soft"
                      >
                        View
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "aqua" | "emerald" | "blue" | "amber";
}) {
  const tones: Record<string, string> = {
    aqua: "from-aqua to-[oklch(0.55_0.12_230)]",
    emerald: "from-[oklch(0.7_0.14_160)] to-[oklch(0.5_0.1_160)]",
    blue: "from-[oklch(0.6_0.13_250)] to-[oklch(0.4_0.1_250)]",
    amber: "from-[oklch(0.8_0.13_70)] to-[oklch(0.6_0.13_60)]",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="card-3d card-3d-hover rounded-2xl p-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-bold text-ink">{value}</p>
        </div>
        <div
          className={cn(
            "grid h-10 w-10 place-items-center rounded-xl text-white shadow-[var(--shadow-aqua)]",
            `bg-gradient-to-br ${tones[tone]}`
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-aqua-soft text-aqua-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn("truncate font-medium text-ink", mono && "font-mono text-sm")}>{value}</p>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
