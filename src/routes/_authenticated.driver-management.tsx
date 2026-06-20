import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import {
  HiOutlinePlus,
  HiOutlineEye,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineUsers,
  HiOutlineUserCircle,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineTruck,
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlinePhone,
  HiOutlineIdentification,
  HiOutlineExclamationTriangle,
  HiOutlineArrowPath,
  HiOutlineChevronUp,
  HiOutlineChevronDown,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineEnvelope,
  HiOutlineMapPin,
  HiOutlineCalendarDays,
  HiOutlineXMark,
  HiOutlinePhoto,
  HiOutlineClock,
} from "react-icons/hi2";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounce";
import {
  MButton,
  MInput,
  MField,
  MEmpty,
} from "@/components/management/ManagementUI";
import {
  driverApi,
  type Driver,
  type DriverStatus,
  type DriverSortKey,
  type DriverInput,
} from "@/lib/driverApi";

export const Route = createFileRoute("/_authenticated/driver-management")({
  head: () => ({ meta: [{ title: "Driver Management — SmartOps" }] }),
  component: DriverManagementPage,
});

type SortDir = "asc" | "desc";

const STATUS_LABEL: Record<DriverStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  on_leave: "On Leave",
};

const STATUS_BADGE: Record<DriverStatus, string> = {
  active: "border-aqua/30 bg-aqua-soft text-ink",
  inactive: "border-border bg-muted text-muted-foreground",
  on_leave: "border-[oklch(0.82_0.08_80)]/40 bg-[oklch(0.95_0.06_70)] text-ink",
};

const STATUS_DOT: Record<DriverStatus, string> = {
  active: "bg-aqua",
  inactive: "bg-muted-foreground",
  on_leave: "bg-[oklch(0.7_0.13_60)]",
};

interface ColumnDef {
  key: DriverSortKey;
  label: string;
  sortable: boolean;
  className?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: "driver_code", label: "Driver ID", sortable: true },
  { key: "full_name", label: "Full Name", sortable: true },
  { key: "email", label: "Email", sortable: true },
  { key: "phone", label: "Phone", sortable: true },
  { key: "license_number", label: "License #", sortable: false },
  { key: "license_expiry", label: "Lic. Expiry", sortable: true },
  { key: "vehicle_assigned", label: "Vehicle", sortable: true },
  { key: "joining_date", label: "Joined", sortable: true },
  { key: "status", label: "Status", sortable: true },
];

const PAGE_SIZE = 8;

