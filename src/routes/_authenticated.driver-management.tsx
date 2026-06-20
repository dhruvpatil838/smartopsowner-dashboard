import { createFileRoute, Link } from "@tanstack/react-router";
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
  HiOutlineArrowTopRightOnSquare,
  HiOutlineMap,
  HiOutlineClock,
  HiOutlineCalendar,
  HiOutlineArrowPath,
  HiOutlineFlag,
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
import {
  managedTripsApi,
  type ManagedTrip,
  type TripStatus,
  type TripPriority,
  type TripInput,
  type TripStats,
} from "@/lib/managedTripsApi";

export const Route = createFileRoute("/_authenticated/driver-management")({
  head: () => ({ meta: [{ title: "Driver Management — SmartOps" }] }),
  component: DriverManagementPage,
});

type TabId = "drivers" | "trips";

const EMPTY_DRIVER_FORM: DriverInput = {
  name: "",
  phone: "",
  licenseNumber: "",
  vehicleAssigned: "",
  status: "active",
  tripsCompleted: 0,
};

const EMPTY_TRIP_FORM: TripInput = {
  driverName: "",
  tripCode: "",
  source: "",
  destination: "",
  vehicleNumber: "",
  status: "pending",
  priority: "medium",
  notes: "",
  distanceKm: 0,
  cargoType: "",
  weight: 0,
};

