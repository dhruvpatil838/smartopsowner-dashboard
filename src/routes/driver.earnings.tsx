import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO, subMonths, startOfMonth, endOfMonth, isValid } from "date-fns";
import {
  HiOutlineBanknotes,
  HiOutlineCalendar,
  HiOutlineChartBar,
  HiOutlineClipboardDocumentList,
  HiOutlineCurrencyDollar,
  HiOutlineArrowDownTray,
  HiOutlineExclamationTriangle,
  HiOutlineGift,
  HiOutlineMinusCircle,
  HiOutlinePlusCircle,
  HiOutlineReceiptRefund,
  HiOutlineArrowPath,
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
import { DSection, DCard, DButton, DEmpty } from "@/components/driver/DriverUI";
import { cn } from "@/lib/utils";
import {
  revenueApi,
  type MonthlyRevenue,
  type TripEarningsBreakdown,
  type DriverEarningsRecord,
  type PaymentStatus,
  type EarningsType,
} from "@/lib/revenueApi";

export const Route = createFileRoute("/driver/earnings")({
  head: () => ({ meta: [{ title: "My Earnings — Driver Dashboard" }] }),
  component: DriverEarningsPage,
});

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

const PAYMENT_BADGE: Record<PaymentStatus, string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-700",
  paid: "border-emerald-300 bg-emerald-50 text-emerald-700",
  refunded: "border-slate-300 bg-slate-50 text-slate-700",
  cancelled: "border-red-300 bg-red-50 text-red-700",
};

const EARNINGS_TYPE_LABEL: Record<EarningsType, string> = {
  trip_earnings: "Trip Earnings",
  bonus: "Bonus",
  adjustment: "Adjustment",
  penalty: "Penalty",
  tip: "Tip",
};

const EARNINGS_TYPE_ICON: Record<EarningsType, React.ComponentType<{ className?: string }>> = {
  trip_earnings: HiOutlineBanknotes,
  bonus: HiOutlineGift,
  adjustment: HiOutlinePlusCircle,
  penalty: HiOutlineMinusCircle,
  tip: HiOutlineCurrencyDollar,
};

const EARNINGS_TYPE_TONE: Record<EarningsType, string> = {
  trip_earnings: "text-emerald-600 bg-emerald-50",
  bonus: "text-aqua bg-aqua/10",
  adjustment: "text-slate-600 bg-slate-100",
  penalty: "text-red-600 bg-red-50",
  tip: "text-amber-600 bg-amber-50",
};

const COLORS = [
  "oklch(0.74 0.13 205)",
  "oklch(0.55 0.12 230)",
  "oklch(0.7 0.14 160)",
  "oklch(0.7 0.13 60)",
];

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

