import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HiOutlinePlus, HiOutlinePencilSquare, HiOutlineTrash, HiOutlineEye } from "react-icons/hi2";
import {
  DCard, DSection, DButton, DInput, DSelect, DTextarea, DField, DModal, DBadge, DEmpty,
  TRIP_STATUS_TONE, prettyStatus,
} from "@/components/driver/DriverUI";
import { driverApi, type Trip, type TripStatus } from "@/lib/driver-api";

export const Route = createFileRoute("/driver/trips")({
  head: () => ({ meta: [{ title: "My Trips — Driver Dashboard" }] }),
  component: TripsPage,
});

const STATUSES: TripStatus[] = ["pending", "in_transit", "delivered", "delayed", "cancelled"];

const empty = {
  tripCode: "",
  source: "",
  destination: "",
  vehicleNumber: "",
  startDate: new Date().toISOString().slice(0, 10),
  expectedDelivery: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  status: "pending" as TripStatus,
  notes: "",
  distanceKm: 0,
};

function TripsPage() {
  const [list, setList] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Trip | null>(null);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [form, setForm] = useState(empty);

  async function reload() {
    setLoading(true);
    try {
      setList(await driverApi.listTrips());
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...empty, tripCode: `TR-${Date.now().toString().slice(-6)}` });
    setOpen(true);
  }
  function openEdit(t: Trip) {
    setEditing(t);
    setForm({
      tripCode: t.tripCode,
      source: t.source,
      destination: t.destination,
      vehicleNumber: t.vehicleNumber || "",
      startDate: t.startDate?.slice(0, 10) || empty.startDate,
      expectedDelivery: t.expectedDelivery?.slice(0, 10) || empty.expectedDelivery,
      status: t.status,
      notes: t.notes || "",
      distanceKm: t.distanceKm || 0,
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) await driverApi.updateTrip(editing._id, form);
      else await driverApi.createTrip(form);
      setOpen(false);
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function remove(t: Trip) {
    if (!confirm(`Delete trip ${t.tripCode}?`)) return;
    await driverApi.deleteTrip(t._id);
    reload();
  }

  async function changeStatus(t: Trip, status: TripStatus) {
    await driverApi.setTripStatus(t._id, status);
    reload();
  }

  return (
    <div>
      <DSection
        title="My Trips"
        description="Trips assigned to you. Start, end, or update status anytime."
        actions={
          <DButton onClick={openCreate}>
            <HiOutlinePlus className="h-4 w-4" /> New trip
          </DButton>
        }
      />

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {loading ? (
        <DEmpty>Loading trips…</DEmpty>
      ) : list.length === 0 ? (
        <DEmpty>No trips yet. Click “New trip” to add one.</DEmpty>
      ) : (
        <DCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Trip ID</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Destination</th>
                  <th className="px-4 py-3 text-left">Vehicle</th>
                  <th className="px-4 py-3 text-left">Start</th>
                  <th className="px-4 py-3 text-left">Expected</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t._id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{t.tripCode}</td>
                    <td className="px-4 py-3">{t.source}</td>
                    <td className="px-4 py-3">{t.destination}</td>
                    <td className="px-4 py-3">{t.vehicleNumber || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{t.startDate?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-slate-600">{t.expectedDelivery?.slice(0, 10) || "—"}</td>
                    <td className="px-4 py-3">
                      <select
                        value={t.status}
                        onChange={(e) => changeStatus(t, e.target.value as TripStatus)}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {prettyStatus(s)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewing(t)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          aria-label="View"
                        >
                          <HiOutlineEye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(t)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          aria-label="Edit"
                        >
                          <HiOutlinePencilSquare className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(t)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete"
                        >
                          <HiOutlineTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DCard>
      )}

      <DModal open={open} onClose={() => setOpen(false)} title={editing ? "Edit trip" : "New trip"} wide>
        <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DField label="Trip ID">
            <DInput required value={form.tripCode} onChange={(e) => setForm({ ...form, tripCode: e.target.value })} />
          </DField>
          <DField label="Vehicle number">
            <DInput value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })} />
          </DField>
          <DField label="Source">
            <DInput required value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </DField>
          <DField label="Destination">
            <DInput required value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
          </DField>
          <DField label="Start date">
            <DInput type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </DField>
          <DField label="Expected delivery">
            <DInput type="date" value={form.expectedDelivery} onChange={(e) => setForm({ ...form, expectedDelivery: e.target.value })} />
          </DField>
          <DField label="Status">
            <DSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TripStatus })}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {prettyStatus(s)}
                </option>
              ))}
            </DSelect>
          </DField>
          <DField label="Distance (km)">
            <DInput
              type="number"
              min={0}
              value={form.distanceKm}
              onChange={(e) => setForm({ ...form, distanceKm: +e.target.value })}
            />
          </DField>
          <div className="sm:col-span-2">
            <DField label="Notes">
              <DTextarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </DField>
          </div>
          <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
            <DButton type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </DButton>
            <DButton type="submit">{editing ? "Save changes" : "Create trip"}</DButton>
          </div>
        </form>
      </DModal>

      <DModal open={!!viewing} onClose={() => setViewing(null)} title={`Trip ${viewing?.tripCode || ""}`}>
        {viewing && (
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold text-slate-700">Route: </span>{viewing.source} → {viewing.destination}</p>
            <p><span className="font-semibold text-slate-700">Vehicle: </span>{viewing.vehicleNumber || "—"}</p>
            <p><span className="font-semibold text-slate-700">Start: </span>{viewing.startDate?.slice(0, 10)}</p>
            <p><span className="font-semibold text-slate-700">Expected: </span>{viewing.expectedDelivery?.slice(0, 10) || "—"}</p>
            <p><span className="font-semibold text-slate-700">Distance: </span>{viewing.distanceKm} km</p>
            <p><span className="font-semibold text-slate-700">Status: </span><DBadge tone={TRIP_STATUS_TONE[viewing.status]}>{prettyStatus(viewing.status)}</DBadge></p>
            {viewing.notes && <p className="rounded-md bg-slate-50 p-3 text-slate-700">{viewing.notes}</p>}
            <div className="flex flex-wrap gap-2 pt-3">
              {viewing.status === "pending" && (
                <DButton onClick={async () => { await changeStatus(viewing, "in_transit"); setViewing(null); }}>
                  Start trip
                </DButton>
              )}
              {viewing.status === "in_transit" && (
                <DButton onClick={async () => { await changeStatus(viewing, "delivered"); setViewing(null); }}>
                  End trip (Delivered)
                </DButton>
              )}
              {viewing.status === "in_transit" && (
                <DButton variant="secondary" onClick={async () => { await changeStatus(viewing, "delayed"); setViewing(null); }}>
                  Mark delayed
                </DButton>
              )}
            </div>
          </div>
        )}
      </DModal>
    </div>
  );
}
