import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import {
  DCard, DSection, DButton, DInput, DSelect, DTextarea, DField, DModal, DBadge, DEmpty,
  DELIVERY_STATUS_TONE, prettyStatus,
} from "@/components/driver/DriverUI";
import { driverApi, type Delivery, type DeliveryStatus } from "@/lib/driver-api";

export const Route = createFileRoute("/driver/deliveries")({
  head: () => ({ meta: [{ title: "Deliveries — Driver Dashboard" }] }),
  component: DeliveriesPage,
});

const STATUSES: DeliveryStatus[] = [
  "pending",
  "picked_up",
  "in_transit",
  "arrived",
  "delivered",
  "delayed",
  "cancelled",
];

const empty = {
  customerName: "",
  address: "",
  status: "pending" as DeliveryStatus,
  notes: "",
};

function DeliveriesPage() {
  const [list, setList] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setList(await driverApi.listDeliveries());
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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await driverApi.createDelivery(form);
      setOpen(false);
      setForm(empty);
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function setStatus(d: Delivery, status: DeliveryStatus) {
    await driverApi.updateDelivery(d._id, { status });
    reload();
  }

  async function remove(d: Delivery) {
    if (!confirm("Delete delivery?")) return;
    await driverApi.deleteDelivery(d._id);
    reload();
  }

  return (
    <div>
      <DSection
        title="Deliveries"
        description="Manage every delivery’s lifecycle: picked up, in transit, arrived, delivered."
        actions={
          <DButton onClick={() => setOpen(true)}>
            <HiOutlinePlus className="h-4 w-4" /> New delivery
          </DButton>
        }
      />

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {loading ? (
        <DEmpty>Loading…</DEmpty>
      ) : list.length === 0 ? (
        <DEmpty>No deliveries yet.</DEmpty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((d) => (
            <DCard key={d._id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{d.customerName || "Customer"}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{d.address || "No address"}</p>
                </div>
                <DBadge tone={DELIVERY_STATUS_TONE[d.status]}>{prettyStatus(d.status)}</DBadge>
              </div>
              <div className="mt-3">
                <select
                  value={d.status}
                  onChange={(e) => setStatus(d, e.target.value as DeliveryStatus)}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      Set to: {prettyStatus(s)}
                    </option>
                  ))}
                </select>
              </div>
              {d.notes && <p className="mt-3 rounded-md bg-slate-50 p-2 text-xs text-slate-600">{d.notes}</p>}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>Created {new Date(d.createdAt).toLocaleDateString()}</span>
                <button
                  onClick={() => remove(d)}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete"
                >
                  <HiOutlineTrash className="h-4 w-4" />
                </button>
              </div>
            </DCard>
          ))}
        </div>
      )}

      <DModal open={open} onClose={() => setOpen(false)} title="New delivery">
        <form onSubmit={create} className="grid grid-cols-1 gap-3">
          <DField label="Customer name">
            <DInput required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          </DField>
          <DField label="Address">
            <DInput required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </DField>
          <DField label="Status">
            <DSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as DeliveryStatus })}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {prettyStatus(s)}
                </option>
              ))}
            </DSelect>
          </DField>
          <DField label="Notes">
            <DTextarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </DField>
          <div className="flex justify-end gap-2 pt-2">
            <DButton type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </DButton>
            <DButton type="submit">Create</DButton>
          </div>
        </form>
      </DModal>
    </div>
  );
}
