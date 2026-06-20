import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import {
  HiOutlinePlus,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineTruck,
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlineExclamationTriangle,
  HiOutlineArrowPath,
  HiOutlineChevronUp,
  HiOutlineChevronDown,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineXMark,
  HiOutlineMapPin,
  HiOutlineFlag,
  HiOutlineArrowLongRight,
  HiOutlineClipboardDocumentList,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlinePlayCircle,
  HiOutlinePlay,
  HiOutlineNoSymbol,
  HiOutlineEye,
} from "react-icons/hi2";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useTripRealtime } from "@/hooks/use-realtime";
import { MButton, MInput, MField, MEmpty } from "@/components/management/ManagementUI";
import { useAuth } from "@/lib/auth";
import {
  tripApi,
  STATUS_ORDER,
  type Trip,
  type TripStatus,
  type TripInput,
  type TripStatusEntry,
  type DriverOption,
  type VehicleOption,
} from "@/lib/tripApi";

export const Route = createFileRoute("/_authenticated/trips")({
  head: () => ({ meta: [{ title: "Trip Management — SmartOps" }] }),
  component: TripManagementPage,
});

type SortDir = "asc" | "desc";
type SortKey = "trip_code" | "scheduled_date" | "distance_km" | "estimated_minutes" | "created_at" | "status";

const STATUS_LABEL: Record<TripStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  started: "Started",
  in_transit: "In Transit",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_BADGE: Record<TripStatus, string> = {
  pending: "border-border bg-muted text-muted-foreground",
  assigned: "border-[oklch(0.82_0.06_230)]/40 bg-[oklch(0.95_0.04_230)] text-ink",
  started: "border-[oklch(0.82_0.08_150)]/40 bg-[oklch(0.95_0.05_150)] text-ink",
  in_transit: "border-aqua/30 bg-aqua-soft text-ink",
  completed: "border-[oklch(0.82_0.14_160)]/40 bg-[oklch(0.95_0.06_160)] text-ink",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

const STATUS_DOT: Record<TripStatus, string> = {
  pending: "bg-muted-foreground",
  assigned: "bg-[oklch(0.65_0.1_230)]",
  started: "bg-[oklch(0.65_0.13_150)]",
  in_transit: "bg-aqua",
  completed: "bg-[oklch(0.65_0.14_160)]",
  cancelled: "bg-destructive",
};

const PAGE_SIZE = 8;

const EMPTY_FORM: TripInput = {
  trip_code: "",
  pickup_location: "",
  drop_location: "",
  scheduled_date: "",
  assigned_driver_id: null,
  assigned_vehicle_id: null,
  distance_km: null,
  estimated_minutes: null,
  status: "pending",
  notes: "",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "MMM d, yyyy") : "—";
}

