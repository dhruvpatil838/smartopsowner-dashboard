import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HiOutlineWrenchScrewdriver, HiOutlineCheckCircle, HiOutlineBolt } from "react-icons/hi2";
import { PageHeader } from "@/components/AppShell";
import { Input, Button, Select } from "@/components/FormControls";
import { DataTable, Modal, Field, StatCard, StatusPill, ToolbarButton } from "@/components/DataPage";
import { useLocalStore, uid, type ProductionRun } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/production")({
  head: () => ({ meta: [{ title: "Production — SmartOps" }] }),
  component: ProductionPage,
});

const empty: Omit<ProductionRun, "id"> = {
  product: "",
  line: "Line A",
  target: 0,
  produced: 0,
  status: "planned",
  date: new Date().toISOString().slice(0, 10),
};

function ProductionPage() {
  const [list, setList] = useLocalStore<ProductionRun[]>("smartops.production", []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionRun | null>(null);
  const [form, setForm] = useState(empty);

  const stats = useMemo(() => {
    const target = list.reduce((s, r) => s + r.target, 0);
    const produced = list.reduce((s, r) => s + r.produced, 0);
    const eff = target ? Math.round((produced / target) * 100) : 0;
    return { runs: list.length, produced, eff };
  }, [list]);

  function openCreate() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(row: ProductionRun) { setEditing(row); setForm({ ...row }); setOpen(true); }
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (editing) setList(list.map((i) => (i.id === editing.id ? { ...editing, ...form } : i)));
    else setList([{ id: uid(), ...form }, ...list]);
    setOpen(false);
  }
  function remove(row: ProductionRun) {
    if (confirm(`Delete run for ${row.product}?`)) setList(list.filter((i) => i.id !== row.id));
  }

  return (
    <div>
      <PageHeader
        title="Production"
        description="Plan production runs and track output against targets."
        actions={<ToolbarButton onClick={openCreate} label="Add run" />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Production runs" value={String(stats.runs)} icon={HiOutlineWrenchScrewdriver} />
        <StatCard label="Units produced" value={stats.produced.toLocaleString()} icon={HiOutlineCheckCircle} />
        <StatCard label="Efficiency" value={`${stats.eff}%`} hint="Produced ÷ target" icon={HiOutlineBolt} />
      </div>

      <DataTable
        rows={list}
        onEdit={openEdit}
        onDelete={remove}
        emptyLabel="No production runs yet"
        columns={[
          { key: "date", label: "Date" },
          { key: "product", label: "Product" },
          { key: "line", label: "Line" },
          {
            key: "progress",
            label: "Progress",
            render: (r) => {
              const pct = r.target ? Math.min(100, Math.round((r.produced / r.target) * 100)) : 0;
              return (
                <div className="flex w-44 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-aqua" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{r.produced}/{r.target}</span>
                </div>
              );
            },
          },
          {
            key: "status",
            label: "Status",
            render: (r) =>
              r.status === "completed" ? <StatusPill tone="ok">Completed</StatusPill> :
              r.status === "running" ? <StatusPill tone="warn">Running</StatusPill> :
              <StatusPill tone="muted">Planned</StatusPill>,
          },
        ]}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit production run" : "Add production run"}>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <Field label="Product"><Input required value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} /></Field>
          <Field label="Line">
            <Select value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })}>
              <option>Line A</option><option>Line B</option><option>Line C</option>
            </Select>
          </Field>
          <Field label="Target units"><Input type="number" min={0} value={form.target} onChange={(e) => setForm({ ...form, target: +e.target.value })} /></Field>
          <Field label="Produced units"><Input type="number" min={0} value={form.produced} onChange={(e) => setForm({ ...form, produced: +e.target.value })} /></Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProductionRun["status"] })}>
              <option value="planned">Planned</option><option value="running">Running</option><option value="completed">Completed</option>
            </Select>
          </Field>
          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="aqua">{editing ? "Save changes" : "Add run"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