const STATUS_CONFIG: Record<TripStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  in_transit: { label: "In Transit", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  delivered: { label: "Delivered", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  delayed: { label: "Delayed", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  cancelled: { label: "Cancelled", color: "text-slate-500", bg: "bg-slate-50 border-slate-200" },
};

const PRIORITY_CONFIG: Record<TripPriority, { label: string; color: string }> = {
  low: { label: "Low", color: "text-slate-500" },
  medium: { label: "Medium", color: "text-blue-600" },
  high: { label: "High", color: "text-amber-600" },
  urgent: { label: "Urgent", color: "text-red-600" },
};

function DriverManagementPage() {
  const [activeTab, setActiveTab] = useState<TabId>("drivers");

  // Drivers state
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driversErr, setDriversErr] = useState<string | null>(null);
  const [driverSearch, setDriverSearch] = useState("");
  const [driverStatusFilter, setDriverStatusFilter] = useState<DriverStatus | "">("");
  const debouncedDriverSearch = useDebouncedValue(driverSearch, 300);

  // Trips state
  const [trips, setTrips] = useState<ManagedTrip[]>([]);
  const [tripStats, setTripStats] = useState<TripStats | null>(null);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsErr, setTripsErr] = useState<string | null>(null);
  const [tripSearch, setTripSearch] = useState("");
  const [tripStatusFilter, setTripStatusFilter] = useState<TripStatus | "">("");
  const [tripPriorityFilter, setTripPriorityFilter] = useState<TripPriority | "">("");
  const debouncedTripSearch = useDebouncedValue(tripSearch, 300);

  // Driver modal state
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverRecord | null>(null);
  const [driverForm, setDriverForm] = useState<DriverInput>(EMPTY_DRIVER_FORM);
  const [savingDriver, setSavingDriver] = useState(false);
  const [viewingDriver, setViewingDriver] = useState<DriverRecord | null>(null);
  const [confirmDeleteDriver, setConfirmDeleteDriver] = useState<DriverRecord | null>(null);
  const [deletingDriver, setDeletingDriver] = useState(false);

  // Trip modal state
  const [tripModalOpen, setTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<ManagedTrip | null>(null);
  const [tripForm, setTripForm] = useState<TripInput>(EMPTY_TRIP_FORM);
  const [savingTrip, setSavingTrip] = useState(false);
  const [viewingTrip, setViewingTrip] = useState<ManagedTrip | null>(null);
  const [assigningTrip, setAssigningTrip] = useState<ManagedTrip | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [confirmDeleteTrip, setConfirmDeleteTrip] = useState<ManagedTrip | null>(null);
  const [deletingTrip, setDeletingTrip] = useState(false);

  // Load drivers
  const loadDrivers = useCallback(async () => {
    setDriversLoading(true);
    setDriversErr(null);
    try {
      const items = await driverManagementApi.list({
        search: debouncedDriverSearch,
        status: driverStatusFilter,
      });
      setDrivers(items);
    } catch (e) {
      setDriversErr(e instanceof Error ? e.message : "Could not load drivers.");
    } finally {
      setDriversLoading(false);
    }
  }, [debouncedDriverSearch, driverStatusFilter]);

  // Load trips
  const loadTrips = useCallback(async () => {
    setTripsLoading(true);
    setTripsErr(null);
    try {
      const [tripsData, statsData] = await Promise.all([
        managedTripsApi.list({
          search: debouncedTripSearch,
          status: tripStatusFilter,
          priority: tripPriorityFilter,
        }),
        managedTripsApi.stats(),
      ]);
      setTrips(tripsData);
      setTripStats(statsData);
    } catch (e) {
      setTripsErr(e instanceof Error ? e.message : "Could not load trips.");
    } finally {
      setTripsLoading(false);
    }
  }, [debouncedTripSearch, tripStatusFilter, tripPriorityFilter]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const driverStats = useMemo(() => {
    const total = drivers.length;
    const active = drivers.filter((d) => d.status === "active").length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [drivers]);

  // Driver handlers
  function openCreateDriver() {
    setEditingDriver(null);
    setDriverForm(EMPTY_DRIVER_FORM);
    setDriverModalOpen(true);
  }

  function openEditDriver(d: DriverRecord) {
    setEditingDriver(d);
    setDriverForm({
      name: d.name,
      phone: d.phone,
      licenseNumber: d.licenseNumber,
      vehicleAssigned: d.vehicleAssigned,
      status: d.status,
      tripsCompleted: d.tripsCompleted,
    });
    setDriverModalOpen(true);
  }

  async function submitDriverForm(e: React.FormEvent) {
    e.preventDefault();
    if (savingDriver) return;
    setSavingDriver(true);
    try {
      if (editingDriver) {
        await driverManagementApi.update(editingDriver._id, driverForm);
      } else {
        await driverManagementApi.create(driverForm);
      }
      setDriverModalOpen(false);
      await loadDrivers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save driver.");
    } finally {
      setSavingDriver(false);
    }
  }

  async function confirmRemoveDriver() {
    if (!confirmDeleteDriver || deletingDriver) return;
    setDeletingDriver(true);
    try {
      await driverManagementApi.remove(confirmDeleteDriver._id);
      setConfirmDeleteDriver(null);
      await loadDrivers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not delete driver.");
    } finally {
      setDeletingDriver(false);
    }
  }

  // Trip handlers
  function openCreateTrip() {
    setEditingTrip(null);
    setTripForm(EMPTY_TRIP_FORM);
    setTripModalOpen(true);
  }

  function openEditTrip(t: ManagedTrip) {
    setEditingTrip(t);
    setTripForm({
      driverId: t.driverId || undefined,
      driverName: t.driverName,
      tripCode: t.tripCode,
      source: t.source,
      destination: t.destination,
      vehicleNumber: t.vehicleNumber,
      startDate: t.startDate?.split("T")[0],
      expectedDelivery: t.expectedDelivery?.split("T")[0],
      status: t.status,
      priority: t.priority,
      notes: t.notes,
      distanceKm: t.distanceKm,
      cargoType: t.cargoType,
      weight: t.weight,
    });
    setTripModalOpen(true);
  }

  async function submitTripForm(e: React.FormEvent) {
    e.preventDefault();
    if (savingTrip) return;
    setSavingTrip(true);
    try {
      if (editingTrip) {
        await managedTripsApi.update(editingTrip._id, tripForm);
      } else {
        await managedTripsApi.create(tripForm);
      }
      setTripModalOpen(false);
      await Promise.all([loadTrips(), loadDrivers()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save trip.");
    } finally {
      setSavingTrip(false);
    }
  }

  async function handleAssignDriver() {
    if (!assigningTrip || !selectedDriverId || savingTrip) return;
    setSavingTrip(true);
    try {
      await managedTripsApi.assignDriver(assigningTrip._id, selectedDriverId);
      setAssigningTrip(null);
      setSelectedDriverId("");
      await Promise.all([loadTrips(), loadDrivers()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not assign driver.");
    } finally {
      setSavingTrip(false);
    }
  }

  async function updateTripStatus(trip: ManagedTrip, status: TripStatus) {
    try {
      await managedTripsApi.updateStatus(trip._id, status);
      await loadTrips();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not update status.");
    }
  }

  async function confirmRemoveTrip() {
    if (!confirmDeleteTrip || deletingTrip) return;
    setDeletingTrip(true);
    try {
      await managedTripsApi.remove(confirmDeleteTrip._id);
      setConfirmDeleteTrip(null);
      await Promise.all([loadTrips(), loadDrivers()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not delete trip.");
    } finally {
      setDeletingTrip(false);
    }
  }

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "drivers", label: "Drivers", icon: HiOutlineUsers },
    { id: "trips", label: "Trip Management", icon: HiOutlineMap },
  ];

  return (
    <div>
      <PageHeader
        title="Driver Management"
        description="Manage drivers, assign trips, and track deliveries across your fleet."
        actions={
          <MButton onClick={activeTab === "drivers" ? openCreateDriver : openCreateTrip}>
            <HiOutlinePlus className="h-4 w-4" />
            {activeTab === "drivers" ? " Add Driver" : " New Trip"}
          </MButton>
        }
      />

      {/* Stats cards - combined */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-6">
        <MStat label="Total Drivers" value={driverStats.total} icon={HiOutlineUsers} tone="blue" />
        <MStat label="Active Drivers" value={driverStats.active} icon={HiOutlineCheckCircle} tone="emerald" />
        <MStat label="Total Trips" value={tripStats?.totalTrips ?? 0} icon={HiOutlineMap} tone="aqua" />
        <MStat label="Pending" value={tripStats?.pendingTrips ?? 0} icon={HiOutlineClock} tone="amber" />
        <MStat label="In Transit" value={tripStats?.inTransitTrips ?? 0} icon={HiOutlineTruck} tone="blue" />
        <MStat label="Delivered" value={tripStats?.deliveredTrips ?? 0} icon={HiOutlineCheckCircle} tone="emerald" />
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-xl bg-muted/40 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                isActive
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted-foreground hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Drivers Tab */}
      {activeTab === "drivers" && (
        <>
          {/* Driver search + filter */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <MInput
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                placeholder="Search by name, phone, or license no…"
                className="pl-9"
              />
            </div>
            <div className="relative">
              <HiOutlineFunnel className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <MSelect
                value={driverStatusFilter}
                onChange={(e) => setDriverStatusFilter(e.target.value as DriverStatus | "")}
                className="min-w-44 pl-9"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </MSelect>
            </div>
          </div>

          {/* Error state */}
          {driversErr && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <HiOutlineExclamationTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Couldn't reach the API.</p>
                <p className="text-xs text-destructive/80">{driversErr}</p>
              </div>
            </div>
          )}

          {/* Drivers table */}
          <div className="mt-6 card-3d overflow-hidden rounded-2xl">
            {driversLoading ? (
              <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
                <span className="h-2 w-2 animate-pulse rounded-full bg-aqua" />
                Loading drivers…
              </div>
            ) : drivers.length === 0 ? (
              <MEmpty
                icon={HiOutlineUsers}
                title={driverSearch || driverStatusFilter ? "No matching drivers" : "No drivers yet"}
                body={
                  driverSearch || driverStatusFilter
                    ? "Try adjusting your search or filter."
                    : "Add your first driver using the Add Driver button."
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
                            <Link
                              to="/driver/$driverId"
                              params={{ driverId: d._id }}
                              className="flex items-center gap-3 transition hover:opacity-80"
                            >
                              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-aqua/30 to-aqua/10 text-xs font-semibold text-aqua-foreground">
                                {initials(d.name)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-aqua hover:underline">{d.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  Added {new Date(d.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </Link>
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
                              <Link
                                to="/driver/$driverId"
                                params={{ driverId: d._id }}
                                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-ink"
                                title="View Profile"
                              >
                                <HiOutlineArrowTopRightOnSquare className="h-4 w-4" />
                              </Link>
                              <IconButton
                                label="Edit"
                                onClick={() => openEditDriver(d)}
                                icon={HiOutlinePencilSquare}
                              />
                              <IconButton
                                label="Delete"
                                onClick={() => setConfirmDeleteDriver(d)}
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

          {!driversLoading && drivers.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Showing {drivers.length} driver{drivers.length === 1 ? "" : "s"}.
            </p>
          )}
        </>
      )}

      {/* Trips Tab */}
      {activeTab === "trips" && (
        <>
          {/* Trip search + filters */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <MInput
                value={tripSearch}
                onChange={(e) => setTripSearch(e.target.value)}
                placeholder="Search trip code, driver, route…"
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <HiOutlineFunnel className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <MSelect
                  value={tripStatusFilter}
                  onChange={(e) => setTripStatusFilter(e.target.value as TripStatus | "")}
                  className="min-w-36 pl-9"
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                  <option value="delayed">Delayed</option>
                  <option value="cancelled">Cancelled</option>
                </MSelect>
              </div>
              <MSelect
                value={tripPriorityFilter}
                onChange={(e) => setTripPriorityFilter(e.target.value as TripPriority | "")}
                className="min-w-32"
              >
                <option value="">All priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </MSelect>
            </div>
          </div>

          {/* Error state */}
          {tripsErr && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <HiOutlineExclamationTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Couldn't load trips.</p>
                <p className="text-xs text-destructive/80">{tripsErr}</p>
              </div>
            </div>
          )}

          {/* Trips table */}
          <div className="mt-6 card-3d overflow-hidden rounded-2xl">
            {tripsLoading ? (
              <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
                <span className="h-2 w-2 animate-pulse rounded-full bg-aqua" />
                Loading trips…
              </div>
            ) : trips.length === 0 ? (
              <MEmpty
                icon={HiOutlineMap}
                title={tripSearch || tripStatusFilter ? "No matching trips" : "No trips yet"}
                body={
                  tripSearch || tripStatusFilter
                    ? "Adjust your filters to see more results."
                    : "Create your first trip to start managing deliveries."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Trip</th>
                      <th className="px-4 py-3 text-left font-semibold">Driver</th>
                      <th className="px-4 py-3 text-left font-semibold">Route</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Priority</th>
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {trips.map((t, i) => {
                        const statusCfg = STATUS_CONFIG[t.status];
                        const priorityCfg = PRIORITY_CONFIG[t.priority];
                        return (
                          <motion.tr
                            key={t._id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15, delay: i * 0.02 }}
                            className="border-t border-border transition hover:bg-muted/40"
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-ink">{t.tripCode}</div>
                              {t.vehicleNumber && (
                                <div className="text-xs text-muted-foreground">{t.vehicleNumber}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {t.driverId ? (
                                <div className="flex items-center gap-2">
                                  <div className="grid h-8 w-8 place-items-center rounded-full bg-aqua-soft text-xs font-semibold text-aqua">
                                    {initials(t.driverName)}
                                  </div>
                                  <span className="font-medium text-ink">{t.driverName}</span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setAssigningTrip(t)}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-muted-foreground/40 px-3 py-1 text-xs text-muted-foreground transition hover:border-aqua hover:bg-aqua-soft hover:text-aqua"
                                >
                                  <HiOutlinePlus className="h-3 w-3" /> Assign
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="max-w-xs">
                                <div className="truncate text-ink">{t.source}</div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <span className="h-px flex-1 bg-border" />
                                  <span className="shrink-0 px-1">{t.distanceKm || 0} km</span>
                                  <span className="h-px flex-1 bg-border" />
                                </div>
                                <div className="truncate text-ink">{t.destination}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={t.status}
                                onChange={(e) => updateTripStatus(t, e.target.value as TripStatus)}
                                className={cn(
                                  "cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-semibold outline-none transition",
                                  statusCfg.bg,
                                  statusCfg.color
                                )}
                              >
                                <option value="pending">Pending</option>
                                <option value="in_transit">In Transit</option>
                                <option value="delivered">Delivered</option>
                                <option value="delayed">Delayed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn("text-xs font-semibold", priorityCfg.color)}>
                                {priorityCfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {new Date(t.startDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <IconButton
                                  label="View"
                                  onClick={() => setViewingTrip(t)}
                                  icon={HiOutlineEye}
                                />
                                <IconButton
                                  label="Edit"
                                  onClick={() => openEditTrip(t)}
                                  icon={HiOutlinePencilSquare}
                                />
                                <IconButton
                                  label="Delete"
                                  onClick={() => setConfirmDeleteTrip(t)}
                                  icon={HiOutlineTrash}
                                  tone="danger"
                                />
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!tripsLoading && trips.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Showing {trips.length} trip{trips.length === 1 ? "" : "s"}.
            </p>
          )}
        </>
      )}

      {/* Driver Add/Edit Modal */}
      <MModal
        open={driverModalOpen}
        onClose={() => setDriverModalOpen(false)}
        title={editingDriver ? "Edit Driver" : "Add Driver"}
        subtitle={editingDriver ? "Update the driver's details." : "Onboard a new driver to your fleet."}
      >
        <form onSubmit={submitDriverForm} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <MField label="Full Name">
              <MInput
                required
                value={driverForm.name}
                onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                placeholder="e.g. Alex Johnson"
                autoComplete="name"
              />
            </MField>
          </div>
          <MField label="Phone">
            <MInput
              required
              value={driverForm.phone}
              onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
              placeholder="+1 555 0100"
              type="tel"
              autoComplete="tel"
            />
          </MField>
          <MField label="License Number">
            <MInput
              required
              value={driverForm.licenseNumber}
              onChange={(e) => setDriverForm({ ...driverForm, licenseNumber: e.target.value })}
              placeholder="DL-0000000"
            />
          </MField>
          <MField label="Vehicle Assigned">
            <MInput
              value={driverForm.vehicleAssigned}
              onChange={(e) => setDriverForm({ ...driverForm, vehicleAssigned: e.target.value })}
              placeholder="e.g. KA-01-AB-1234"
            />
          </MField>
          <MField label="Status">
            <MSelect
              value={driverForm.status}
              onChange={(e) => setDriverForm({ ...driverForm, status: e.target.value as DriverStatus })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </MSelect>
          </MField>
          <MField label="Trips Completed">
            <MInput
              type="number"
              min={0}
              value={driverForm.tripsCompleted ?? 0}
              onChange={(e) => setDriverForm({ ...driverForm, tripsCompleted: Number(e.target.value) })}
            />
          </MField>
          <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
            <MButton type="button" variant="secondary" onClick={() => setDriverModalOpen(false)}>
              Cancel
            </MButton>
            <MButton type="submit" disabled={savingDriver}>
              {savingDriver ? "Saving…" : editingDriver ? "Save Changes" : "Add Driver"}
            </MButton>
          </div>
        </form>
      </MModal>

      {/* Trip Create/Edit Modal */}
      <MModal
        open={tripModalOpen}
        onClose={() => setTripModalOpen(false)}
        title={editingTrip ? "Edit Trip" : "Create Trip"}
        subtitle={editingTrip ? "Update trip details and assignment." : "Plan a new delivery trip."}
        wide
      >
        <form onSubmit={submitTripForm} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MField label="Trip Code">
            <MInput
              required
              value={tripForm.tripCode}
              onChange={(e) => setTripForm({ ...tripForm, tripCode: e.target.value })}
              placeholder="TR-2024-0001"
            />
          </MField>
          <MField label="Driver Name">
            <MInput
              required
              value={tripForm.driverName}
              onChange={(e) => setTripForm({ ...tripForm, driverName: e.target.value })}
              placeholder="Assign driver or enter name"
            />
          </MField>
          <MField label="Source">
            <MInput
              required
              value={tripForm.source}
              onChange={(e) => setTripForm({ ...tripForm, source: e.target.value })}
              placeholder="Pickup location"
            />
          </MField>
          <MField label="Destination">
            <MInput
              required
              value={tripForm.destination}
              onChange={(e) => setTripForm({ ...tripForm, destination: e.target.value })}
              placeholder="Delivery location"
            />
          </MField>
          <MField label="Vehicle Number">
            <MInput
              value={tripForm.vehicleNumber}
              onChange={(e) => setTripForm({ ...tripForm, vehicleNumber: e.target.value })}
              placeholder="KA-01-AB-1234"
            />
          </MField>
          <MField label="Distance (km)">
            <MInput
              type="number"
              min={0}
              value={tripForm.distanceKm}
              onChange={(e) => setTripForm({ ...tripForm, distanceKm: Number(e.target.value) })}
              placeholder="0"
            />
          </MField>
          <MField label="Start Date">
            <MInput
              type="date"
              value={tripForm.startDate}
              onChange={(e) => setTripForm({ ...tripForm, startDate: e.target.value })}
            />
          </MField>
          <MField label="Expected Delivery">
            <MInput
              type="date"
              value={tripForm.expectedDelivery}
              onChange={(e) => setTripForm({ ...tripForm, expectedDelivery: e.target.value })}
            />
          </MField>
          <MField label="Status">
            <MSelect
              value={tripForm.status}
              onChange={(e) => setTripForm({ ...tripForm, status: e.target.value as TripStatus })}
            >
              <option value="pending">Pending</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="delayed">Delayed</option>
              <option value="cancelled">Cancelled</option>
            </MSelect>
          </MField>
          <MField label="Priority">
            <MSelect
              value={tripForm.priority}
              onChange={(e) => setTripForm({ ...tripForm, priority: e.target.value as TripPriority })}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </MSelect>
          </MField>
          <MField label="Cargo Type">
            <MInput
              value={tripForm.cargoType}
              onChange={(e) => setTripForm({ ...tripForm, cargoType: e.target.value })}
              placeholder="e.g. Electronics, Perishables"
            />
          </MField>
          <MField label="Weight (kg)">
            <MInput
              type="number"
              min={0}
              value={tripForm.weight}
              onChange={(e) => setTripForm({ ...tripForm, weight: Number(e.target.value) })}
              placeholder="0"
            />
          </MField>
          <div className="sm:col-span-2">
            <MField label="Notes">
              <textarea
                value={tripForm.notes}
                onChange={(e) => setTripForm({ ...tripForm, notes: e.target.value })}
                placeholder="Special instructions, delivery notes…"
                rows={2}
                className="w-full rounded-lg border border-input bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted-foreground/70 focus:border-aqua focus:ring-2 focus:ring-aqua/30"
              />
            </MField>
          </div>
          <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
            <MButton type="button" variant="secondary" onClick={() => setTripModalOpen(false)}>
              Cancel
            </MButton>
            <MButton type="submit" disabled={savingTrip}>
              {savingTrip ? "Saving…" : editingTrip ? "Save Changes" : "Create Trip"}
            </MButton>
          </div>
        </form>
      </MModal>

      {/* Trip View Modal */}
      <MModal
        open={!!viewingTrip}
        onClose={() => setViewingTrip(null)}
        title="Trip Details"
        subtitle="Complete trip information and status."
        wide
      >
        {viewingTrip && (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl font-bold text-ink">{viewingTrip.tripCode}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Created {new Date(viewingTrip.createdAt).toLocaleString()}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-semibold",
                  STATUS_CONFIG[viewingTrip.status].bg,
                  STATUS_CONFIG[viewingTrip.status].color
                )}
              >
                {STATUS_CONFIG[viewingTrip.status].label}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem icon={HiOutlineUserCircle} label="Driver" value={viewingTrip.driverName || "Unassigned"} />
              <DetailItem icon={HiOutlineTruck} label="Vehicle" value={viewingTrip.vehicleNumber || "—"} />
              <DetailItem icon={HiOutlineMap} label="Source" value={viewingTrip.source} />
              <DetailItem icon={HiOutlineMap} label="Destination" value={viewingTrip.destination} />
              <DetailItem icon={HiOutlineCalendar} label="Start Date" value={new Date(viewingTrip.startDate).toLocaleDateString()} />
              <DetailItem
                icon={HiOutlineClock}
                label="Expected Delivery"
                value={viewingTrip.expectedDelivery ? new Date(viewingTrip.expectedDelivery).toLocaleDateString() : "—"}
              />
              <DetailItem icon={HiOutlineFlag} label="Priority" value={PRIORITY_CONFIG[viewingTrip.priority].label} />
              <DetailItem icon={HiOutlineArrowPath} label="Distance" value={`${viewingTrip.distanceKm || 0} km`} />
            </div>

            {viewingTrip.notes && (
              <div className="mt-5 rounded-xl border border-border bg-surface p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
                <p className="mt-1 text-sm text-ink">{viewingTrip.notes}</p>
              </div>
            )}
          </div>
        )}
      </MModal>

      {/* Assign Driver Modal */}
      <MModal
        open={!!assigningTrip}
        onClose={() => {
          setAssigningTrip(null);
          setSelectedDriverId("");
        }}
        title="Assign Driver"
        subtitle="Select an active driver for this trip."
      >
        <div>
          <MField label="Select Driver">
            <MSelect
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full"
            >
              <option value="">Choose a driver…</option>
              {drivers.filter((d) => d.status === "active").map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} — {d.vehicleAssigned || "No vehicle"}
                </option>
              ))}
            </MSelect>
          </MField>
          <div className="mt-5 flex justify-end gap-2">
            <MButton
              type="button"
              variant="secondary"
              onClick={() => {
                setAssigningTrip(null);
                setSelectedDriverId("");
              }}
            >
              Cancel
            </MButton>
            <MButton onClick={handleAssignDriver} disabled={!selectedDriverId || savingTrip}>
              {savingTrip ? "Assigning…" : "Assign Driver"}
            </MButton>
          </div>
        </div>
      </MModal>

      {/* Delete Driver Modal */}
      <MModal
        open={!!confirmDeleteDriver}
        onClose={() => setConfirmDeleteDriver(null)}
        title="Delete Driver"
        subtitle="This action cannot be undone."
      >
        <div>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-ink">{confirmDeleteDriver?.name}</span>? This will remove
            their record permanently.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <MButton type="button" variant="secondary" onClick={() => setConfirmDeleteDriver(null)}>
              Cancel
            </MButton>
            <MButton type="button" variant="danger" onClick={confirmRemoveDriver} disabled={deletingDriver}>
              {deletingDriver ? "Deleting…" : "Delete"}
            </MButton>
          </div>
        </div>
      </MModal>

      {/* Delete Trip Modal */}
      <MModal
        open={!!confirmDeleteTrip}
        onClose={() => setConfirmDeleteTrip(null)}
        title="Delete Trip"
        subtitle="This action cannot be undone."
      >
        <div>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete trip{" "}
            <span className="font-semibold text-ink">{confirmDeleteTrip?.tripCode}</span>?
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <MButton type="button" variant="secondary" onClick={() => setConfirmDeleteTrip(null)}>
              Cancel
            </MButton>
            <MButton type="button" variant="danger" onClick={confirmRemoveTrip} disabled={deletingTrip}>
              {deletingTrip ? "Deleting…" : "Delete"}
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
          : "hover:bg-muted hover:text-ink"
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-aqua-soft text-aqua-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate font-medium text-ink">{value}</p>
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
