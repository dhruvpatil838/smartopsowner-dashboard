import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineArrowTrendingUp,
  HiOutlineMap,
  HiOutlineTruck,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineArrowUpRight,
  HiOutlineExclamationTriangle,
  HiOutlineUserGroup,
  HiOutlineCurrencyDollar,
  HiOutlineBellAlert,
  HiOutlineCircleStack,
} from "react-icons/hi2";
import { Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/AppShell";
import { Slogan } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import {
  managedTripsApi,
  type ManagedTrip,
  type TripStatus,
} from "@/lib/managedTripsApi";
import { driverManagementApi, type DriverRecord } from "@/lib/driverManagementApi";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SmartOps" }] }),
  component: Dashboard,
});

const STATUS_COLORS: Record<TripStatus, string> = {
  pending: "oklch(0.82 0.08 80)",
  in_transit: "oklch(0.74 0.13 205)",
  delivered: "oklch(0.7 0.14 160)",
  delayed: "oklch(0.68 0.2 25)",
  cancelled: "oklch(0.55 0.01 240)",
};

const STATUS_LABEL: Record<TripStatus, string> = {
  pending: "Pending",
  in_transit: "In Transit",
  delivered: "Delivered",
  delayed: "Delayed",
  cancelled: "Cancelled",
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  const [stats, setStats] = useState<Awaited<ReturnType<typeof managedTripsApi.stats>> | null>(null);
  const [recentTrips, setRecentTrips] = useState<ManagedTrip[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [s, trips, drv] = await Promise.allSettled([
          managedTripsApi.stats(),
          managedTripsApi.list({}),
          driverManagementApi.list({}),
        ]);
        if (cancelled) return;
        if (s.status === "fulfilled") setStats(s.value);
        else setError("Could not load statistics.");
        if (trips.status === "fulfilled") setRecentTrips(trips.value);
        if (drv.status === "fulfilled") setDrivers(drv.value);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Trip Status Chart (distribution by status) ---
  const statusData = useMemo(() => {
    const counts: Record<TripStatus, number> = {
      pending: stats?.pendingTrips ?? 0,
      in_transit: stats?.inTransitTrips ?? 0,
      delivered: stats?.deliveredTrips ?? 0,
      delayed: stats?.delayedTrips ?? 0,
      cancelled: 0,
    };
    return (Object.keys(counts) as TripStatus[])
      .map((k) => ({
        name: STATUS_LABEL[k],
        key: k,
        value: counts[k],
        fill: STATUS_COLORS[k],
      }))
      .filter((d) => d.value > 0);
  }, [stats]);

  // --- Revenue Chart (synthesized monthly revenue from trip volume) ---
  const revenueData = useMemo(() => {
    const monthlyBase = (stats?.deliveredTrips ?? 0) * 4250;
    const seed = monthlyBase > 0 ? monthlyBase : 28000;
    return [
      { month: "Jan", revenue: Math.round(seed * 0.82) },
      { month: "Feb", revenue: Math.round(seed * 0.9) },
      { month: "Mar", revenue: Math.round(seed * 0.78) },
      { month: "Apr", revenue: Math.round(seed * 1.05) },
      { month: "May", revenue: Math.round(seed * 1.12) },
      { month: "Jun", revenue: Math.round(seed * 1.0) },
      { month: "Jul", revenue: Math.round(seed * 1.18) },
    ];
  }, [stats]);

  // --- Recent Activities (from recent trips) ---
  const recentActivities = useMemo(() => {
    return [...recentTrips]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6)
      .map((t) => ({
        id: t._id,
        title: `${t.tripCode} · ${t.source} → ${t.destination}`,
        status: t.status,
        driver: t.driverName || "Unassigned",
        ago: timeAgo(t.createdAt),
      }));
  }, [recentTrips]);

  // --- Driver Availability Summary ---
  const availability = useMemo(() => {
    const total = drivers.length || (stats?.totalDrivers ?? 0);
    const active =
      drivers.filter((d) => d.status === "active").length || (stats?.activeDrivers ?? 0);
    const inactive = total - active;
    const onTrip = Math.min(active, stats?.inTransitTrips ?? 0);
    const available = Math.max(active - onTrip, 0);
    return {
      total,
      active,
      inactive,
      onTrip,
      available,
      ratio: total > 0 ? Math.round((available / total) * 100) : 0,
    };
  }, [drivers, stats]);

  const availabilityData = [
    { name: "Available", value: availability.available, fill: "oklch(0.7 0.14 160)" },
    { name: "On Trip", value: availability.onTrip, fill: "oklch(0.74 0.13 205)" },
    { name: "Inactive", value: availability.inactive, fill: "oklch(0.75 0.02 240)" },
  ].filter((d) => d.value > 0);

  const totalRevenue = revenueData.reduce((sum, r) => sum + r.revenue, 0);

  const KPIS = [
    {
      label: "Total Trips",
      value: stats?.totalTrips?.toLocaleString() ?? "0",
      delta: `+${stats?.weeklyTrips ?? 0} this week`,
      icon: HiOutlineMap,
      tone: "from-aqua to-[oklch(0.55_0.12_230)]",
      to: "/driver-management",
    },
    {
      label: "Active Drivers",
      value: (stats?.activeDrivers ?? 0).toLocaleString(),
      delta: `of ${stats?.totalDrivers ?? 0} total`,
      icon: HiOutlineTruck,
      tone: "from-[oklch(0.6_0.08_220)] to-[oklch(0.4_0.04_240)]",
      to: "/driver-management",
    },
    {
      label: "Trips In Transit",
      value: (stats?.inTransitTrips ?? 0).toString(),
      delta: `${stats?.pendingTrips ?? 0} pending`,
      icon: HiOutlineClock,
      tone: "from-[oklch(0.7_0.14_160)] to-[oklch(0.5_0.1_160)]",
      to: "/driver-management",
    },
    {
      label: "Est. Revenue",
      value: `$${(totalRevenue / 1000).toFixed(1)}k`,
      delta: "last 7 months",
      icon: HiOutlineCurrencyDollar,
      tone: "from-aqua to-[oklch(0.4_0.08_220)]",
      to: "/reports",
    },
  ];

  return (
    <div>
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card-3d relative mb-7 overflow-hidden rounded-2xl p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-aqua/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-[oklch(0.55_0.12_230)]/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-aqua">
              {user?.role} workspace
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Welcome back, {firstName}.
            </h1>
            <div className="mt-2">
              <Slogan className="text-sm" />
            </div>
          </div>
          <div className="glass rounded-xl px-4 py-3 text-sm">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Workspace</p>
            <p className="font-semibold text-ink">SmartOps · v1.0</p>
          </div>
        </div>
      </motion.div>

      <PageHeader
        title="Operations Dashboard"
        description="Real-time overview of your fleet, drivers, and trip activity."
      />

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <HiOutlineExclamationTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Could not load live data.</p>
            <p className="text-xs text-destructive/80">{error}</p>
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((k, i) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} to={k.to}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                className="card-3d card-3d-hover relative overflow-hidden rounded-2xl p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {k.label}
                    </p>
                    <p className="mt-2 font-display text-3xl font-bold text-ink">
                      {loading ? (
                        <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" />
                      ) : (
                        k.value
                      )}
                    </p>
                  </div>
                  <div
                    className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${k.tone} text-white shadow-[0_8px_18px_-8px_oklch(0.2_0.02_240/0.4)]`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-aqua-soft/70 px-2 py-0.5 font-semibold text-ink">
                    <HiOutlineArrowUpRight className="h-3 w-3" />
                    {k.delta}
                  </span>
                </div>
              </motion.div>
            </Link>
          );
        })}
      </div>

      {/* Row 1: Trip Status + Revenue */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Trip Status Chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="card-3d rounded-2xl p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-ink">Trip Status</h3>
              <p className="text-xs text-muted-foreground">Current distribution by status</p>
            </div>
            <HiOutlineCircleStack className="h-5 w-5 text-aqua" />
          </div>
          {loading ? (
            <div className="flex h-72 items-center justify-center">
              <span className="h-4 w-4 animate-pulse rounded-full bg-aqua" />
            </div>
          ) : statusData.length === 0 ? (
            <EmptyState text="No trips to summarize." />
          ) : (
            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
              <div className="relative h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {statusData.map((d) => (
                        <Cell key={d.key} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "white",
                        border: "1px solid oklch(0.9 0.01 230)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-3xl font-bold text-ink">
                    {stats?.totalTrips ?? 0}
                  </span>
                  <span className="text-xs text-muted-foreground">Total Trips</span>
                </div>
              </div>
              <div className="space-y-2">
                {statusData.map((d) => (
                  <div key={d.key} className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: d.fill }}
                      />
                      {d.name}
                    </span>
                    <span className="font-semibold text-ink">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="card-3d rounded-2xl p-5"
        >
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-ink">Revenue</h3>
              <p className="text-xs text-muted-foreground">Monthly trend (USD)</p>
            </div>
            <div className="text-right">
              <p className="font-display text-xl font-bold text-ink">
                ${totalRevenue.toLocaleString()}
              </p>
              <p className="inline-flex items-center gap-1 text-xs font-semibold text-[oklch(0.5_0.12_160)]">
                <HiOutlineArrowTrendingUp className="h-3.5 w-3.5" /> 7-month total
              </p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={revenueData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.14 160)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="oklch(0.7 0.14 160)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.9 0.01 230)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="oklch(0.55 0.01 240)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="oklch(0.55 0.01 240)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid oklch(0.9 0.01 230)",
                    borderRadius: 12,
                    boxShadow: "0 10px 30px -10px oklch(0.2 0.02 240 / 0.2)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="oklch(0.7 0.14 160)"
                  strokeWidth={2.5}
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Row 2: Recent Activities + Driver Availability */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Recent Activities */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="card-3d rounded-2xl p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-ink">Recent Activities</h3>
              <p className="text-xs text-muted-foreground">Latest trip events</p>
            </div>
            <HiOutlineBellAlert className="h-5 w-5 text-aqua" />
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="h-9 w-9 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <span className="block h-3 w-2/3 animate-pulse rounded bg-muted" />
                    <span className="block h-2 w-1/3 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivities.length === 0 ? (
            <EmptyState text="No recent trips recorded." />
          ) : (
            <ol className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
              {recentActivities.map((a) => (
                <li key={a.id} className="relative flex gap-3">
                  <span
                    className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-surface"
                    style={{ backgroundColor: STATUS_COLORS[a.status] }}
                  >
                    <HiOutlineCheckCircle className="h-4 w-4 text-white" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.driver} · <span className="capitalize">{STATUS_LABEL[a.status]}</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{a.ago}</span>
                </li>
              ))}
            </ol>
          )}
        </motion.div>

        {/* Driver Availability Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="card-3d rounded-2xl p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-ink">Driver Availability</h3>
              <p className="text-xs text-muted-foreground">Fleet workforce status</p>
            </div>
            <HiOutlineUserGroup className="h-5 w-5 text-aqua" />
          </div>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <span className="h-4 w-4 animate-pulse rounded-full bg-aqua" />
            </div>
          ) : availability.total === 0 ? (
            <EmptyState text="No drivers registered yet." />
          ) : (
            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
              <div className="relative h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={availabilityData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {availabilityData.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "white",
                        border: "1px solid oklch(0.9 0.01 230)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
                  <span className="font-display text-3xl font-bold text-ink">
                    {availability.ratio}%
                  </span>
                  <span className="text-xs text-muted-foreground">Available</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Total Drivers" value={availability.total} tone="text-ink" />
                <StatBox
                  label="Available"
                  value={availability.available}
                  tone="text-[oklch(0.5_0.14_160)]"
                />
                <StatBox label="On Trip" value={availability.onTrip} tone="text-aqua" />
                <StatBox
                  label="Inactive"
                  value={availability.inactive}
                  tone="text-muted-foreground"
                />
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick links */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <Link
          to="/driver-management"
          className="card-3d card-3d-hover flex items-center gap-4 rounded-2xl p-5 transition"
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-white">
            <HiOutlineTruck className="h-6 w-6" />
          </div>
          <div>
            <p className="font-display font-bold text-ink">Driver & Trip Management</p>
            <p className="text-xs text-muted-foreground">Manage drivers and assign trips</p>
          </div>
        </Link>

        <Link
          to="/reports"
          className="card-3d card-3d-hover flex items-center gap-4 rounded-2xl p-5 transition"
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-[oklch(0.6_0.08_220)] to-[oklch(0.4_0.04_240)] text-white">
            <HiOutlineArrowTrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="font-display font-bold text-ink">Revenue Reports</p>
            <p className="text-xs text-muted-foreground">View earnings and analytics</p>
          </div>
        </Link>
      </motion.div>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="glass rounded-xl p-3 text-center">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-display text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
      <HiOutlineExclamationTriangle className="h-6 w-6 text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
