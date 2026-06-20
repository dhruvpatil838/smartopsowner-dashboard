import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { format, parseISO, isValid, isAfter, addMonths } from "date-fns";
import { toast } from "sonner";
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
  HiOutlineExclamationCircle,
  HiOutlineShieldCheck,
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
  type ValidationError,
  ValidationErrorMap,
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
  active: "border-emerald/30 bg-emerald/10 text-emerald-700",
  inactive: "border-slate/30 bg-slate/10 text-slate-600",
  on_leave: "border-amber/30 bg-amber/10 text-amber-700",
};

const STATUS_DOT: Record<DriverStatus, string> = {
  active: "bg-emerald-500",
  inactive: "bg-slate-400",
  on_leave: "bg-amber-500",
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

const PAGE_SIZE = 10;

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

// Check if license is expiring soon (within 30 days)
function isLicenseExpiringSoon(expiry: string | null): boolean {
  if (!expiry) return false;
  const d = parseISO(expiry);
  if (!isValid(d)) return false;
  return isAfter(addMonths(new Date(), 1), d) && isAfter(d, new Date());
}

function isLicenseExpired(expiry: string | null): boolean {
  if (!expiry) return false;
  const d = parseISO(expiry);
  if (!isValid(d)) return false;
  return !isAfter(d, new Date());
}

// Skeleton component for loading states
function TableSkeleton({ columns, rows }: { columns: number; rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j} className="px-4 py-3.5">
              <span className="block h-4 w-full animate-pulse rounded bg-muted" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function DriverManagementPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

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
  const [formErrors, setFormErrors] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);

  // Details drawer
  const [detailDriver, setDetailDriver] = useState<Driver | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Refs for accessibility
  const searchInputRef = useRef<HTMLInputElement>(null);
  const firstErrorRef = useRef<HTMLDivElement>(null);

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
      setRetryCount(0);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load drivers.";
      setError(message);
      toast.error("Failed to load drivers", { description: message });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, sortKey, sortDir, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const stats = useMemo(() => {
    const active = drivers.filter((d) => d.status === "active").length;
    const onLeave = drivers.filter((d) => d.status === "on_leave").length;
    const expiringLicenses = drivers.filter(d => isLicenseExpiringSoon(d.license_expiry)).length;
    return { total, active, onLeave, inactive: total - active - onLeave, expiringLicenses };
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
    setFormErrors(new Map());
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
    setFormErrors(new Map());
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Clear previous errors
    setFormErrors(new Map());

    // Basic validation
    const errors = new Map<string, string>();

    if (!form.full_name.trim()) {
      errors.set("full_name", "Full name is required");
    } else if (form.full_name.trim().length < 2) {
      errors.set("full_name", "Full name must be at least 2 characters");
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.set("email", "Invalid email format");
    }

    if (form.phone && !/^[\d\s\-\+\(\)]{7,20}$/.test(form.phone)) {
      errors.set("phone", "Invalid phone format");
    }

    if (form.profile_photo && !/^https?:\/\/.+/.test(form.profile_photo)) {
      errors.set("profile_photo", "Invalid URL format");
    }

    if (errors.size > 0) {
      setFormErrors(errors);
      // Focus first error
      setTimeout(() => {
        firstErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await driverApi.update(editing.id, form);
        toast.success("Driver updated", { description: `${form.full_name}'s profile has been updated.` });
      } else {
        await driverApi.create(form);
        toast.success("Driver created", { description: `${form.full_name} has been added to the system.` });
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ValidationErrorMap) {
        const errorMap = new Map(err.errors.map(e => [e.field, e.message]));
        setFormErrors(errorMap);
        toast.error("Validation failed", { description: "Please check the form for errors." });
      } else {
        const message = err instanceof Error ? err.message : "Save failed.";
        toast.error("Save failed", { description: message });
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await driverApi.remove(deleteTarget.id);
      toast.success("Driver deleted", { description: `${deleteTarget.full_name} has been removed.` });
      setDeleteTarget(null);
      if (drivers.length === 1 && page > 1) setPage(page - 1);
      else await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed.";
      toast.error("Delete failed", { description: message });
    } finally {
      setDeleting(false);
    }
  }

  function handleRetry() {
    setRetryCount(c => c + 1);
    load();
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
    <div className="min-h-screen pb-8">
      <PageHeader
        title="Driver Management"
        description="Add, edit, and track all drivers in your fleet."
        actions={
          <MButton onClick={openCreate} aria-label="Add new driver">
            <HiOutlinePlus className="h-4 w-4" aria-hidden="true" /> Add Driver
          </MButton>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" role="region" aria-label="Driver statistics">
        {STAT_CARDS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card-3d card-3d-hover rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="mt-2 font-display text-3xl font-bold text-ink" aria-live="polite">
                    {loading ? (
                      <span className="inline-block h-8 w-12 animate-pulse rounded bg-muted" aria-label="Loading..." />
                    ) : (
                      s.value
                    )}
                  </p>
                </div>
                <div
                  className={cn("grid h-11 w-11 place-items-center rounded-xl text-white", toneBg[s.tone])}
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* License Expiry Warning */}
      {stats.expiringLicenses > 0 && (
        <div
          className="mb-4 flex items-start gap-3 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber-800"
          role="alert"
        >
          <HiOutlineExclamationTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">License Expiring Soon</p>
            <p className="text-xs text-amber-700">
              {stats.expiringLicenses} driver{stats.expiringLicenses !== 1 ? "s have" : " has"} license(s) expiring within 30 days.
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="card-3d mb-4 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <HiOutlineMagnifyingGlass
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, phone, license, vehicle..."
            className="h-11 w-full rounded-lg border border-input bg-surface pl-9 pr-3 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
            aria-label="Search drivers"
            type="search"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <HiOutlineFunnel
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DriverStatus | "")}
              className="h-11 rounded-lg border border-input bg-surface pl-9 pr-8 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_leave">On Leave</option>
            </select>
          </div>
          <MButton
            variant="secondary"
            size="md"
            onClick={handleRetry}
            aria-label="Refresh driver list"
            disabled={loading}
          >
            <HiOutlineArrowPath className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
          </MButton>
        </div>
      </div>

      {/* Error State */}
      {error && !loading && (
        <div
          className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
          ref={firstErrorRef}
        >
          <HiOutlineExclamationTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold">Failed to load drivers</p>
            <p className="text-xs text-destructive/80">{error}</p>
          </div>
          <MButton variant="secondary" size="sm" onClick={handleRetry}>
            Retry
          </MButton>
        </div>
      )}

      {/* Table */}
      {!error && !loading && drivers.length === 0 ? (
        <MEmpty
          icon={HiOutlineUsers}
          title="No drivers found"
          body={search || statusFilter ? "Try adjusting your search or filters." : "Add your first driver to get started."}
        />
      ) : (
        <div className="card-3d overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-sm" role="grid">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={cn(
                        "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                        col.sortable && "cursor-pointer select-none hover:text-ink",
                      )}
                      onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                      aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                      tabIndex={col.sortable ? 0 : undefined}
                      onKeyDown={col.sortable ? (e) => e.key === "Enter" && toggleSort(col.key) : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {col.sortable && sortKey === col.key ? (
                          sortDir === "asc" ? (
                            <HiOutlineChevronUp className="h-3.5 w-3.5 text-aqua" aria-hidden="true" />
                          ) : (
                            <HiOutlineChevronDown className="h-3.5 w-3.5 text-aqua" aria-hidden="true" />
                          )
                        ) : null}
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton columns={COLUMNS.length + 1} rows={6} />
                ) : (
                  drivers.map((d, index) => {
                    const licenseExpired = isLicenseExpired(d.license_expiry);
                    const licenseExpiringSoon = isLicenseExpiringSoon(d.license_expiry);

                    return (
                      <motion.tr
                        key={d.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
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
                                alt=""
                                className="h-8 w-8 rounded-full object-cover ring-2 ring-border"
                                loading="lazy"
                              />
                            ) : (
                              <span
                                className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-xs font-bold text-white"
                                aria-hidden="true"
                              >
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
                        <td className="px-4 py-3">
                          <span className={cn(
                            "inline-flex items-center gap-1",
                            licenseExpired && "text-destructive font-semibold",
                            licenseExpiringSoon && !licenseExpired && "text-amber-600"
                          )}>
                            {fmtDate(d.license_expiry)}
                            {(licenseExpired || licenseExpiringSoon) && (
                              <HiOutlineExclamationCircle
                                className="h-4 w-4"
                                aria-label={licenseExpired ? "License expired" : "License expiring soon"}
                              />
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {d.vehicle_assigned ? (
                            <span className="inline-flex items-center gap-1 text-ink">
                              <HiOutlineTruck className="h-4 w-4 text-aqua" aria-hidden="true" />
                              {d.vehicle_assigned}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
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
                            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[d.status])} aria-hidden="true" />
                            {STATUS_LABEL[d.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1" role="group" aria-label="Driver actions">
                            <button
                              onClick={() => setDetailDriver(d)}
                              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-aqua-soft hover:text-aqua focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua"
                              title="View details"
                              aria-label={`View details for ${d.full_name}`}
                            >
                              <HiOutlineEye className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => openEdit(d)}
                              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-aqua-soft hover:text-aqua focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua"
                              title="Edit"
                              aria-label={`Edit ${d.full_name}`}
                            >
                              <HiOutlinePencilSquare className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(d)}
                              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                              title="Delete"
                              aria-label={`Delete ${d.full_name}`}
                            >
                              <HiOutlineTrash className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <nav
            className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row"
            aria-label="Pagination"
          >
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {loading
                ? "Loading…"
                : drivers.length === 0
                  ? "No results"
                  : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Previous page"
              >
                <HiOutlineChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
              </button>

              <span className="px-2 text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Next page"
              >
                <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
                <HiOutlineChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </nav>
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
        errors={formErrors}
      />

      {/* Details Drawer */}
      <DriverDetailsDrawer
        driver={detailDriver}
        onClose={() => setDetailDriver(null)}
        onEdit={(d) => { setDetailDriver(null); openEdit(d); }}
      />

      {/* Delete confirm */}
      <DeleteConfirmModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        deleting={deleting}
      />
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
  errors,
}: {
  open: boolean;
  onClose: () => void;
  editing: Driver | null;
  form: DriverInput;
  setForm: (f: DriverInput) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  errors: Map<string, string>;
}) {
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus first input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [open]);

  function set<K extends keyof DriverInput>(key: K, value: DriverInput[K]) {
    setForm({ ...form, [key]: value });
  }

  function getFieldError(field: string): string | undefined {
    return errors.get(field);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="driver-form-title"
        >
          <div
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-hidden="true"
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
                <div
                  className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-white"
                  aria-hidden="true"
                >
                  <HiOutlineUserCircle className="h-6 w-6" />
                </div>
                <div>
                  <h2 id="driver-form-title" className="font-display text-lg font-bold text-ink">
                    {editing ? "Edit Driver" : "Add New Driver"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {editing ? editing.driver_code : "Fields marked * are required."}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua"
                aria-label="Close dialog"
                type="button"
              >
                <HiOutlineXMark className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {/* Global errors */}
              {errors.size > 0 && (
                <div
                  className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                  role="alert"
                  ref={firstErrorRef}
                >
                  <HiOutlineExclamationTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Please fix the errors below before submitting.</span>
                </div>
              )}

              {/* Photo preview */}
              <div className="flex items-center gap-4">
                {form.profile_photo ? (
                  <img
                    src={form.profile_photo}
                    alt=""
                    className="h-16 w-16 rounded-2xl object-cover ring-2 ring-border"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-xl text-white"
                    aria-hidden="true"
                  >
                    {form.full_name ? initials(form.full_name) : <HiOutlinePhoto className="h-6 w-6" />}
                  </div>
                )}
                <div className="flex-1">
                  <MField label="Profile Photo URL" error={getFieldError("profile_photo")}>
                    <MInput
                      type="url"
                      value={form.profile_photo ?? ""}
                      onChange={(e) => set("profile_photo", e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      aria-invalid={!!getFieldError("profile_photo")}
                      aria-describedby={getFieldError("profile_photo") ? "profile_photo-error" : undefined}
                    />
                  </MField>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MField label="Full Name *" error={getFieldError("full_name")}>
                  <MInput
                    ref={firstInputRef}
                    value={form.full_name}
                    onChange={(e) => set("full_name", e.target.value)}
                    placeholder="Jane Doe"
                    required
                    aria-invalid={!!getFieldError("full_name")}
                    aria-describedby={getFieldError("full_name") ? "full_name-error" : undefined}
                  />
                </MField>
                <MField label="Driver ID" error={getFieldError("driver_code")}>
                  <MInput
                    value={form.driver_code}
                    onChange={(e) => set("driver_code", e.target.value)}
                    placeholder="Auto-generated if blank"
                    aria-invalid={!!getFieldError("driver_code")}
                  />
                </MField>
                <MField label="Email" error={getFieldError("email")}>
                  <MInput
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="jane@smartops.io"
                    autoComplete="email"
                    aria-invalid={!!getFieldError("email")}
                  />
                </MField>
                <MField label="Phone Number" error={getFieldError("phone")}>
                  <MInput
                    type="tel"
                    value={form.phone ?? ""}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+1 555-0100"
                    autoComplete="tel"
                    aria-invalid={!!getFieldError("phone")}
                  />
                </MField>
                <MField label="License Number" error={getFieldError("license_number")}>
                  <MInput
                    value={form.license_number ?? ""}
                    onChange={(e) => set("license_number", e.target.value)}
                    placeholder="TX-LN-100234"
                    aria-invalid={!!getFieldError("license_number")}
                  />
                </MField>
                <MField label="License Expiry Date" error={getFieldError("license_expiry")}>
                  <MInput
                    type="date"
                    value={form.license_expiry ?? ""}
                    onChange={(e) => set("license_expiry", e.target.value)}
                    aria-invalid={!!getFieldError("license_expiry")}
                  />
                </MField>
                <MField label="Vehicle Assigned" error={getFieldError("vehicle_assigned")}>
                  <MInput
                    value={form.vehicle_assigned ?? ""}
                    onChange={(e) => set("vehicle_assigned", e.target.value)}
                    placeholder="TRK-8821"
                    aria-invalid={!!getFieldError("vehicle_assigned")}
                  />
                </MField>
                <MField label="Joining Date" error={getFieldError("joining_date")}>
                  <MInput
                    type="date"
                    value={form.joining_date ?? ""}
                    onChange={(e) => set("joining_date", e.target.value)}
                    aria-invalid={!!getFieldError("joining_date")}
                  />
                </MField>
                <MField label="Status" error={getFieldError("status")}>
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as DriverStatus)}
                    className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
                    aria-invalid={!!getFieldError("status")}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_leave">On Leave</option>
                  </select>
                </MField>
              </div>

              <MField label="Address" error={getFieldError("address")}>
                <textarea
                  value={form.address ?? ""}
                  onChange={(e) => set("address", e.target.value)}
                  rows={2}
                  placeholder="Street, City, State, ZIP"
                  className="w-full rounded-lg border border-input bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
                  aria-invalid={!!getFieldError("address")}
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
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-aqua-soft text-aqua" aria-hidden="true">
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
            aria-hidden="true"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-surface shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="driver-detail-title"
          >
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] p-6 text-white">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-md p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Close"
              >
                <HiOutlineXMark className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="flex items-center gap-4">
                {driver.profile_photo ? (
                  <img
                    src={driver.profile_photo}
                    alt=""
                    className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/40"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="grid h-16 w-16 place-items-center rounded-2xl bg-white/20 text-xl font-bold ring-2 ring-white/30"
                    aria-hidden="true"
                  >
                    {initials(driver.full_name)}
                  </div>
                )}
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-white/80">
                    {driver.driver_code}
                  </p>
                  <h2 id="driver-detail-title" className="font-display text-2xl font-bold">{driver.full_name}</h2>
                  <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
                    <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[driver.status])} aria-hidden="true" />
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

              {/* Security info */}
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <HiOutlineShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                <span>Last updated: {format(new Date(driver.updated_at), "PPp")}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border p-4">
              <MButton className="w-full" onClick={() => onEdit(driver)}>
                <HiOutlinePencilSquare className="h-4 w-4" aria-hidden="true" /> Edit Driver
              </MButton>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Delete Confirm Modal ---------------- */

function DeleteConfirmModal({
  target,
  onClose,
  onConfirm,
  deleting,
}: {
  target: Driver | null;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <AnimatePresence>
      {target && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          aria-describedby="delete-description"
        >
          <div
            onClick={() => !deleting && onClose()}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="glass relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-start gap-4">
              <div
                className="grid h-11 w-11 place-items-center rounded-xl bg-destructive/10 text-destructive"
                aria-hidden="true"
              >
                <HiOutlineTrash className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="delete-title" className="font-display text-lg font-bold text-ink">Delete driver?</h2>
                <p id="delete-description" className="mt-1 text-sm text-muted-foreground">
                  This will permanently remove{" "}
                  <span className="font-semibold text-ink">{target.full_name}</span> (
                  {target.driver_code}). This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <MButton variant="secondary" onClick={onClose} disabled={deleting}>
                Cancel
              </MButton>
              <MButton variant="danger" onClick={onConfirm} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </MButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