function DriverEarningsPage() {
  // In a real app, the driver ID would come from auth context
  // For this demo, we use the first driver from the drivers table
  const [driverId, setDriverId] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalEarnings: number;
    monthlyEarnings: number;
    totalTrips: number;
    completedTrips: number;
    pendingEarnings: number;
    paidEarnings: number;
    averageEarnings: number;
  } | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([]);
  const [tripEarnings, setTripEarnings] = useState<TripEarningsBreakdown[]>([]);
  const [additionalEarnings, setAdditionalEarnings] = useState<DriverEarningsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "">("");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: format(subMonths(new Date(), 11), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [activeTab, setActiveTab] = useState<"trips" | "additional">("trips");

  // Export modal
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Get driver ID on mount
  useEffect(() => {
    async function getDriver() {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data, error: err } = await supabase
          .from("drivers")
          .select("id")
          .limit(1)
          .maybeSingle();
        if (err) throw new Error(err.message);
        if (data) setDriverId(data.id);
      } catch (e) {
        console.error("Failed to get driver:", e);
      }
    }
    getDriver();
  }, []);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    setError(null);
    try {
      const [statsRes, monthlyRes, tripRes, additionalRes] = await Promise.all([
        revenueApi.getDriverStats(driverId, {
          startDate: dateRange.start,
          endDate: dateRange.end,
        }),
        revenueApi.getDriverMonthlyEarnings(driverId, 12),
        revenueApi.getDriverTripEarnings(driverId, {
          startDate: dateRange.start,
          endDate: dateRange.end,
          paymentStatus: paymentFilter,
        }),
        revenueApi.getDriverAdditionalEarnings(driverId),
      ]);
      setStats(statsRes);
      setMonthlyData(monthlyRes);
      setTripEarnings(tripRes);
      setAdditionalEarnings(additionalRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load earnings data.");
    } finally {
      setLoading(false);
    }
  }, [driverId, dateRange, paymentFilter]);

  useEffect(() => {
    if (driverId) load();
  }, [load, driverId]);

  const chartData = useMemo(() => {
    return monthlyData.map(d => ({
      ...d,
      earningsFormatted: fmtShortCurrency(d.driverEarnings),
    }));
  }, [monthlyData]);

  const pieData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Paid", value: stats.paidEarnings },
      { name: "Pending", value: stats.pendingEarnings },
    ];
  }, [stats]);

  const filteredTripEarnings = useMemo(() => {
    if (!paymentFilter) return tripEarnings;
    return tripEarnings.filter(t => t.payment_status === paymentFilter);
  }, [tripEarnings, paymentFilter]);

  async function handleExport() {
    if (!driverId) return;
    setExporting(true);
    try {
      const csv = await revenueApi.exportDriverEarningsCSV(driverId);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `earnings-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
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
        label: "Total Earnings",
        value: fmtCurrency(stats.totalEarnings),
        icon: HiOutlineBanknotes,
        bg: "from-emerald-500 to-emerald-600",
      },
      {
        label: "Monthly Earnings",
        value: fmtCurrency(stats.monthlyEarnings),
        icon: HiOutlineChartBar,
        bg: "from-aqua to-[oklch(0.55_0.12_230)]",
      },
      {
        label: "Completed Trips",
        value: String(stats.completedTrips),
        icon: HiOutlineClipboardDocumentList,
        bg: "from-slate-500 to-slate-600",
      },
      {
        label: "Pending",
        value: fmtCurrency(stats.pendingEarnings),
        icon: HiOutlineReceiptRefund,
        bg: "from-amber-500 to-amber-600",
      },
    ] as const;
  }, [stats]);

  if (!driverId) {
    return (
      <div>
        <DSection title="My Earnings" description="Track your earnings from completed trips." />
        <DCard className="p-6">
          <DEmpty>
            <p className="text-muted-foreground">No driver profile found. Please log in as a driver.</p>
          </DEmpty>
        </DCard>
      </div>
    );
  }

  return (
    <div>
      <DSection
        title="My Earnings"
        description="Track your earnings from completed trips and additional bonuses."
        actions={
          <div className="flex gap-2">
            <DButton variant="secondary" onClick={load}>
              <HiOutlineArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </DButton>
            <DButton onClick={() => setExportOpen(true)}>
              <HiOutlineArrowDownTray className="h-4 w-4" />
              Export
            </DButton>
          </div>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
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
                <div className={cn("grid h-10 w-10 place-items-center rounded-xl text-white bg-gradient-to-br", s.bg)}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Earnings Trend */}
        <div className="card-3d rounded-2xl p-5 xl:col-span-2">
          <h3 className="font-display text-lg font-bold text-ink">Earnings Trend</h3>
          <p className="text-xs text-muted-foreground">Your monthly earnings over the last 12 months.</p>
          <div className="mt-4 h-64">
            {loading ? (
              <div className="h-full animate-pulse rounded-xl bg-muted" />
            ) : monthlyData.length === 0 || monthlyData.every(d => d.driverEarnings === 0) ? (
              <DEmpty>
                <p className="text-muted-foreground">Complete trips to see your earnings trend.</p>
              </DEmpty>
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
                    dataKey="driverEarnings"
                    stroke="oklch(0.7 0.14 160)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "oklch(0.7 0.14 160)" }}
                    name="Earnings"
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
          <p className="text-xs text-muted-foreground">Breakdown of your earnings by status.</p>
          <div className="mt-4 h-64">
            {loading ? (
              <div className="h-full animate-pulse rounded-xl bg-muted" />
            ) : pieData.every(d => d.value === 0) ? (
              <DEmpty>
                <p className="text-muted-foreground">No earnings yet.</p>
              </DEmpty>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
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

      {/* Filters */}
      <div className="card-3d mb-4 rounded-2xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("trips")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                activeTab === "trips"
                  ? "bg-aqua text-aqua-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              Trip Earnings
            </button>
            <button
              onClick={() => setActiveTab("additional")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                activeTab === "additional"
                  ? "bg-aqua text-aqua-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              Additional Earnings
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <HiOutlineReceiptRefund className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as PaymentStatus | "")}
                className="h-11 rounded-lg border border-input bg-surface pl-9 pr-8 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="refunded">Refunded</option>
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

      {/* Content */}
      {activeTab === "trips" ? (
        <TripEarningsTable
          data={filteredTripEarnings}
          loading={loading}
        />
      ) : (
        <AdditionalEarningsList
          data={additionalEarnings}
          loading={loading}
        />
      )}

      {/* Export Modal */}
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
        exporting={exporting}
      />
    </div>
  );
}

function TripEarningsTable({ data, loading }: { data: TripEarningsBreakdown[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="card-3d rounded-2xl p-6">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <DCard className="p-6">
        <DEmpty>
          <p className="text-muted-foreground">No trip earnings found. Complete trips to see your earnings.</p>
        </DEmpty>
      </DCard>
    );
  }

  return (
    <div className="card-3d overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse text-sm">
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
                Your Earnings
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                Base
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                Distance
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((trip) => (
              <motion.tr
                key={trip.trip_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group border-b border-border transition hover:bg-surface-muted/60"
              >
                <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">
                  {trip.trip_code}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div className="max-w-[180px] truncate">
                    {trip.pickup_location} → {trip.drop_location}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {fmtDate(trip.completed_at)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-ink">
                  {fmtCurrency(trip.fare_amount)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600">
                  {fmtCurrency(trip.driver_earnings)}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {fmtCurrency(trip.base_fare)}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {trip.distance_km ? `${trip.distance_km} km` : "—"}
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
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Total from {data.length} trip{data.length !== 1 ? "s" : ""}: <span className="font-semibold text-ink">{fmtCurrency(data.reduce((sum, t) => sum + t.driver_earnings, 0))}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function AdditionalEarningsList({ data, loading }: { data: DriverEarningsRecord[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="card-3d rounded-2xl p-6">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <DCard className="p-6">
        <DEmpty>
          <p className="text-muted-foreground">No additional earnings recorded yet.</p>
        </DEmpty>
      </DCard>
    );
  }

  return (
    <div className="card-3d rounded-2xl p-6">
      <div className="grid gap-3">
        {data.map((record) => {
          const Icon = EARNINGS_TYPE_ICON[record.earnings_type];
          const isPenalty = record.earnings_type === "penalty";
          return (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-4 rounded-xl border border-border bg-surface-muted/40 p-4 transition hover:bg-surface-muted"
            >
              <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", EARNINGS_TYPE_TONE[record.earnings_type])}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      {EARNINGS_TYPE_LABEL[record.earnings_type]}
                      {record.trip_code && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          ({record.trip_code})
                        </span>
                      )}
                    </p>
                    {record.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{record.description}</p>
                    )}
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <HiOutlineCalendar className="h-3.5 w-3.5" />
                      {fmtDate(record.earned_date)}
                      {record.status === "paid" && record.paid_at && (
                        <span className="text-emerald-600">• Paid {fmtDate(record.paid_at)}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-lg font-bold", isPenalty ? "text-red-600" : "text-emerald-600")}>
                      {isPenalty ? "-" : "+"}{fmtCurrency(record.amount)}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                        record.status === "paid"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-amber-300 bg-amber-50 text-amber-700"
                      )}
                    >
                      {record.status === "paid" ? "Paid" : "Pending"}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ExportModal({
  open,
  onClose,
  onExport,
  exporting,
}: {
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  exporting: boolean;
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
            className="glass relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-white">
                  <HiOutlineArrowDownTray className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-ink">Export Earnings</h2>
                  <p className="text-sm text-muted-foreground">Download your earnings as CSV.</p>
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

            <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              The report will include all your trip earnings and additional earnings (bonuses, adjustments, etc.).
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <DButton variant="secondary" onClick={onClose} disabled={exporting}>
                Cancel
              </DButton>
              <DButton onClick={onExport} disabled={exporting}>
                {exporting ? "Exporting…" : "Download CSV"}
              </DButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
