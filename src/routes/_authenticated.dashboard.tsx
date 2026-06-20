import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  HiOutlineArrowTrendingUp,
  HiOutlineMap,
  HiOutlineUsers,
  HiOutlineTruck,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineArrowUpRight,
  HiOutlineSparkles,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import { Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/AppShell";
import { Slogan } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { managedTripsApi, type TripStats } from "@/lib/managedTripsApi";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SmartOps" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] ?? "there";
  const [stats, setStats] = useState<TripStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const data = await managedTripsApi.stats();
        setStats(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load statistics");
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const weeklyTrips = stats?.weeklyTrips ?? 0;
  const weeklyData = [
    { day: "Mon", trips: Math.round(weeklyTrips * 0.15) },
    { day: "Tue", trips: Math.round(weeklyTrips * 0.18) },
    { day: "Wed", trips: Math.round(weeklyTrips * 0.2) },
    { day: "Thu", trips: Math.round(weeklyTrips * 0.17) },
    { day: "Fri", trips: Math.round(weeklyTrips * 0.15) },
    { day: "Sat", trips: Math.round(weeklyTrips * 0.1) },
    { day: "Sun", trips: Math.round(weeklyTrips * 0.05) },
  ];

  const statusData = [
    { name: "Pending", value: stats?.pendingTrips ?? 0, fill: "oklch(0.8 0.13 70)" },
    { name: "In Transit", value: stats?.inTransitTrips ?? 0, fill: "oklch(0.74 0.13 205)" },
    { name: "Delivered", value: stats?.deliveredTrips ?? 0, fill: "oklch(0.7 0.14 160)" },
    { name: "Delayed", value: stats?.delayedTrips ?? 0, fill: "oklch(0.6 0.22 25)" },
  ];

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
      value: stats?.activeDrivers?.toLocaleString() ?? "0",
      delta: `of ${stats?.totalDrivers ?? 0} total`,
      icon: HiOutlineTruck,
      tone: "from-[oklch(0.6_0.08_220)] to-[oklch(0.4_0.04_240)]",
      to: "/driver-management",
    },
    {
      label: "Trips In Transit",
      value: stats?.inTransitTrips?.toLocaleString() ?? "0",
      delta: `${stats?.pendingTrips ?? 0} pending`,
      icon: HiOutlineClock,
      tone: "from-[oklch(0.7_0.14_160)] to-[oklch(0.5_0.1_160)]",
      to: "/driver-management",
    },
    {
      label: "Completed This Week",
      value: (stats?.deliveredTrips ?? 0).toString(),
      delta: `${stats?.delayedTrips ?? 0} delayed`,
      icon: HiOutlineCheckCircle,
      tone: "from-aqua to-[oklch(0.4_0.08_220)]",
      to: "/driver-management",
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

      {/* Error state */}
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

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="card-3d rounded-2xl p-5 xl:col-span-2"
        >
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-ink">Weekly Trip Activity</h3>
              <p className="text-xs text-muted-foreground">Trips completed by day</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-aqua" /> Trips
              </span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={weeklyData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="trips" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.74 0.13 205)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.74 0.13 205)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.9 0.01 230)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="oklch(0.55 0.01 240)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.55 0.01 240)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid oklch(0.9 0.01 230)",
                    borderRadius: 12,
                    boxShadow: "0 10px 30px -10px oklch(0.2 0.02 240 / 0.2)",
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="trips" stroke="oklch(0.74 0.13 205)" strokeWidth={2.5} fill="url(#trips)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="card-3d rounded-2xl p-5"
        >
          <div className="mb-3">
            <h3 className="font-display text-lg font-bold text-ink">Trip Status Overview</h3>
            <p className="text-xs text-muted-foreground">Current distribution</p>
          </div>
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <span className="h-4 w-4 animate-pulse rounded-full bg-aqua" />
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={statusData} layout="vertical" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="oklch(0.9 0.01 230)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="oklch(0.55 0.01 240)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="oklch(0.55 0.01 240)" fontSize={12} tickLine={false} axisLine={false} width={80} />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid oklch(0.9 0.01 230)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
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
          to="/fleet"
          className="card-3d card-3d-hover flex items-center gap-4 rounded-2xl p-5 transition"
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-[oklch(0.6_0.08_220)] to-[oklch(0.4_0.04_240)] text-white">
            <HiOutlineTruck className="h-6 w-6" />
          </div>
          <div>
            <p className="font-display font-bold text-ink">Fleet Overview</p>
            <p className="text-xs text-muted-foreground">Manage your vehicles</p>
          </div>
        </Link>
      </motion.div>

      {/* Additional stats row */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          <div className="glass rounded-xl p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Distance</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink">
              {(stats.totalDistance / 1000).toFixed(1)}k km
            </p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg Trips/Driver</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink">
              {stats.avgTripsPerDriver}
            </p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">This Week</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink">
              {stats.weeklyTrips}
            </p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivery Rate</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink">
              {stats.totalTrips > 0
                ? Math.round((stats.deliveredTrips / stats.totalTrips) * 100)
                : 0}%
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
