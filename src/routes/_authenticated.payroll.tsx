import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HiOutlineUsers, HiOutlineBanknotes, HiOutlineCheckCircle } from "react-icons/hi2";
import { PageHeader } from "@/components/AppShell";
import { Input, Button, Select } from "@/components/FormControls";
import { DataTable, Modal, Field, StatCard, StatusPill, ToolbarButton } from "@/components/DataPage";
import { useLocalStore, uid, currency, type Employee } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [{ title: "Payroll — SmartOps" }] }),
  component: PayrollPage,
});

const empty: Omit<Employee, "id"> = {
  name: "",
  role: "",
  department: "Operations",
  salary: 0,
  status: "pending",
};

function PayrollPage() {
  const [list, setList] = useLocalStore<Employee[]>("smartops.payroll", []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(empty);

  const stats = useMemo(() => {
    const total = list.reduce((s, e) => s + e.salary, 0);
    const paid = list.filter((e) => e.status === "paid").reduce((s, e) => s + e.salary, 0);
    return { count: list.length, total, paid };
  }, [list]);

  function openCreate() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(row: Employee) { setEditing(row); setForm({ ...row }); setOpen(true); }
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (editing) setList(list.map((i) => (i.id === editing.id ? { ...editing, ...form } : i)));
    else setList([{ id: uid(), ...form }, ...list]);
    setOpen(false);
  }
  function remove(row: Employee) {
    if (confirm(`Remove ${row.name}?`)) setList(list.filter((i) => i.id !== row.id));
  }
  function togglePaid(row: Employee) {
    setList(list.map((i) => i.id === row.id ? {
      ...i,
      status: i.status === "paid" ? "pending" : "paid",
      payDate: i.status === "paid" ? undefined : new Date().toISOString(),
    } : i));
  }

  return (
    <div>
      <PageHeader
        title="Payroll"
        description="Employees, salaries, and monthly payout status."
        actions={<ToolbarButton onClick={openCreate} label="Add employee" />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Employees" value={String(stats.count)} icon={HiOutlineUsers} />
        <StatCard label="Monthly payroll" value={currency(stats.total)} icon={HiOutlineBanknotes} />
        <StatCard label="Paid this cycle" value={currency(stats.paid)} icon={HiOutlineCheckCircle} />
      </div>

      <DataTable
        rows={list}
        onEdit={openEdit}
        onDelete={remove}
        emptyLabel="No employees yet"
        columns={[
          { key: "name", label: "Name" },
          { key: "role", label: "Role" },
          { key: "department", label: "Department" },
          { key: "salary", label: "Salary", render: (r) => <span className="tabular-nums">{currency(r.salary)}</span> },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <button onClick={() => togglePaid(r)} className="cursor-pointer">
                {r.status === "paid"
                  ? <StatusPill tone="ok">Paid</StatusPill>
                  : <StatusPill tone="warn">Pending</StatusPill>}
              </button>
            ),
          },
        ]}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit employee" : "Add employee"}>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <Field label="Full name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Role"><Input required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
          <Field label="Department">
            <Select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              <option>Operations</option><option>Engineering</option><option>Sales</option>
              <option>Finance</option><option>HR</option><option>Logistics</option>
            </Select>
          </Field>
          <Field label="Monthly salary"><Input type="number" min={0} value={form.salary} onChange={(e) => setForm({ ...form, salary: +e.target.value })} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Employee["status"] })}>
              <option value="pending">Pending</option><option value="paid">Paid</option>
            </Select>
          </Field>
          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="aqua">{editing ? "Save changes" : "Add employee"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
