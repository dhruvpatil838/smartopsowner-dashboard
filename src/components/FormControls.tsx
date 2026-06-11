import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-lg border border-input bg-surface px-3.5 text-sm text-ink outline-none transition",
        "placeholder:text-muted-foreground/70",
        "focus:border-aqua focus:ring-2 focus:ring-aqua/30",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "aqua";
  size?: "sm" | "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const sizes = {
      sm: "h-9 px-3 text-sm",
      md: "h-11 px-5 text-sm",
      lg: "h-12 px-6 text-[15px]",
    } as const;
    const variants = {
      primary:
        "bg-primary text-primary-foreground shadow-[0_1px_0_0_oklch(1_0_0/0.15)_inset,0_10px_20px_-10px_oklch(0.2_0.02_240/0.4)] hover:brightness-110 active:translate-y-px",
      aqua: "bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-white shadow-[var(--shadow-aqua)] hover:brightness-105 active:translate-y-px",
      secondary:
        "border border-border bg-surface text-ink hover:bg-muted hover:shadow-[var(--shadow-3d)]",
      ghost: "text-ink hover:bg-muted",
    } as const;
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          sizes[size],
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm text-ink outline-none transition",
        "focus:border-aqua focus:ring-2 focus:ring-aqua/30",
        className
      )}
      {...props}
    />
  );
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: React.ReactNode;
}) {
  const tones = {
    info: "border-aqua/30 bg-aqua-soft/60 text-ink",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
    success: "border-aqua/30 bg-aqua-soft/60 text-ink",
  } as const;
  return (
    <div className={cn("rounded-lg border px-3.5 py-2.5 text-sm", tones[tone])}>{children}</div>
  );
}
