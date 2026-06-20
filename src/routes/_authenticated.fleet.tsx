import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import {
  HiOutlinePlus,
  HiOutlineEye,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineTruck,
  HiOutlineCheckCircle,
  HiOutlineWrenchScrewdriver,
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlineExclamationTriangle,
  HiOutlineArrowPath,
  HiOutlineChevronUp,
  HiOutlineChevronDown,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineUserPlus,
  HiOutlineXMark,
  HiOutlineClock,
  HiOutlineClipboardDocumentList,
  HiOutlineUserGroup,
  HiOutlineCircleStack,
} from "react-icons/hi2";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { MButton, MInput, MField, MEmpty } from "@/components/management/ManagementUI";
import {
  vehicleApi,
  type VehicleRow,
  type VehicleType,
  type VehicleStatus,
  type VehicleSortKey,
  type VehicleInput,
  type VehicleAssignment,
} from "@/lib/vehicleApi";
import type { Driver } from "@/lib/driverApi";

export const Route = createFileRoute("/_authenticated/fleet")({
  head: () => ({ meta: [{ title: "Vehicle Management — SmartOps" }] }),
  component: VehicleManagementPage,
});

type SortDir = "asc" | "desc";

const TYPE_LABEL: Record<VehicleType, string> = {
  truck: "Truck",
  van: "Van",
  trailer: "Trailer",
  bus: "Bus",
  car: "Car",
};

const STATUS_LABEL: Record<VehicleStatus, string> = {
  active: "Active",
  idle: "Idle",
  maintenance: "Maintenance",
  retired: "Retired",
};

const STATUS_BADGE: Record<VehicleStatus, string> = {
  active: "border-aqua/30 bg-aqua-soft text-ink",
  idle: "border-border bg-muted text-muted-foreground",
  maintenance: "border-[oklch(0.82_0.08_80)]/40 bg-[oklch(0.95_0.06_70)] text-ink",
  retired: "border-destructive/30 bg-destructive/10 text-destructive",
};

const STATUS_DOT: Record<VehicleStatus, string> = {
  active: "bg-aqua",
  idle: "bg-muted-foreground",
  maintenance: "bg-[oklch(0.7_0.13_60)]",
  retired: "bg-destructive",
};

interface ColumnDef {
  key: VehicleSortKey;
  label: string;
  sortable: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: "vehicle_number", label: "Vehicle #", sortable: true },
  { key: "vehicle_type", label: "Type", sortable: true },
  { key: "model", label: "Model", sortable: true },
  { key: "registration_number", label: "Reg. #", sortable: true },
  { key: "insurance_expiry", label: "Insurance", sortable: true },
  { key: "capacity", label: "Capacity", sortable: true },
  { key: "status", label: "Status", sortable: true },
];

const PAGE_SIZE = 8;

const EMPTY_FORM: VehicleInput = {
  vehicle_number: "",
  vehicle_type: "truck",
  model: "",
  registration_number: "",
  insurance_expiry: "",
  capacity: 0,
  status: "active",
  assigned_driver_id: null,
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "MMM d, yyyy") : "—";
}

