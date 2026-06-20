// Reusable UI primitives for the Driver Management portal.
// Uses the SmartOps design tokens for visual consistency.
import { AnimatePresence, motion } from "framer-motion";
import { HiOutlineXMark } from "react-icons/hi2";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MStat({
  label,
  value,
  icon: Icon,
  tone = "aqua",
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "aqua" | "emerald" | "amber" | "slate" | "blue";
  hint?: string;
}) {
  const tones: Record<string, string> = {
    aqua: "bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)]",
    emerald: "bg-gradient-to-br from-[oklch(0.7_0.14_160)] to-[oklch(0.5_0.1_160)]",
    amber: "bg-gradient-to-br from-[oklch(0.8_0.13_70)] to-[oklch(0.6_0.13_60)]",
    slate: "bg-gradient-to-br from-[oklch(0.5_0.02_240)] to-[oklch(0.3_0.02_240)]",
    blue: "bg-gradient-to-br from-[oklch(0.6_0.13_250)] to-[oklch(0.4_0.1_250)]",
  };
  return (
    <div className="card-3d card-3d-hover relative overflow-hidden rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-ink">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            "grid h-11 w-11 place-items-center rounded-xl text-white shadow-[var(--shadow-aqua)]",
            tones[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

type MButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function MButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: MButtonProps) {
  const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-5 text-sm" } as const;
  const variants = {
    primary:
      "bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-white shadow-[var(--shadow-aqua)] hover:brightness-105 active:translate-y-px",
    secondary: "border border-border bg-surface text-ink hover:bg-muted hover:shadow-[var(--shadow-3d)]",
    ghost: "text-ink hover:bg-muted",
    danger: "bg-destructive text-destructive-foreground hover:brightness-105 active:translate-y-px",
  } as const;
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        sizes[size],
        variants[variant],
        className,
      )}
    />
  );
}

export function MInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-11 w-full rounded-lg border border-input bg-surface px-3.5 text-sm text-ink outline-none transition",
        "placeholder:text-muted-foreground/70",
        "focus:border-aqua focus:ring-2 focus:ring-aqua/30",
        "disabled:cursor-not-allowed disabled:opacity-60",
        props.className,
      )}
    />
  );
}

export function MSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm text-ink outline-none transition",
        "focus:border-aqua focus:ring-2 focus:ring-aqua/30",
        "disabled:cursor-not-allowed disabled:opacity-60",
        props.className,
      )}
    />
  );
}

export function MField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export function MModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "glass relative w-full rounded-2xl p-6 shadow-2xl",
              wide ? "max-w-2xl" : "max-w-lg",
            )}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
                {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-ink"
                aria-label="Close"
              >
                <HiOutlineXMark className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function MStatusBadge({ status }: { status: "active" | "inactive" }) {
  const isActive = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        isActive
          ? "border-aqua/30 bg-aqua-soft text-ink"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive ? "bg-aqua" : "bg-muted-foreground",
        )}
      />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export function MEmpty({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body?: string;
}) {
  return (
    <div className="card-3d flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-aqua-soft text-aqua">
        <Icon className="h-7 w-7" />
      </div>
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
    </div>
  );
}
