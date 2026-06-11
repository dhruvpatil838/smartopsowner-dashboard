import { type ReactNode } from "react";
import { HiOutlinePlus, HiOutlineInbox, HiOutlineTrash, HiOutlinePencilSquare } from "react-icons/hi2";
import { Button } from "@/components/FormControls";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="card-3d card-3d-hover rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-ink">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-white shadow-[var(--shadow-aqua)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function ToolbarButton({ onClick, label = "Add new" }: { onClick: () => void; label?: string }) {
  return (
    <Button variant="aqua" onClick={onClick}>
      <HiOutlinePlus className="h-4 w-4" />
      {label}
    </Button>
  );
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  onEdit,
  onDelete,
  emptyLabel = "No records yet",
}: {
  columns: { key: keyof T | string; label: string; render?: (row: T) => ReactNode; className?: string }[];
  rows: T[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="card-3d flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-aqua-soft text-aqua">
          <HiOutlineInbox className="h-7 w-7" />
        </div>
        <p className="font-display text-base font-semibold text-ink">{emptyLabel}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Add your first record using the button above. Everything is stored locally in your browser.
        </p>
      </div>
    );
  }
  return (
    <div className="card-3d overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={String(c.key)} className={cn("px-4 py-3 text-left font-semibold", c.className)}>
                  {c.label}
                </th>
              ))}
              {(onEdit || onDelete) && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border transition hover:bg-muted/40">
                {columns.map((c) => (
                  <td key={String(c.key)} className={cn("px-4 py-3 text-ink", c.className)}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key as string] ?? "—")}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(row)}
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-ink"
                          aria-label="Edit"
                        >
                          <HiOutlinePencilSquare className="h-4 w-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(row)}
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Delete"
                        >
                          <HiOutlineTrash className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="glass relative w-full max-w-lg rounded-2xl p-6 shadow-2xl">
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function StatusPill({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: ReactNode }) {
  const tones = {
    ok: "bg-aqua-soft text-ink border-aqua/30",
    warn: "bg-yellow-100 text-yellow-900 border-yellow-300/60",
    bad: "bg-destructive/10 text-destructive border-destructive/30",
    muted: "bg-muted text-muted-foreground border-border",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}