function fmtCapacity(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${kg} kg`;
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

function VehicleManagementPage() {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<VehicleType | "">("");
  const [sortKey, setSortKey] = useState<VehicleSortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  // Form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleRow | null>(null);
  const [form, setForm] = useState<VehicleInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Assign driver modal
  const [assignTarget, setAssignTarget] = useState<VehicleRow | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignDriverId, setAssignDriverId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  // History drawer
  const [historyTarget, setHistoryTarget] = useState<VehicleRow | null>(null);
  const [history, setHistory] = useState<VehicleAssignment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<VehicleRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await vehicleApi.list({
        search: debouncedSearch,
        status: statusFilter,
        type: typeFilter,
        sort: sortKey,
        ascending: sortDir === "asc",
        page,
        pageSize: PAGE_SIZE,
      });
      setVehicles(res.rows);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vehicles.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, typeFilter, sortKey, sortDir, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const active = vehicles.filter((v) => v.status === "active").length;
    const maint = vehicles.filter((v) => v.status === "maintenance").length;
    const idle = vehicles.filter((v) => v.status === "idle").length;
    return { total, active, maint, idle };
  }, [vehicles, total]);

  function toggleSort(key: VehicleSortKey) {
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
  }

  function openEdit(v: VehicleRow) {
    setEditing(v);
    setForm({
      vehicle_number: v.vehicle_number,
      vehicle_type: v.vehicle_type,
      model: v.model,
      registration_number: v.registration_number,
      insurance_expiry: v.insurance_expiry ?? "",
      capacity: Number(v.capacity),
      status: v.status,
      assigned_driver_id: v.assigned_driver_id,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vehicle_number.trim() || !form.model.trim()) {
      setFormError("Vehicle number and model are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) await vehicleApi.update(editing.id, form);
      else await vehicleApi.create(form);
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function openAssign(v: VehicleRow) {
    setAssignTarget(v);
    setAssignDriverId(v.assigned_driver_id ?? "");
    setAssigning(false);
    try {
      const d = await vehicleApi.availableDrivers();
      setDrivers(d);
    } catch {
      setDrivers([]);
    }
  }

  async function confirmAssign() {
    if (!assignTarget) return;
    setAssigning(true);
    setFormError(null);
    try {
      const driver =
        drivers.find((d) => d.id === assignDriverId) ?? null;
      await vehicleApi.assignDriver(assignTarget.id, driver);
      setAssignTarget(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Assignment failed.");
    } finally {
      setAssigning(false);
    }
  }

  async function openHistory(v: VehicleRow) {
    setHistoryTarget(v);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const h = await vehicleApi.history(v.id);
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
      await vehicleApi.remove(deleteTarget.id);
      setDeleteTarget(null);
      if (vehicles.length === 1 && page > 1) setPage(page - 1);
      else await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  const STAT_CARDS = [
    { label: "Total Vehicles", value: stats.total, icon: HiOutlineTruck, tone: "aqua" },
    { label: "Active", value: stats.active, icon: HiOutlineCheckCircle, tone: "emerald" },
    { label: "Maintenance", value: stats.maint, icon: HiOutlineWrenchScrewdriver, tone: "amber" },
    { label: "Idle", value: stats.idle, icon: HiOutlineCircleStack, tone: "slate" },
  ] as const;

  const toneBg: Record<string, string> = {
    aqua: "bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)]",
    emerald: "bg-gradient-to-br from-[oklch(0.7_0.14_160)] to-[oklch(0.5_0.1_160)]",
    amber: "bg-gradient-to-br from-[oklch(0.8_0.13_70)] to-[oklch(0.6_0.13_60)]",
    slate: "bg-gradient-to-br from-[oklch(0.5_0.02_240)] to-[oklch(0.3_0.02_240)]",
  };

  return (
    <div>
      <PageHeader
        title="Vehicle Management"
        description="Add vehicles, assign drivers, and track assignment history."
        actions={
          <MButton onClick={openCreate}>
            <HiOutlinePlus className="h-4 w-4" /> Add Vehicle
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
            placeholder="Search by number, model, registration…"
            className="h-11 w-full rounded-lg border border-input bg-surface pl-9 pr-3 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <HiOutlineTruck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as VehicleType | "")}
              className="h-11 rounded-lg border border-input bg-surface pl-9 pr-8 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
            >
              <option value="">All Types</option>
              <option value="truck">Truck</option>
              <option value="van">Van</option>
              <option value="trailer">Trailer</option>
              <option value="bus">Bus</option>
              <option value="car">Car</option>
            </select>
          </div>
          <div className="relative">
            <HiOutlineFunnel className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VehicleStatus | "")}
              className="h-11 rounded-lg border border-input bg-surface pl-9 pr-8 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="idle">Idle</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          <MButton variant="secondary" size="md" onClick={load} aria-label="Refresh">
            <HiOutlineArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
          </MButton>
        </div>
      </div>

      {/* Errors */}
      {error ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <HiOutlineExclamationTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Something went wrong.</p>
            <p className="text-xs text-destructive/80">{error}</p>
          </div>
        </div>
      ) : null}

      {/* Table */}
      {!error && !loading && vehicles.length === 0 ? (
        <MEmpty
          icon={HiOutlineTruck}
          title="No vehicles found"
          body="Try adjusting your search or filters, or add a new vehicle."
        />
      ) : (
        <div className="card-3d overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left">
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
                    Assigned Driver
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
                        {Array.from({ length: COLUMNS.length + 2 }).map((_, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <span className="block h-4 w-full animate-pulse rounded bg-muted" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : vehicles.map((v) => (
                      <motion.tr
                        key={v.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group border-b border-border transition hover:bg-surface-muted/60"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">
                          {v.vehicle_number}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/40 px-2 py-0.5 text-xs font-semibold text-ink">
                            <HiOutlineTruck className="h-3.5 w-3.5 text-aqua" />
                            {TYPE_LABEL[v.vehicle_type]}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-ink">{v.model}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {v.registration_number}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {fmtDate(v.insurance_expiry)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {fmtCapacity(Number(v.capacity))}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                              STATUS_BADGE[v.status],
                            )}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[v.status])} />
                            {STATUS_LABEL[v.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {v.drivers ? (
                            <span className="inline-flex items-center gap-1.5 text-ink">
                              <HiOutlineUserGroup className="h-4 w-4 text-aqua" />
                              <span className="font-medium">{v.drivers.full_name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                ({v.drivers.driver_code})
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs italic text-muted-foreground">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openAssign(v)}
                              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-aqua-soft hover:text-aqua"
                              title="Assign driver"
                            >
                              <HiOutlineUserPlus className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openHistory(v)}
                              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-aqua-soft hover:text-aqua"
                              title="Assignment history"
                            >
                              <HiOutlineClipboardDocumentList className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openEdit(v)}
                              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-aqua-soft hover:text-aqua"
                              title="Edit"
                            >
                              <HiOutlinePencilSquare className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(v)}
                              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                              title="Delete"
                            >
                              <HiOutlineTrash className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Loading…"
                : `Showing ${vehicles.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + vehicles.length} of ${total}`}
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

      {/* Add / Edit Modal */}
      <VehicleFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        saving={saving}
        error={formError}
      />

      {/* Assign Driver Modal */}
      <AnimatePresence>
        {assignTarget && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              onClick={() => !assigning && setAssignTarget(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
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
                    <HiOutlineUserPlus className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-ink">Assign Driver</h2>
                    <p className="text-sm text-muted-foreground">
                      {assignTarget.vehicle_number} · {assignTarget.model}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAssignTarget(null)}
                  className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-ink"
                  aria-label="Close"
                >
                  <HiOutlineXMark className="h-5 w-5" />
                </button>
              </div>

              {assignTarget.drivers && (
                <p className="mb-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Currently assigned:{" "}
                  <span className="font-semibold text-ink">{assignTarget.drivers.full_name}</span>
                </p>
              )}

              <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                {drivers.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    No drivers available. Add drivers first.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    <li>
                      <button
                        onClick={() => setAssignDriverId("")}
                        className={cn(
                          "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-muted",
                          assignDriverId === "" && "bg-aqua-soft",
                        )}
                      >
                        <span className="italic text-muted-foreground">Unassign</span>
                      </button>
                    </li>
                    {drivers.map((d) => {
                      const onAnotherVehicle = vehicles.find(
                        (v) => v.assigned_driver_id === d.id && v.id !== assignTarget.id,
                      );
                      return (
                        <li key={d.id}>
                          <button
                            onClick={() => setAssignDriverId(d.id)}
                            className={cn(
                              "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-muted",
                              assignDriverId === d.id && "bg-aqua-soft",
                            )}
                          >
                            <span>
                              <span className="font-medium text-ink">{d.full_name}</span>
                              <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                                {d.driver_code}
                              </span>
                            </span>
                            {onAnotherVehicle ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                on {onAnotherVehicle.vehicle_number}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <MButton variant="secondary" onClick={() => setAssignTarget(null)} disabled={assigning}>
                  Cancel
                </MButton>
                <MButton onClick={confirmAssign} disabled={assigning}>
                  {assigning ? "Assigning…" : "Confirm Assignment"}
                </MButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Drawer */}
      <VehicleHistoryDrawer
        vehicle={historyTarget}
        history={history}
        loading={historyLoading}
        onClose={() => setHistoryTarget(null)}
      />

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
                  <h2 className="font-display text-lg font-bold text-ink">Delete vehicle?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This will permanently remove{" "}
                    <span className="font-semibold text-ink">{deleteTarget.vehicle_number}</span> (
                    {deleteTarget.model}) and its assignment history. This action cannot be undone.
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

/* ---------------- Add / Edit Form ---------------- */

function VehicleFormModal({
  open,
  onClose,
  editing,
  form,
  setForm,
  onSubmit,
  saving,
  error,
}: {
  open: boolean;
  onClose: () => void;
  editing: VehicleRow | null;
  form: VehicleInput;
  setForm: (f: VehicleInput) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  error: string | null;
}) {
  function set<K extends keyof VehicleInput>(key: K, value: VehicleInput[K]) {
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
                    {editing ? "Edit Vehicle" : "Add New Vehicle"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {editing ? editing.vehicle_number : "Fields marked * are required."}
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
                <MField label="Vehicle Number *">
                  <MInput
                    value={form.vehicle_number}
                    onChange={(e) => set("vehicle_number", e.target.value)}
                    placeholder="TRK-8821"
                    required
                  />
                </MField>
                <MField label="Vehicle Type">
                  <select
                    value={form.vehicle_type}
                    onChange={(e) => set("vehicle_type", e.target.value as VehicleType)}
                    className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
                  >
                    <option value="truck">Truck</option>
                    <option value="van">Van</option>
                    <option value="trailer">Trailer</option>
                    <option value="bus">Bus</option>
                    <option value="car">Car</option>
                  </select>
                </MField>
                <MField label="Model *">
                  <MInput
                    value={form.model}
                    onChange={(e) => set("model", e.target.value)}
                    placeholder="Volvo FH16 2022"
                    required
                  />
                </MField>
                <MField label="Registration Number *">
                  <MInput
                    value={form.registration_number}
                    onChange={(e) => set("registration_number", e.target.value)}
                    placeholder="TX-AB-1234"
                    required
                  />
                </MField>
                <MField label="Insurance Expiry">
                  <MInput
                    type="date"
                    value={form.insurance_expiry ?? ""}
                    onChange={(e) => set("insurance_expiry", e.target.value)}
                  />
                </MField>
                <MField label="Capacity (kg)">
                  <MInput
                    type="number"
                    min={0}
                    value={form.capacity}
                    onChange={(e) => set("capacity", Number(e.target.value))}
                    placeholder="24000"
                  />
                </MField>
                <MField label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as VehicleStatus)}
                    className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
                  >
                    <option value="active">Active</option>
                    <option value="idle">Idle</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="retired">Retired</option>
                  </select>
                </MField>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <MButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
                  Cancel
                </MButton>
                <MButton type="submit" disabled={saving}>
                  {saving ? "Saving…" : editing ? "Save Changes" : "Create Vehicle"}
                </MButton>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- History Drawer ---------------- */

function VehicleHistoryDrawer({
  vehicle,
  history,
  loading,
  onClose,
}: {
  vehicle: VehicleRow | null;
  history: VehicleAssignment[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {vehicle && (
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
            <div className="relative overflow-hidden bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] p-6 text-white">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-md p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
                aria-label="Close"
              >
                <HiOutlineXMark className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/20 ring-2 ring-white/30">
                  <HiOutlineTruck className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-white/80">
                    {vehicle.vehicle_number}
                  </p>
                  <h2 className="font-display text-2xl font-bold">{vehicle.model}</h2>
                  <span
                    className={cn(
                      "mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold",
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    {STATUS_LABEL[vehicle.status]}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-b border-border bg-surface-muted px-6 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <HiOutlineClipboardDocumentList className="h-4 w-4 text-aqua" />
                Assignment History
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <HiOutlineClipboardDocumentList className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No assignment history yet.</p>
                </div>
              ) : (
                <ol className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
                  {history.map((h) => {
                    const assigned = h.action === "assigned";
                    return (
                      <li key={h.id} className="relative flex gap-3">
                        <span
                          className={cn(
                            "z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-surface",
                            assigned
                              ? "bg-[oklch(0.7_0.14_160)]"
                              : "bg-[oklch(0.7_0.13_60)]",
                          )}
                        >
                          {assigned ? (
                            <HiOutlineUserPlus className="h-4 w-4 text-white" />
                          ) : (
                            <HiOutlineUserGroup className="h-4 w-4 text-white" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface-muted/40 p-3">
                          <p className="text-sm font-semibold text-ink">
                            {assigned ? "Assigned to" : "Unassigned from"}{" "}
                            <span className="text-aqua">{h.driver_name}</span>
                          </p>
                          {h.note && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{h.note}</p>
                          )}
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <HiOutlineClock className="h-3 w-3" />
                            {fmtDate(h.created_at)} · {timeAgo(h.created_at)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