const EMPTY_FORM: DriverInput = {
  driver_code: "",
  full_name: "",
  email: "",
  phone: "",
  address: "",
  license_number: "",
  license_expiry: "",
  vehicle_assigned: "",
  joining_date: "",
  status: "active",
  profile_photo: "",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "MMM d, yyyy") : "—";
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function DriverManagementPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState<DriverStatus | "">("");
  const [sortKey, setSortKey] = useState<DriverSortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [form, setForm] = useState<DriverInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Details drawer
  const [detailDriver, setDetailDriver] = useState<Driver | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await driverApi.list({
        search: debouncedSearch,
        status: statusFilter,
        sort: sortKey,
        ascending: sortDir === "asc",
        page,
        pageSize: PAGE_SIZE,
      });
      setDrivers(res.rows);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drivers.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, sortKey, sortDir, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 when filters/search change.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const stats = useMemo(() => {
    const active = drivers.filter((d) => d.status === "active").length;
    const onLeave = drivers.filter((d) => d.status === "on_leave").length;
    return { total, active, onLeave, inactive: total - active - onLeave };
  }, [drivers, total]);

  function toggleSort(key: DriverSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
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

  function openEdit(d: Driver) {
    setEditing(d);
    setForm({
      driver_code: d.driver_code,
      full_name: d.full_name,
      email: d.email ?? "",
      phone: d.phone ?? "",
      address: d.address ?? "",
      license_number: d.license_number ?? "",
      license_expiry: d.license_expiry ?? "",
      vehicle_assigned: d.vehicle_assigned ?? "",
      joining_date: d.joining_date ?? "",
      status: d.status,
      profile_photo: d.profile_photo ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setFormError("Full name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await driverApi.update(editing.id, form);
      } else {
        await driverApi.create(form);
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await driverApi.remove(deleteTarget.id);
      setDeleteTarget(null);
      if (drivers.length === 1 && page > 1) setPage(page - 1);
      else await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  const STAT_CARDS = [
    { label: "Total Drivers", value: stats.total, icon: HiOutlineUsers, tone: "aqua" },
    { label: "Active", value: stats.active, icon: HiOutlineCheckCircle, tone: "emerald" },
    { label: "On Leave", value: stats.onLeave, icon: HiOutlineClock, tone: "amber" },
    { label: "Inactive", value: stats.inactive, icon: HiOutlineXCircle, tone: "slate" },
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
        title="Driver Management"
        description="Add, edit, and track all drivers in your fleet."
        actions={
          <MButton onClick={openCreate}>
            <HiOutlinePlus className="h-4 w-4" /> Add Driver
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
            placeholder="Search by name, ID, phone, license, vehicle…"
            className="h-11 w-full rounded-lg border border-input bg-surface pl-9 pr-3 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <HiOutlineFunnel className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DriverStatus | "")}
              className="h-11 rounded-lg border border-input bg-surface pl-9 pr-8 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_leave">On Leave</option>
            </select>
          </div>
          <MButton variant="secondary" size="md" onClick={load} aria-label="Refresh">
            <HiOutlineArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
          </MButton>
        </div>
      </div>

      {/* Table */}
      {error ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <HiOutlineExclamationTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Something went wrong.</p>
            <p className="text-xs text-destructive/80">{error}</p>
          </div>
        </div>
      ) : null}

      {!error && !loading && drivers.length === 0 ? (
        <MEmpty
          icon={HiOutlineUsers}
          title="No drivers found"
          body="Try adjusting your search or filters, or add a new driver."
        />
      ) : (
        <div className="card-3d overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-sm">
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
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {Array.from({ length: COLUMNS.length + 1 }).map((_, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <span className="block h-4 w-full animate-pulse rounded bg-muted" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : drivers.map((d) => (
                      <motion.tr
                        key={d.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group border-b border-border transition hover:bg-surface-muted/60"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">
                          {d.driver_code}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {d.profile_photo ? (
                              <img
                                src={d.profile_photo}
                                alt={d.full_name}
                                className="h-8 w-8 rounded-full object-cover ring-2 ring-border"
                              />
                            ) : (
                              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-xs font-bold text-white">
                                {initials(d.full_name)}
                              </span>
                            )}
                            <span className="font-semibold text-ink">{d.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{d.email || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{d.phone || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {d.license_number || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {fmtDate(d.license_expiry)}
                        </td>
                        <td className="px-4 py-3">
                          {d.vehicle_assigned ? (
                            <span className="inline-flex items-center gap-1 text-ink">
                              <HiOutlineTruck className="h-4 w-4 text-aqua" />
                              {d.vehicle_assigned}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {fmtDate(d.joining_date)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                              STATUS_BADGE[d.status],
                            )}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[d.status])} />
                            {STATUS_LABEL[d.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setDetailDriver(d)}
                              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-aqua-soft hover:text-aqua"
                              title="View details"
                            >
                              <HiOutlineEye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openEdit(d)}
                              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-aqua-soft hover:text-aqua"
                              title="Edit"
                            >
                              <HiOutlinePencilSquare className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(d)}
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
                : `Showing ${drivers.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + drivers.length} of ${total}`}
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
      <DriverFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        saving={saving}
        error={formError}
      />

      {/* Details Drawer */}
      <DriverDetailsDrawer driver={detailDriver} onClose={() => setDetailDriver(null)} onEdit={(d) => { setDetailDriver(null); openEdit(d); }} />

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
                  <h2 className="font-display text-lg font-bold text-ink">Delete driver?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This will permanently remove{" "}
                    <span className="font-semibold text-ink">{deleteTarget.full_name}</span> (
                    {deleteTarget.driver_code}). This action cannot be undone.
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

function DriverFormModal({
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
  editing: Driver | null;
  form: DriverInput;
  setForm: (f: DriverInput) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  error: string | null;
}) {
  function set<K extends keyof DriverInput>(key: K, value: DriverInput[K]) {
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
          <div
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
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
                  <HiOutlineUserCircle className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-ink">
                    {editing ? "Edit Driver" : "Add New Driver"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {editing ? editing.driver_code : "Fields marked * are required."}
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

              {/* Photo preview */}
              <div className="flex items-center gap-4">
                {form.profile_photo ? (
                  <img
                    src={form.profile_photo}
                    alt="profile"
                    className="h-16 w-16 rounded-2xl object-cover ring-2 ring-border"
                  />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-xl font-bold text-white">
                    {form.full_name ? initials(form.full_name) : <HiOutlinePhoto className="h-6 w-6" />}
                  </div>
                )}
                <div className="flex-1">
                  <MField label="Profile Photo URL">
                    <MInput
                      type="url"
                      value={form.profile_photo ?? ""}
                      onChange={(e) => set("profile_photo", e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                    />
                  </MField>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MField label="Full Name *">
                  <MInput
                    value={form.full_name}
                    onChange={(e) => set("full_name", e.target.value)}
                    placeholder="Jane Doe"
                    required
                  />
                </MField>
                <MField label="Driver ID">
                  <MInput
                    value={form.driver_code}
                    onChange={(e) => set("driver_code", e.target.value)}
                    placeholder="Auto-generated if blank (e.g. DRV-006)"
                  />
                </MField>
                <MField label="Email">
                  <MInput
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="jane@smartops.io"
                  />
                </MField>
                <MField label="Phone Number">
                  <MInput
                    value={form.phone ?? ""}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+1 555-0100"
                  />
                </MField>
                <MField label="License Number">
                  <MInput
                    value={form.license_number ?? ""}
                    onChange={(e) => set("license_number", e.target.value)}
                    placeholder="TX-LN-100234"
                  />
                </MField>
                <MField label="License Expiry Date">
                  <MInput
                    type="date"
                    value={form.license_expiry ?? ""}
                    onChange={(e) => set("license_expiry", e.target.value)}
                  />
                </MField>
                <MField label="Vehicle Assigned">
                  <MInput
                    value={form.vehicle_assigned ?? ""}
                    onChange={(e) => set("vehicle_assigned", e.target.value)}
                    placeholder="TRK-8821"
                  />
                </MField>
                <MField label="Joining Date">
                  <MInput
                    type="date"
                    value={form.joining_date ?? ""}
                    onChange={(e) => set("joining_date", e.target.value)}
                  />
                </MField>
                <MField label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as DriverStatus)}
                    className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_leave">On Leave</option>
                  </select>
                </MField>
              </div>

              <MField label="Address">
                <textarea
                  value={form.address ?? ""}
                  onChange={(e) => set("address", e.target.value)}
                  rows={2}
                  placeholder="Street, City, State, ZIP"
                  className="w-full rounded-lg border border-input bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
                />
              </MField>

              <div className="flex justify-end gap-2 pt-2">
                <MButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
                  Cancel
                </MButton>
                <MButton type="submit" disabled={saving}>
                  {saving ? "Saving…" : editing ? "Save Changes" : "Create Driver"}
                </MButton>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Details Drawer ---------------- */

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-0">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-aqua-soft text-aqua">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-ink">{value || "—"}</p>
      </div>
    </div>
  );
}

function DriverDetailsDrawer({
  driver,
  onClose,
  onEdit,
}: {
  driver: Driver | null;
  onClose: () => void;
  onEdit: (d: Driver) => void;
}) {
  return (
    <AnimatePresence>
      {driver && (
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
              <div className="flex items-center gap-4">
                {driver.profile_photo ? (
                  <img
                    src={driver.profile_photo}
                    alt={driver.full_name}
                    className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/40"
                  />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/20 text-xl font-bold ring-2 ring-white/30">
                    {initials(driver.full_name)}
                  </div>
                )}
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-white/80">
                    {driver.driver_code}
                  </p>
                  <h2 className="font-display text-2xl font-bold">{driver.full_name}</h2>
                  <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
                    <span className={cn("h-1.5 w-1.5 rounded-full bg-white")} />
                    {STATUS_LABEL[driver.status]}
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <DetailRow icon={HiOutlineEnvelope} label="Email" value={driver.email} />
              <DetailRow icon={HiOutlinePhone} label="Phone" value={driver.phone} />
              <DetailRow icon={HiOutlineMapPin} label="Address" value={driver.address} />
              <DetailRow
                icon={HiOutlineIdentification}
                label="License Number"
                value={driver.license_number}
              />
              <DetailRow
                icon={HiOutlineCalendarDays}
                label="License Expiry"
                value={fmtDate(driver.license_expiry)}
              />
              <DetailRow
                icon={HiOutlineTruck}
                label="Vehicle Assigned"
                value={driver.vehicle_assigned}
              />
              <DetailRow
                icon={HiOutlineCalendarDays}
                label="Joining Date"
                value={fmtDate(driver.joining_date)}
              />
            </div>

            {/* Footer */}
            <div className="border-t border-border p-4">
              <MButton className="w-full" onClick={() => onEdit(driver)}>
                <HiOutlinePencilSquare className="h-4 w-4" /> Edit Driver
              </MButton>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
