import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  HiOutlineClipboardDocumentCheck,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounce";
import {
  MStat,
  MButton,
  MInput,
  MSelect,
  MField,
  MModal,
  MStatusBadge,
  MEmpty,
} from "@/components/management/ManagementUI";
import {
  driverManagementApi,
  type DriverRecord,
  type DriverStatus,
  type DriverInput,
} from "@/lib/driverManagementApi";

export const Route = createFileRoute("/_authenticated/driver-management")({
  head: () => ({ meta: [{ title: "Driver Management — SmartOps" }] }),
  component: DriverManagementPage,
});

const EMPTY_FORM: DriverInput = {
  name: "",
  phone: "",
  licenseNumber: "",
  vehicleAssigned: "",
  status: "active",
  tripsCompleted: 0,
};

function DriverManagementPage() {
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DriverStatus | "">("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DriverRecord | null>(null);
  const [form, setForm] = useState<DriverInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState<DriverRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DriverRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const items = await driverManagementApi.list({
        search: debouncedSearch,
        status: statusFilter,
      });
      setDrivers(items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load drivers.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = drivers.length;
    const active = drivers.filter((d) => d.status === "active").length;
    const inactive = total - active;
    const onDuty = active; // active drivers are considered on-duty for this portal
    return { total, active, inactive, onDuty };
  }, [drivers]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(d: DriverRecord) {
    setEditing(d);
    setForm({
      name: d.name,
      phone: d.phone,
      licenseNumber: d.licenseNumber,
      vehicleAssigned: d.vehicleAssigned,
      status: d.status,
      tripsCompleted: d.tripsCompleted,
    });
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (editing) {
        await driverManagementApi.update(editing._id, form);
      } else {
        await driverManagementApi.create(form);
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save driver.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      await driverManagementApi.remove(confirmDelete._id);
      setConfirmDelete(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not delete driver.");
    } finally {
      setDeleting(false);
    }
  }

  const filteredSummary = drivers.length;
  const isFiltering = !!(debouncedSearch || statusFilter);

  return (
    <div>
      <PageHeader
        title="Driver Management"
        description="Manage your driver workforce — onboarding, updates, and performance."
        actions={
          <MButton onClick={openCreate}>
            <HiOutlinePlus className="h-4 w-4" /> Add Driver
          </MButton>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MStat label="Total Drivers" value={stats.total} icon={HiOutlineUsers} tone="blue" />
        <MStat label="Active" value={stats.active} icon={HiOutlineCheckCircle} tone="emerald" />
        <MStat label="Inactive" value={stats.inactive} icon={HiOutlineXCircle} tone="amber" />
        <MStat label="On Duty" value={stats.onDuty} icon={HiOutlineTruck} tone="aqua" hint="Equivalent to active" />
      </div>

      {/* Search + filter */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <MInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or license no…"
            className="pl-9"
          />
        </div>
        <div className="relative">
          <HiOutlineFunnel className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <MSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DriverStatus | "")}
            className="min-w-44 pl-9"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </MSelect>
        </div>
      </div>

      {/* Error state */}
      {err && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <HiOutlineExclamationTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Couldn't reach the API.</p>
            <p className="text-xs text-destructive/80">
              {err} Ensure the backend is deployed and reachable.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="mt-6 card-3d overflow-hidden rounded-2xl">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-aqua" />
            Loading drivers…
          </div>
        ) : drivers.length === 0 ? (
          <MEmpty
            icon={HiOutlineUsers}
            title={isFiltering ? "No matching drivers" : "No drivers yet"}
            body={
              isFiltering
                ? "Try adjusting your search or filter."
                : "Add your first driver using the “Add Driver” button."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold">License No</th>
                  <th className="px-4 py-3 text-left font-semibold">Vehicle</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Trips</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {drivers.map((d, i) => (
                    <motion.tr
                      key={d._id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className="border-t border-border transition hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-aqua/30 to-aqua/10 text-xs font-semibold text-aqua-foreground">
                            {initials(d.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-ink">{d.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Added {new Date(d.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink">{d.phone}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink">{d.licenseNumber}</td>
                      <td className="px-4 py-3 text-ink">{d.vehicleAssigned || "—"}</td>
                      <td className="px-4 py-3">
                        <MStatusBadge status={d.status} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-ink">{d.tripsCompleted ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            label="View"
                            onClick={() => setViewing(d)}
                            icon={HiOutlineEye}
                          />
                          <IconButton
                            label="Edit"
                            onClick={() => openEdit(d)}
                            icon={HiOutlinePencilSquare}
                          />
                          <IconButton
                            label="Delete"
                            onClick={() => setConfirmDelete(d)}
                            icon={HiOutlineTrash}
                            tone="danger"
                          />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filteredSummary > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing {filteredSummary} driver{filteredSummary === 1 ? "" : "s"}.
        </p>
      )}

      {/* Add / Edit modal */}
      <MModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Driver" : "Add Driver"}
        subtitle={editing ? "Update the driver's details." : "Onboard a new driver to your fleet."}
      >
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <MField label="Full Name">
              <MInput
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Alex Johnson"
                autoComplete="name"
              />
            </MField>
          </div>
          <MField label="Phone">
            <MInput
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 555 0100"
              type="tel"
              autoComplete="tel"
            />
          </MField>
          <MField label="License Number">
            <MInput
              required
              value={form.licenseNumber}
              onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
              placeholder="DL-0000000"
            />
          </MField>
          <MField label="Vehicle Assigned">
            <MInput
              value={form.vehicleAssigned}
              onChange={(e) => setForm({ ...form, vehicleAssigned: e.target.value })}
              placeholder="e.g. KA-01-AB-1234"
            />
          </MField>
          <MField label="Status">
            <MSelect
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as DriverStatus })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </MSelect>
          </MField>
          <MField label="Trips Completed">
            <MInput
              type="number"
              min={0}
              value={form.tripsCompleted ?? 0}
              onChange={(e) => setForm({ ...form, tripsCompleted: Number(e.target.value) })}
            />
          </MField>
          <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
            <MButton type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </MButton>
            <MButton type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Driver"}
            </MButton>
          </div>
        </form>
      </MModal>

      {/* View modal (performance section) */}
      <MModal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Driver Profile"
        subtitle="Profile, assignment, and performance overview."
        wide
      >
        {viewing && (
          <div>
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-lg font-bold text-white shadow-[var(--shadow-aqua)]">
                {initials(viewing.name)}
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-xl font-bold text-ink">{viewing.name}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <MStatusBadge status={viewing.status} />
                  <span className="text-xs text-muted-foreground">
                    Joined {new Date(viewing.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem
                icon={HiOutlinePhone}
                label="Phone"
                value={viewing.phone}
              />
              <DetailItem
                icon={HiOutlineIdentification}
                label="License No"
                value={viewing.licenseNumber}
                mono
              />
              <DetailItem
                icon={HiOutlineTruck}
                label="Vehicle Assigned"
                value={viewing.vehicleAssigned || "—"}
              />
              <DetailItem
                icon={HiOutlineUserCircle}
                label="Activity Status"
                value={viewing.status === "active" ? "On Duty" : "Off Duty"}
              />
            </div>

            {/* Performance section */}
            <div className="mt-5 rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-aqua-foreground">
                <HiOutlineClipboardDocumentCheck className="h-5 w-5" />
                <h4 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
                  Driver Performance
                </h4>
              </div>
              <div className="mt-3">
                <div className="flex items-end justify-between text-xs text-muted-foreground">
                  <span>Trips Completed</span>
                  <span className="font-display text-2xl font-bold text-ink">
                    {viewing.tripsCompleted ?? 0}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full bg-gradient-to-r from-aqua to-[oklch(0.55_0.12_230)]"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, Math.max(4, (viewing.tripsCompleted ?? 0) * 2))}%`,
                    }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <p>
                    Activity:{" "}
                    <span className="font-semibold text-ink">
                      {viewing.status === "active" ? "Currently active in the field" : "Marked inactive"}
                    </span>
                  </p>
                  <p>
                    Last updated:{" "}
                    <span className="text-ink">
                      {new Date(viewing.updatedAt).toLocaleString()}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </MModal>

      {/* Delete confirmation modal */}
      <MModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Driver"
        subtitle="This action cannot be undone."
      >
        <div>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-ink">{confirmDelete?.name}</span>? This will remove
            their record permanently.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <MButton type="button" variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </MButton>
            <MButton type="button" variant="danger" onClick={confirmRemove} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </MButton>
          </div>
        </div>
      </MModal>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "rounded-md p-1.5 text-muted-foreground transition",
        tone === "danger"
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-muted hover:text-ink",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
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
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-aqua-soft text-aqua-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
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
