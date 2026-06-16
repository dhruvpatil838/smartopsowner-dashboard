// Shared UI primitives for the Driver Dashboard.
// Self-contained (Tailwind only) so each page stays compact.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DStat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "blue" | "green" | "amber" | "red" | "slate";
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <DCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        <div className={cn("grid h-10 w-10 place-items-center rounded-xl", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </DCard>
  );
}

export function DBadge({
  tone = "slate",
  children,
}: {
  tone?: "blue" | "green" | "amber" | "red" | "slate";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    green: "bg-emerald-100 text-emerald-800 border-emerald-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    red: "bg-red-100 text-red-800 border-red-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function DButton({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50",
    ghost: "text-slate-700 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  } as const;
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
    />
  );
}

export function DInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
        props.className,
      )}
    />
  );
}

export function DTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
        props.className,
      )}
    />
  );
}

export function DSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
        props.className,
      )}
    />
  );
}

export function DField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export function DModal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div
        className={cn(
          "relative w-full rounded-2xl bg-white p-6 shadow-2xl",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function DSection({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function DEmpty({ children }: { children: ReactNode }) {
  return (
    <DCard className="py-12 text-center text-sm text-slate-500">{children}</DCard>
  );
}

export const TRIP_STATUS_TONE: Record<string, "amber" | "blue" | "green" | "red" | "slate"> = {
  pending: "amber",
  in_transit: "blue",
  delivered: "green",
  delayed: "red",
  cancelled: "slate",
};

export const DELIVERY_STATUS_TONE: Record<string, "amber" | "blue" | "green" | "red" | "slate"> = {
  pending: "amber",
  picked_up: "blue",
  in_transit: "blue",
  arrived: "blue",
  delivered: "green",
  delayed: "red",
  cancelled: "slate",
};

export function prettyStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
