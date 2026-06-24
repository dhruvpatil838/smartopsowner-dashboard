import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, isValid } from "date-fns";
import {
  HiOutlineBanknotes,
  HiOutlineCalendar,
  HiOutlineChartBar,
  HiOutlineClipboardDocumentList,
  HiOutlineCurrencyDollar,
  HiOutlineArrowDownTray,
  HiOutlineExclamationTriangle,
  HiOutlineFunnel,
  HiOutlineMagnifyingGlass,
  HiOutlineReceiptRefund,
  HiOutlineArrowPath,
  HiOutlineTruck,
  HiOutlineUserGroup,
  HiOutlineXMark,
} from "react-icons/hi2";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { MButton, MInput, MField, MEmpty } from "@/components/management/ManagementUI";
import {
  revenueApi,
  type RevenueStats,
  type MonthlyRevenue,
  type RevenueByDriver,
  type RevenueByVehicle,
  type TripRevenue,
  type PaymentStatus,
} from "@/lib/revenueApi";

export const Route = createFileRoute("/_authenticated/revenue")({
  head: () => ({ meta: [{ title: "Revenue Analytics — SmartOps" }] }),
  component: RevenueAnalyticsPage,
});

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

const PAYMENT_BADGE: Record<PaymentStatus, string> = {
  pending: "border-amber/30 bg-amber/10 text-amber-700",
  paid: "border-emerald/30 bg-emerald/10 text-emerald-700",
  refunded: "border-slate/30 bg-slate/10 text-slate-700",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

const COLORS = [
  "oklch(0.74 0.13 205)",
  "oklch(0.55 0.12 230)",
  "oklch(0.7 0.14 160)",
  "oklch(0.7 0.13 60)",
  "oklch(0.65 0.12 280)",
];

const PAGE_SIZE = 10;

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function fmtShortCurrency(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "MMM d, yyyy") : "—";
}

