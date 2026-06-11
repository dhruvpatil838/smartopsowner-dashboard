import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HiOutlineTruck, HiOutlineWrench, HiOutlineMapPin } from "react-icons/hi2";
import { PageHeader } from "@/components/AppShell";
import { Input, Button, Select } from "@/components/FormControls";
import { DataTable, Modal, Field, StatCard, StatusPill, ToolbarButton } from "@/components/DataPage";
import { useLocalStore, uid, type Vehicle } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/fleet")({
  head: () => ({ meta: [{ title: "Fleet — SmartOps" }] }),
  component: FleetPage,
});

const empty: Omit<Vehicle, "id"> = {
  plate: "",
  model: "",
  driver: "",
  status: "idle",
  mileage: 0,
  lastService: new Date().toISOString().slice(0, 10),
};

function FleetPage() {
  const [list, setList] = useLocalStore<Vehicle[]>("smartops.fleet", []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(empty);

  const stats = useMemo(() => ({
    total: list.length,
    active: list.filter((v) => v.status === "active").length,
    maint: list.filter((v) => v.status === "maintenance").length,
  }), [list]);

  function openCreate() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(row: Vehicle) { setEditing(row); setForm({ ...row }); setOpen(true); }
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (editing) setList(list.map((i) => (i.id === editing.id ? { ...editing, ...form } : i)));
    else setList([{ id: uid(), ...form }, ...list]);
    setOpen(false);
  }
  function remove(row: Vehicle) {
    if (confirm(`Delete vehicle ${row.plate}?`)) setList(list.filter((i) => i.id !== row.id));
  }

  return (
    <div>
      <PageHeader
        title="Fleet"
        description="Vehicles, drivers, mileage and service records."
        actions={<ToolbarButton onClick={openCreate} label="Add vehicle" />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total vehicles" value={String(stats.total)} icon={HiOutlineTruck} />
        <StatCard label="On the road" value={String(stats.active)} icon={HiOutlineMapPin} />
        <StatCard label="In maintenance" value={String(stats.maint)} icon={HiOutlineWrench} />
      </div>

      <DataTable
        rows={list}
        onEdit={openEdit}
        onDelete={remove}
        emptyLabel="No vehicles yet"
        columns={[
          { key: "plate", label: "Plate" },
          { key: "model", label: "Model" },
          { key: "driver", label: "Driver" },
          { key: "mileage", label: "Mileage", render: (r) => <span className="tabular-nums">{r.mileage.toLocaleString()} km</span> },
          { key: "lastService", label: "Last service" },
          {
            key: "status",
            label: "Status",
            render: (r) =>
              r.status === "active" ? <StatusPill tone="ok">Active</StatusPill> :
              r.status === "maintenance" ? <StatusPill tone="warn">Maintenance</StatusPill> :
              <StatusPill tone="muted">Idle</StatusPill>,
          },
        ]}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit vehicle" : "Add vehicle"}>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <Field label="License plate"><Input required value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} /></Field>
          <Field label="Model"><Input required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
          <Field label="Driver"><Input value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })} /></Field>
          <Field label="Mileage (km)"><Input type="number" min={0} value={form.mileage} onChange={(e) => setForm({ ...form, mileage: +e.target.value })} /></Field>
          <Field label="Last service"><Input type="date" value={form.lastService} onChange={(e) => setForm({ ...form, lastService: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Vehicle["status"] })}>
              <option value="active">Active</option><option value="maintenance">Maintenance</option><option value="idle">Idle</option>
            </Select>
          </Field>
          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="aqua">{editing ? "Save changes" : "Add vehicle"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