function fmtDuration(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

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

const STATUS_ACTION: Partial<Record<TripStatus, { next: TripStatus; label: string; icon: React.ComponentType<{ className?: string }> }>> = {
  pending: { next: "assigned", label: "Mark Assigned", icon: HiOutlineFlag },
  assigned: { next: "started", label: "Start Trip", icon: HiOutlinePlay },
  started: { next: "in_transit", label: "Mark In Transit", icon: HiOutlineTruck },
  in_transit: { next: "completed", label: "Complete Trip", icon: HiOutlineCheckCircle },
};

function TripManagementPage() {
  const { user } = useAuth();
  const actor = user?.fullName ?? "Admin";

  const [trips, setTrips] = useState<Trip[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState<TripStatus | "">("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  // Form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [form, setForm] = useState<TripInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);

  // Detail/timeline drawer
  const [detailTrip, setDetailTrip] = useState<Trip | null>(null);
  const [history, setHistory] = useState<TripStatusEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState<Trip | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [canceling, setCanceling] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await tripApi.list({
        search: debouncedSearch,
        status: statusFilter,
        sort: sortKey,
        ascending: sortDir === "asc",
        page,
        pageSize: PAGE_SIZE,
      });
      setTrips(res.rows);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, sortKey, sortDir, page]);

  // Live updates: when any trip row changes (driver status update, assignment,
  // etc.), refresh the list without a page reload.
  useTripRealtime(true, () => { void load(); });

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  async function loadOptions() {
    try {
      const [d, v] = await Promise.all([tripApi.driverOptions(), tripApi.vehicleOptions()]);
      setDrivers(d);
      setVehicles(v);
    } catch {
      /* fall through to empty options */
    }
  }

  const stats = useMemo(() => {
    const by = (s: TripStatus) => trips.filter((t) => t.status === s).length;
    return {
      total,
      active: trips.filter((t) => ["assigned", "started", "in_transit"].includes(t.status)).length,
      completed: statsCompletedCount(trips),
      cancelled: by("cancelled"),
    };
  }, [trips, total]);

  function statsCompletedCount(list: Trip[]): number {
    return list.filter((t) => t.status === "completed").length;
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setFormOpen(true);
    void loadOptions();
  }

  function openEdit(t: Trip) {
    setEditing(t);
    setForm({
      trip_code: t.trip_code,
      pickup_location: t.pickup_location,
      drop_location: t.drop_location,
      scheduled_date: t.scheduled_date ?? "",
      assigned_driver_id: t.assigned_driver_id,
      assigned_vehicle_id: t.assigned_vehicle_id,
      distance_km: t.distance_km,
      estimated_minutes: t.estimated_minutes,
      status: t.status,
      notes: t.notes ?? "",
    });
    setFormError(null);
    setFormOpen(true);
    void loadOptions();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.pickup_location.trim() || !form.drop_location.trim()) {
      setFormError("Pickup and drop locations are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) await tripApi.update(editing.id, form);
      else await tripApi.create(form);
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function advance(t: Trip) {
    const action = STATUS_ACTION[t.status];
    if (!action) return;
    try {
      await tripApi.changeStatus(t.id, action.next, actor);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCanceling(true);
    try {
      await tripApi.cancel(cancelTarget.id, actor, cancelReason.trim() || undefined);
      setCancelTarget(null);
      setCancelReason("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCanceling(false);
    }
  }

  async function openDetail(t: Trip) {
    setDetailTrip(t);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const h = await tripApi.history(t.id);
      setHistory(h);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await tripApi.remove(deleteTarget.id);
      setDeleteTarget(null);
      if (trips.length === 1 && page > 1) setPage(page - 1);
      else await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const COLUMNS: { key: SortKey; label: string; sortable: boolean }[] = [
    { key: "trip_code", label: "Trip ID", sortable: true },
    { key: "scheduled_date", label: "Scheduled", sortable: true },
    { key: "distance_km", label: "Distance", sortable: true },
    { key: "estimated_minutes", label: "Est. Time", sortable: true },
    { key: "status", label: "Status", sortable: true },
  ];

  const STAT_CARDS = [
    { label: "Total Trips", value: stats.total, icon: HiOutlineTruck, tone: "aqua" },
    { label: "Active", value: stats.active, icon: HiOutlinePlayCircle, tone: "blue" },
    { label: "Completed", value: stats.completed, icon: HiOutlineCheckCircle, tone: "emerald" },
    { label: "Cancelled", value: stats.cancelled, icon: HiOutlineXCircle, tone: "slate" },
  ] as const;

  const toneBg: Record<string, string> = {
    aqua: "bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)]",
    blue: "bg-gradient-to-br from-[oklch(0.6_0.13_250)] to-[oklch(0.4_0.1_250)]",
    emerald: "bg-gradient-to-br from-[oklch(0.7_0.14_160)] to-[oklch(0.5_0.1_160)]",
    slate: "bg-gradient-to-br from-[oklch(0.5_0.02_240)] to-[oklch(0.3_0.02_240)]",
  };

  return (
    <div>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            Trip Management
            <span className="inline-flex items-center gap-1 rounded-full border border-aqua/30 bg-aqua-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-aqua">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aqua opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-aqua" />
              </span>
              Live
            </span>
          </span>
        }
        description="Create trips, assign drivers and vehicles, and track progress through the delivery lifecycle."
        actions={
          <MButton onClick={openCreate}>
            <HiOutlinePlus className="h-4 w-4" /> Create Trip
          </MButton>
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
                  <p className="mt-2 font-display text-3xl font-bold text-ink">
                    {loading ? (
                      <span className="inline-block h-8 w-12 animate-pulse rounded bg-muted" />
                    ) : (
                      s.value
                    )}
                  </p>
                </div>
                <div className={cn("grid h-11 w-11 place-items-center rounded-xl text-white", toneBg[s.tone])}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="card-3d mb-4 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by trip ID, locations, notes…"
            className="h-11 w-full rounded-lg border border-input bg-surface pl-9 pr-3 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <HiOutlineFunnel className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TripStatus | "")}
              className="h-11 rounded-lg border border-input bg-surface pl-9 pr-8 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
            >
              <option value="">All Statuses</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <MButton variant="secondary" size="md" onClick={load} aria-label="Refresh">
            <HiOutlineArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
          </MButton>
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

      {!error && !loading && trips.length === 0 ? (
        <MEmpty
          icon={HiOutlineTruck}
          title="No trips found"
          body="Try adjusting your search or filters, or create a new trip."
        />
      ) : (
        <div className="card-3d overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left">
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Route
                  </th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                        col.sortable && "cursor-pointer select-none hover:text-ink",
                      )}
                      onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {col.sortable && sortKey === col.key ? (
                          sortDir === "asc" ? (
                            <HiOutlineChevronUp className="h-3.5 w-3.5 text-aqua" />
                          ) : (
                            <HiOutlineChevronDown className="h-3.5 w-3.5 text-aqua" />
                          )
                        ) : null}
                      </span>
                    </th>
                  ))}
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Driver / Vehicle
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {Array.from({ length: COLUMNS.length + 3 }).map((_, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <span className="block h-4 w-full animate-pulse rounded bg-muted" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : trips.map((t) => {
                      const action = STATUS_ACTION[t.status];
                      const AdvanceIcon = action?.icon;
                      const canAdvance = !!action;
                      const isTerminal = t.status === "completed" || t.status === "cancelled";
                      return (
                        <motion.tr
                          key={t.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="group border-b border-border transition hover:bg-surface-muted/60"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-ink">
                                {t.trip_code}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <HiOutlineMapPin className="h-3 w-3 text-aqua" />
                              <span className="truncate">{t.pickup_location}</span>
                              <HiOutlineArrowLongRight className="h-3 w-3 shrink-0" />
                              <span className="truncate">{t.drop_location}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {fmtDate(t.scheduled_date)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {t.distance_km ? `${Number(t.distance_km).toFixed(0)} km` : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {fmtDuration(t.estimated_minutes ? Number(t.estimated_minutes) : null)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                                STATUS_BADGE[t.status],
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[t.status])} />
                              {STATUS_LABEL[t.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {t.drivers || t.vehicles ? (
                              <div className="flex flex-col gap-0.5">
                                {t.drivers && (
                                  <span className="text-xs font-medium text-ink">
                                    {t.drivers.full_name}
                                  </span>
                                )}
                                {t.vehicles && (
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {t.vehicles.vehicle_number}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs italic text-muted-foreground">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openDetail(t)}
                                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-aqua-soft hover:text-aqua"
                                title="View timeline"
                              >
                                <HiOutlineEye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openEdit(t)}
                                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-aqua-soft hover:text-aqua"
                                title="Edit"
                              >
                                <HiOutlinePencilSquare className="h-4 w-4" />
                              </button>
                              {canAdvance && AdvanceIcon && (
                                <button
                                  onClick={() => advance(t)}
                                  className="rounded-md p-1.5 text-muted-foreground transition hover:bg-aqua-soft hover:text-aqua"
                                  title={action!.label}
                                >
                                  <AdvanceIcon className="h-4 w-4" />
                                </button>
                              )}
                              {!isTerminal && t.status !== "cancelled" && (
                                <button
                                  onClick={() => setCancelTarget(t)}
                                  className="rounded-md p-1.5 text-muted-foreground transition hover:bg-[oklch(0.95_0.06_70)] hover:text-[oklch(0.5_0.13_60)]"
                                  title="Cancel trip"
                                >
                                  <HiOutlineNoSymbol className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => setDeleteTarget(t)}
                                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                                title="Delete"
                              >
                                <HiOutlineTrash className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Loading…"
                : `Showing ${trips.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + trips.length} of ${total}`}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <HiOutlineChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
                const p = i + 1;
                const active = p === page;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold transition",
                      active
                        ? "border-aqua bg-aqua text-aqua-foreground"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-ink",
                    )}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <HiOutlineChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <TripFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        saving={saving}
        error={formError}
        drivers={drivers}
        vehicles={vehicles}
      />

      {/* Timeline drawer */}
      <TripTimelineDrawer
        trip={detailTrip}
        history={history}
        loading={historyLoading}
        onClose={() => setDetailTrip(null)}
      />

      {/* Cancel confirm */}
      <AnimatePresence>
        {cancelTarget && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              onClick={() => !canceling && setCancelTarget(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="glass relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-[oklch(0.95_0.06_70)] text-[oklch(0.5_0.13_60)]">
                  <HiOutlineNoSymbol className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-bold text-ink">Cancel trip?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {cancelTarget.trip_code} — {cancelTarget.pickup_location} →{" "}
                    {cancelTarget.drop_location}
                  </p>
                  <div className="mt-3">
                    <MField label="Reason (optional)">
                      <MInput
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="e.g. Cancelled by customer"
                      />
                    </MField>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <MButton variant="secondary" onClick={() => setCancelTarget(null)} disabled={canceling}>
                  Keep Trip
                </MButton>
                <MButton variant="danger" onClick={confirmCancel} disabled={canceling}>
                  {canceling ? "Cancelling…" : "Cancel Trip"}
                </MButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              onClick={() => !deleting && setDeleteTarget(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="glass relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-destructive/10 text-destructive">
                  <HiOutlineTrash className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-bold text-ink">Delete trip?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This permanently removes{" "}
                    <span className="font-semibold text-ink">{deleteTarget.trip_code}</span> and its
                    status history. This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <MButton variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  Cancel
                </MButton>
                <MButton variant="danger" onClick={confirmDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete"}
                </MButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Create / Edit Form ---------------- */

function TripFormModal({
  open,
  onClose,
  editing,
  form,
  setForm,
  onSubmit,
  saving,
  error,
  drivers,
  vehicles,
}: {
  open: boolean;
  onClose: () => void;
  editing: Trip | null;
  form: TripInput;
  setForm: (f: TripInput) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  error: string | null;
  drivers: DriverOption[];
  vehicles: VehicleOption[];
}) {
  function set<K extends keyof TripInput>(key: K, value: TripInput[K]) {
    setForm({ ...form, [key]: value });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
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
            className="glass relative my-8 w-full max-w-3xl rounded-2xl p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-white">
                  <HiOutlineTruck className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-ink">
                    {editing ? "Edit Trip" : "Create New Trip"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {editing ? editing.trip_code : "Fields marked * are required."}
                  </p>
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

            <form onSubmit={onSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <HiOutlineExclamationTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MField label="Trip ID">
                  <MInput
                    value={form.trip_code ?? ""}
                    onChange={(e) => set("trip_code", e.target.value)}
                    placeholder="Auto-generated (TRP-0007)"
                  />
                </MField>
                <MField label="Scheduled Date">
                  <MInput
                    type="date"
                    value={form.scheduled_date ?? ""}
                    onChange={(e) => set("scheduled_date", e.target.value)}
                  />
                </MField>
                <MField label="Pickup Location *">
                  <MInput
                    value={form.pickup_location}
                    onChange={(e) => set("pickup_location", e.target.value)}
                    placeholder="Houston, TX"
                    required
                  />
                </MField>
                <MField label="Drop Location *">
                  <MInput
                    value={form.drop_location}
                    onChange={(e) => set("drop_location", e.target.value)}
                    placeholder="Dallas, TX"
                    required
                  />
                </MField>
                <MField label="Assigned Driver">
                  <select
                    value={form.assigned_driver_id ?? ""}
                    onChange={(e) => set("assigned_driver_id", e.target.value || null)}
                    className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
                  >
                    <option value="">— Unassigned —</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} ({d.driver_code})
                      </option>
                    ))}
                  </select>
                </MField>
                <MField label="Assigned Vehicle">
                  <select
                    value={form.assigned_vehicle_id ?? ""}
                    onChange={(e) => set("assigned_vehicle_id", e.target.value || null)}
                    className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
                  >
                    <option value="">— Unassigned —</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicle_number} · {v.model}
                      </option>
                    ))}
                  </select>
                </MField>
                <MField label="Distance (km)">
                  <MInput
                    type="number"
                    min={0}
                    step="0.1"
                    value={form.distance_km ?? ""}
                    onChange={(e) =>
                      set("distance_km", e.target.value === "" ? null : Number(e.target.value))
                    }
                    placeholder="385"
                  />
                </MField>
                <MField label="Estimated Time (minutes)">
                  <MInput
                    type="number"
                    min={0}
                    value={form.estimated_minutes ?? ""}
                    onChange={(e) =>
                      set("estimated_minutes", e.target.value === "" ? null : Number(e.target.value))
                    }
                    placeholder="240"
                  />
                </MField>
                <MField label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as TripStatus)}
                    className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </MField>
              </div>

              <MField label="Notes">
                <textarea
                  rows={2}
                  value={form.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Special instructions, cargo details…"
                  className="w-full rounded-lg border border-input bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
                />
              </MField>

              <div className="flex justify-end gap-2 pt-2">
                <MButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
                  Cancel
                </MButton>
                <MButton type="submit" disabled={saving}>
                  {saving ? "Saving…" : editing ? "Save Changes" : "Create Trip"}
                </MButton>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Timeline Drawer ---------------- */

function TripTimelineDrawer({
  trip,
  history,
  loading,
  onClose,
}: {
  trip: Trip | null;
  history: TripStatusEntry[];
  loading: boolean;
  onClose: () => void;
}) {
  if (!trip) return null;

  return (
    <AnimatePresence>
      {trip && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-surface shadow-2xl"
          >
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] p-6 text-white">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-md p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
                aria-label="Close"
              >
                <HiOutlineXMark className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/20 ring-2 ring-white/30">
                  <HiOutlineTruck className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-white/80">
                    {trip.trip_code}
                  </p>
                  <h2 className="font-display text-xl font-bold">Trip Timeline</h2>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-sm">
                <HiOutlineMapPin className="h-4 w-4" />
                <span className="truncate">{trip.pickup_location}</span>
                <HiOutlineArrowLongRight className="h-4 w-4 shrink-0" />
                <span className="truncate">{trip.drop_location}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-white/80">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 font-semibold",
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  {STATUS_LABEL[trip.status]}
                </span>
                {trip.drivers && <span>· {trip.drivers.full_name}</span>}
                {trip.vehicles && <span className="font-mono">· {trip.vehicles.vehicle_number}</span>}
              </div>
            </div>

            {/* Trip summary */}
            <div className="grid grid-cols-3 gap-2 border-b border-border bg-surface-muted px-6 py-3 text-center">
              <Sum cell label="Distance" value={trip.distance_km ? `${Number(trip.distance_km).toFixed(0)} km` : "—"} />
              <Sum cell label="Est. Time" value={fmtDuration(trip.estimated_minutes ? Number(trip.estimated_minutes) : null)} />
              <Sum cell label="Scheduled" value={fmtDate(trip.scheduled_date)} />
            </div>

            <div className="border-b border-border bg-surface-muted px-6 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <HiOutlineClipboardDocumentList className="h-4 w-4 text-aqua" />
                Status History
              </p>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <HiOutlineClock className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No status changes recorded.</p>
                </div>
              ) : (
                <ol className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
                  {[...history].reverse().map((h) => {
                    const terminalCompleted = h.status === "completed";
                    const cancelled = h.status === "cancelled";
                    return (
                      <li key={h.id} className="relative flex gap-3">
                        <span
                          className={cn(
                            "z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-surface",
                            cancelled
                              ? "bg-destructive"
                              : terminalCompleted
                                ? "bg-[oklch(0.65_0.14_160)]"
                                : "bg-aqua",
                          )}
                        >
                          {cancelled ? (
                            <HiOutlineXCircle className="h-4 w-4 text-white" />
                          ) : terminalCompleted ? (
                            <HiOutlineCheckCircle className="h-4 w-4 text-white" />
                          ) : (
                            <HiOutlineFlag className="h-4 w-4 text-white" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface-muted/40 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-ink">
                              {STATUS_LABEL[h.status]}
                            </p>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                STATUS_BADGE[h.status],
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[h.status])} />
                              {h.status}
                            </span>
                          </div>
                          {h.from_status && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              from {STATUS_LABEL[h.from_status]}
                            </p>
                          )}
                          {h.note && (
                            <p className="mt-1 text-xs text-muted-foreground">{h.note}</p>
                          )}
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <HiOutlineClock className="h-3 w-3" />
                            {fmtDate(h.created_at)} · {timeAgo(h.created_at)}
                            {h.actor && <span>· by {h.actor}</span>}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* Notes */}
            {trip.notes && (
              <div className="border-t border-border p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes
                </p>
                <p className="text-sm text-ink">{trip.notes}</p>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Sum({
  label,
  value,
}: {
  label: string;
  value: string;
  cell?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