function RevenueAnalyticsPage() {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([]);
  const [driverRevenue, setDriverRevenue] = useState<RevenueByDriver[]>([]);
  const [vehicleRevenue, setVehicleRevenue] = useState<RevenueByVehicle[]>([]);
  const [tripList, setTripList] = useState<{ rows: TripRevenue[]; total: number }>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "">("");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: format(subMonths(new Date(), 11), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [page, setPage] = useState(1);

  // Export modal
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(tripList.total / PAGE_SIZE));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, monthlyRes, driverRes, vehicleRes, tripRes] = await Promise.all([
        revenueApi.getStats({
          startDate: dateRange.start,
          endDate: dateRange.end,
        }),
        revenueApi.getMonthlyRevenue(12),
        revenueApi.getRevenueByDriver({ limit: 5 }),
        revenueApi.getRevenueByVehicle({ limit: 5 }),
        revenueApi.getTripRevenueList({
          search: debouncedSearch,
          paymentStatus: paymentFilter,
          startDate: dateRange.start,
          endDate: dateRange.end,
          page,
          pageSize: PAGE_SIZE,
        }),
      ]);
      setStats(statsRes);
      setMonthlyData(monthlyRes);
      setDriverRevenue(driverRes);
      setVehicleRevenue(vehicleRes);
      setTripList(tripRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load revenue data.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, paymentFilter, dateRange, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, paymentFilter, dateRange]);

  const chartData = useMemo(() => {
    return monthlyData.map(d => ({
      ...d,
      revenueFormatted: fmtShortCurrency(d.revenue),
      driverEarningsFormatted: fmtShortCurrency(d.driverEarnings),
    }));
  }, [monthlyData]);

  const pieData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Paid", value: stats.totalRevenue - stats.pendingPayments },
      { name: "Pending", value: stats.pendingPayments },
    ];
  }, [stats]);

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await revenueApi.exportRevenueCSV({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `revenue-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  const STAT_CARDS = useMemo(() => {
    if (!stats) return [];
    return [
      {
        label: "Total Revenue",
        value: fmtCurrency(stats.totalRevenue),
        icon: HiOutlineBanknotes,
        tone: "aqua",
      },
      {
        label: "Monthly Revenue",
        value: fmtCurrency(stats.monthlyRevenue),
        icon: HiOutlineChartBar,
        tone: "emerald",
      },
      {
        label: "Total Trips",
        value: String(stats.totalTrips),
        icon: HiOutlineClipboardDocumentList,
        tone: "slate",
      },
      {
        label: "Pending Payments",
        value: fmtCurrency(stats.pendingPayments),
        icon: HiOutlineReceiptRefund,
        tone: "amber",
      },
      {
        label: "Driver Earnings",
        value: fmtCurrency(stats.totalDriverEarnings),
        icon: HiOutlineUserGroup,
        tone: "violet",
      },
      {
        label: "Avg. Fare",
        value: fmtCurrency(stats.averageFare),
        icon: HiOutlineCurrencyDollar,
        tone: "teal",
      },
    ] as const;
  }, [stats]);

  const toneBg: Record<string, string> = {
    aqua: "bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)]",
    emerald: "bg-gradient-to-br from-[oklch(0.7_0.14_160)] to-[oklch(0.5_0.1_160)]",
    slate: "bg-gradient-to-br from-[oklch(0.5_0.02_240)] to-[oklch(0.3_0.02_240)]",
    amber: "bg-gradient-to-br from-[oklch(0.8_0.13_70)] to-[oklch(0.6_0.13_60)]",
    violet: "bg-gradient-to-br from-[oklch(0.65_0.12_280)] to-[oklch(0.45_0.1_280)]",
    teal: "bg-gradient-to-br from-[oklch(0.7_0.12_180)] to-[oklch(0.5_0.1_180)]",
  };

  return (
    <div>
      <PageHeader
        title="Revenue Analytics"
        description="Track total revenue, driver earnings, and payment status across all trips."
        actions={
          <div className="flex gap-2">
            <MButton variant="secondary" onClick={load}>
              <HiOutlineArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </MButton>
            <MButton onClick={() => setExportOpen(true)}>
              <HiOutlineArrowDownTray className="h-4 w-4" />
              Export CSV
            </MButton>
          </div>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {STAT_CARDS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card-3d card-3d-hover rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="mt-2 font-display text-2xl font-bold text-ink">
                    {loading ? (
                      <span className="inline-block h-7 w-16 animate-pulse rounded bg-muted" />
                    ) : (
                      s.value
                    )}
                  </p>
                </div>
                <div className={cn("grid h-10 w-10 place-items-center rounded-xl text-white", toneBg[s.tone])}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Monthly Trend */}
        <div className="card-3d rounded-2xl p-5 xl:col-span-2">
          <h3 className="font-display text-lg font-bold text-ink">Revenue Trend</h3>
          <p className="text-xs text-muted-foreground">Monthly revenue over the last 12 months.</p>
          <div className="mt-4 h-72">
            {loading ? (
              <div className="h-full animate-pulse rounded-xl bg-muted" />
            ) : monthlyData.length === 0 ? (
              <MEmpty
                icon={HiOutlineChartBar}
                title="No revenue data"
                body="Complete trips with fare amounts to see trends."
              />
            ) : (
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
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
                    tickFormatter={(v) => fmtShortCurrency(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid oklch(0.9 0.01 230)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => fmtCurrency(value)}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="oklch(0.74 0.13 205)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "oklch(0.74 0.13 205)" }}
                    name="Revenue"
                  />
                  <Line
                    type="monotone"
                    dataKey="driverEarnings"
                    stroke="oklch(0.7 0.14 160)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "oklch(0.7 0.14 160)" }}
                    name="Driver Earnings"
                  />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Status Pie */}
        <div className="card-3d rounded-2xl p-5">
          <h3 className="font-display text-lg font-bold text-ink">Payment Status</h3>
          <p className="text-xs text-muted-foreground">Distribution of paid vs pending revenue.</p>
          <div className="mt-4 h-72">
            {loading ? (
              <div className="h-full animate-pulse rounded-xl bg-muted" />
            ) : pieData.every(d => d.value === 0) ? (
              <MEmpty
                icon={HiOutlineReceiptRefund}
                title="No payments yet"
                body="Mark trips as paid to see distribution."
              />
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid oklch(0.9 0.01 230)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => fmtCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Revenue by Driver & Vehicle */}
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* By Driver */}
        <div className="card-3d rounded-2xl p-5">
          <h3 className="font-display text-lg font-bold text-ink">Revenue by Driver</h3>
          <p className="text-xs text-muted-foreground">Top 5 drivers by total revenue generated.</p>
          <div className="mt-4 h-64">
            {loading ? (
              <div className="h-full animate-pulse rounded-xl bg-muted" />
            ) : driverRevenue.length === 0 ? (
              <MEmpty
                icon={HiOutlineUserGroup}
                title="No driver revenue"
                body="Assign drivers to trips to see breakdown."
              />
            ) : (
              <ResponsiveContainer>
                <BarChart data={driverRevenue} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 80 }}>
                  <CartesianGrid stroke="oklch(0.9 0.01 230)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="oklch(0.55 0.01 240)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fmtShortCurrency(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="driver_name"
                    stroke="oklch(0.55 0.01 240)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid oklch(0.9 0.01 230)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => fmtCurrency(value)}
                  />
                  <Bar dataKey="total_revenue" fill="oklch(0.74 0.13 205)" radius={[0, 6, 6, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* By Vehicle */}
        <div className="card-3d rounded-2xl p-5">
          <h3 className="font-display text-lg font-bold text-ink">Revenue by Vehicle</h3>
          <p className="text-xs text-muted-foreground">Top 5 vehicles by total revenue generated.</p>
          <div className="mt-4 h-64">
            {loading ? (
              <div className="h-full animate-pulse rounded-xl bg-muted" />
            ) : vehicleRevenue.length === 0 ? (
              <MEmpty
                icon={HiOutlineTruck}
                title="No vehicle revenue"
                body="Assign vehicles to trips to see breakdown."
              />
            ) : (
              <ResponsiveContainer>
                <BarChart data={vehicleRevenue} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 80 }}>
                  <CartesianGrid stroke="oklch(0.9 0.01 230)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="oklch(0.55 0.01 240)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fmtShortCurrency(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="vehicle_number"
                    stroke="oklch(0.55 0.01 240)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid oklch(0.9 0.01 230)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => fmtCurrency(value)}
                  />
                  <Bar dataKey="total_revenue" fill="oklch(0.7 0.14 160)" radius={[0, 6, 6, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Filters & Trip List */}
      <div className="card-3d rounded-2xl p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by trip code, locations..."
              className="h-11 w-full rounded-lg border border-input bg-surface pl-9 pr-3 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <HiOutlineFunnel className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as PaymentStatus | "")}
                className="h-11 rounded-lg border border-input bg-surface pl-9 pr-8 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="refunded">Refunded</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <HiOutlineCalendar className="h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="h-11 rounded-lg border border-input bg-surface px-3 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="h-11 rounded-lg border border-input bg-surface px-3 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <HiOutlineExclamationTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Something went wrong.</p>
              <p className="text-xs text-destructive/80">{error}</p>
            </div>
          </div>
        )}

        {!error && !loading && tripList.rows.length === 0 ? (
          <MEmpty
            icon={HiOutlineBanknotes}
            title="No revenue entries"
            body="Complete trips and add fare amounts to see revenue data."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-left">
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Trip
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Route
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Date
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                      Fare
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                      Driver Earnings
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Driver
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Vehicle
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-border">
                          {Array.from({ length: 8 }).map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <span className="block h-4 w-full animate-pulse rounded bg-muted" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : tripList.rows.map((trip) => (
                        <motion.tr
                          key={trip.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="group border-b border-border transition hover:bg-surface-muted/60"
                        >
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">
                            {trip.trip_code}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <div className="max-w-[200px] truncate">
                              {trip.pickup_location} → {trip.drop_location}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {fmtDate(trip.scheduled_date ?? trip.created_at)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-ink">
                            {fmtCurrency(trip.fare_amount)}
                          </td>
                          <td className="px-4 py-3 text-right text-[oklch(0.7_0.14_160)]">
                            {fmtCurrency(trip.driver_earnings)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                                PAYMENT_BADGE[trip.payment_status]
                              )}
                            >
                              {PAYMENT_STATUS_LABEL[trip.payment_status]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {trip.driver_name ? (
                              <span className="flex items-center gap-1.5">
                                <HiOutlineUserGroup className="h-4 w-4 text-aqua" />
                                <span className="font-medium">{trip.driver_name}</span>
                              </span>
                            ) : (
                              <span className="text-xs italic text-muted-foreground">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {trip.vehicle_number ? (
                              <span className="flex items-center gap-1.5">
                                <HiOutlineTruck className="h-4 w-4 text-aqua" />
                                <span className="font-mono text-xs">{trip.vehicle_number}</span>
                              </span>
                            ) : (
                              <span className="text-xs italic text-muted-foreground">—</span>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {loading
                  ? "Loading…"
                  : `Showing ${tripList.rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + tripList.rows.length} of ${tripList.total}`}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-2 text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
        exporting={exporting}
        dateRange={dateRange}
        setDateRange={setDateRange}
      />
    </div>
  );
}

function ExportModal({
  open,
  onClose,
  onExport,
  exporting,
  dateRange,
  setDateRange,
}: {
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  exporting: boolean;
  dateRange: { start: string; end: string };
  setDateRange: (r: { start: string; end: string }) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="glass relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-white">
                  <HiOutlineArrowDownTray className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-ink">Export Revenue Report</h2>
                  <p className="text-sm text-muted-foreground">Download as CSV spreadsheet.</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-ink"
                aria-label="Close"
              >
                <HiOutlineXMark className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <MField label="Start Date">
                <MInput
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </MField>
              <MField label="End Date">
                <MInput
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </MField>
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Export will include all trips with revenue data in the selected date range.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <MButton variant="secondary" onClick={onClose} disabled={exporting}>
                Cancel
              </MButton>
              <MButton onClick={onExport} disabled={exporting}>
                {exporting ? "Exporting…" : "Download CSV"}
              </MButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
