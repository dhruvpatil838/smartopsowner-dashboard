import { cn } from "@/lib/utils";

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "relative grid h-9 w-9 place-items-center rounded-xl",
          "bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)]",
          "shadow-[0_8px_20px_-8px_oklch(0.74_0.13_205/0.7),inset_0_1px_0_0_oklch(1_0_0/0.5)]"
        )}
      >
        <span className="font-display text-base font-bold text-white">S</span>
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-white shadow-[0_0_0_2px_oklch(0.74_0.13_205)]" />
      </div>
      <div className="leading-none">
        <div
          className={cn(
            "font-display text-lg font-bold tracking-tight",
            tone === "light" ? "text-white" : "text-ink"
          )}
        >
          SmartOps
        </div>
        <div
          className={cn(
            "mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em]",
            tone === "light" ? "text-white/60" : "text-muted-foreground"
          )}
        >
          ERP Suite
        </div>
      </div>
    </div>
  );
}

export function Slogan({ className }: { className?: string }) {
  return (
    <p className={cn("font-display text-sm tracking-tight text-muted-foreground", className)}>
      <span className="text-ink font-semibold">Manage.</span>{" "}
      <span className="text-ink font-semibold">Monitor.</span>{" "}
      <span className="bg-gradient-to-r from-aqua to-[oklch(0.5_0.12_230)] bg-clip-text font-semibold text-transparent">
        Maximize.
      </span>
    </p>
  );
}
