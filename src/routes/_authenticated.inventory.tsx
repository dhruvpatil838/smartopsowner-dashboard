import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HiOutlineCube, HiOutlineExclamationTriangle, HiOutlineBanknotes } from "react-icons/hi2";
import { PageHeader } from "@/components/AppShell";
import { Input, Button } from "@/components/FormControls";
import { DataTable, Modal, Field, StatCard, StatusPill, ToolbarButton } from "@/components/DataPage";
import { useLocalStore, uid, currency, type InventoryItem } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventory — SmartOps" }] }),
  component: InventoryPage,
});

const empty: Omit<InventoryItem, "id" | "createdAt"> = {
  sku: "",
  name: "",
  category: "",
  quantity: 0,
  unitPrice: 0,
  reorderLevel: 5,
};

function InventoryPage() {
  const [items, setItems] = useLocalStore<InventoryItem[]>("smartops.inventory", []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(empty);

  const stats = useMemo(() => {
    const totalValue = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const low = items.filter((i) => i.quantity <= i.reorderLevel).length;
    return { count: items.length, totalValue, low };
  }, [items]);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(row: InventoryItem) {
    setEditing(row);
    setForm({ ...row });
    setOpen(true);
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      setItems(items.map((i) => (i.id === editing.id ? { ...editing, ...form } : i)));
    } else {
      setItems([{ id: uid(), createdAt: new Date().toISOString(), ...form }, ...items]);
    }
    setOpen(false);
  }
  function remove(row: InventoryItem) {
    if (confirm(`Delete ${row.name}?`)) setItems(items.filter((i) => i.id !== row.id));
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Track stock levels, reorder points, and product value."
        actions={<ToolbarButton onClick={openCreate} label="Add item" />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="SKUs tracked" value={String(stats.count)} icon={HiOutlineCube} />
        <StatCard label="Inventory value" value={currency(stats.totalValue)} icon={HiOutlineBanknotes} />
        <StatCard label="Low stock" value={String(stats.low)} hint="At or below reorder level" icon={HiOutlineExclamationTriangle} />
      </div>

      <DataTable
        rows={items}
        onEdit={openEdit}
        onDelete={remove}
        emptyLabel="No inventory items yet"
        columns={[
          { key: "sku", label: "SKU" },
          { key: "name", label: "Name" },
          { key: "category", label: "Category" },
          { key: "quantity", label: "Qty", render: (r) => <span className="tabular-nums">{r.quantity}</span> },
          { key: "unitPrice", label: "Unit price", render: (r) => <span className="tabular-nums">{currency(r.unitPrice)}</span> },
          {
            key: "status",
            label: "Status",
            render: (r) =>
              r.quantity === 0 ? (
                <StatusPill tone="bad">Out of stock</StatusPill>
              ) : r.quantity <= r.reorderLevel ? (
                <StatusPill tone="warn">Low</StatusPill>
              ) : (
                <StatusPill tone="ok">In stock</StatusPill>
              ),
          },
        ]}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit item" : "Add inventory item"}>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <Field label="SKU"><Input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
          <Field label="Name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="Quantity"><Input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} /></Field>
          <Field label="Unit price"><Input type="number" min={0} step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: +e.target.value })} /></Field>
          <Field label="Reorder level"><Input type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: +e.target.value })} /></Field>
          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="aqua">{editing ? "Save changes" : "Add item"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
