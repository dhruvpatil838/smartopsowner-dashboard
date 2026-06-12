import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  HiOutlineArrowTrendingUp,
  HiOutlineBanknotes,
  HiOutlineUsers,
  HiOutlineSparkles,
  HiOutlineArrowUpRight,
} from "react-icons/hi2";
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SmartOps" }] }),
  component: Dashboard,
});

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const revenueData = months.map((m) => ({ month: m, revenue: 0, target: 0 }));
const growthData = months.slice(0, 8).map((m) => ({ month: m, growth: 0 }));

const KPIS = [
  {
    label: "Total Revenue",
    value: "₹0",
    delta: "0%",
    icon: HiOutlineBanknotes,
    tone: "from-aqua to-[oklch(0.55_0.12_230)]",
  },
  {
    label: "Profit",
    value: "₹0",
    delta: "0%",
    icon: HiOutlineArrowTrendingUp,
    tone: "from-[oklch(0.45_0.05_240)] to-[oklch(0.25_0.02_240)]",
  },
  {
    label: "Active Employees",
    value: "0",
    delta: "+0",
    icon: HiOutlineUsers,
    tone: "from-[oklch(0.6_0.08_220)] to-[oklch(0.4_0.04_240)]",
  },
  {
    label: "Business Growth",
    value: "0%",
    delta: "0%",
    icon: HiOutlineSparkles,
    tone: "from-aqua to-[oklch(0.4_0.08_220)]",
  },
];

function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] ?? "there";

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
        title="Owner Dashboard"
        description="Connect modules to populate live KPIs and charts."
      />

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((k, i) => {
          const Icon = k.icon;
          return (
            <motion.div
              key={k.label}
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
                  <p className="mt-2 font-display text-3xl font-bold text-ink">{k.value}</p>
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
                vs. last month
              </div>
            </motion.div>
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
              <h3 className="font-display text-lg font-bold text-ink">Revenue</h3>
              <p className="text-xs text-muted-foreground">Monthly revenue vs. target</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-aqua" /> Revenue
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.35_0.02_240)]" /> Target
              </span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={revenueData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.74 0.13 205)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.74 0.13 205)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.9 0.01 230)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="oklch(0.55 0.01 240)" fontSize={12} tickLine={false} axisLine={false} />
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
                <Area type="monotone" dataKey="revenue" stroke="oklch(0.74 0.13 205)" strokeWidth={2.5} fill="url(#rev)" />
                <Area type="monotone" dataKey="target" stroke="oklch(0.35 0.02 240)" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <EmptyOverlay />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="card-3d rounded-2xl p-5"
        >
          <div className="mb-3">
            <h3 className="font-display text-lg font-bold text-ink">Business Growth</h3>
            <p className="text-xs text-muted-foreground">Quarter-over-quarter</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={growthData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="oklch(0.9 0.01 230)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="oklch(0.55 0.01 240)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.55 0.01 240)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid oklch(0.9 0.01 230)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="growth" fill="oklch(0.74 0.13 205)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <EmptyOverlay />
        </motion.div>
      </div>
    </div>
  );
}

function EmptyOverlay() {
  return (
    <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-aqua" />
      No data yet — connect operational modules to begin tracking.
    </div>
  );
}
