import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Logo, Slogan } from "./Logo";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Decorative background */}
      <div className="bg-grid absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full bg-aqua/30 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-[440px] w-[440px] rounded-full bg-[oklch(0.55_0.1_230)]/25 blur-[140px]" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-10 px-6 py-12 lg:grid-cols-2">
        {/* Brand side */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden lg:block"
        >
          <Logo />
          <h1 className="mt-10 font-display text-5xl font-bold tracking-tight text-ink">
            Run your business <br />
            on one calm surface.
          </h1>
          <div className="mt-5">
            <Slogan className="text-base" />
          </div>
          <ul className="mt-10 space-y-3 text-sm text-muted-foreground">
            {[
              "Role-based access for Owners, Managers, Workers",
              "Real-time KPIs across revenue, profit, growth",
              "Secure profiles with avatar & password controls",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-aqua" />
                {t}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Form side */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mx-auto w-full max-w-md"
        >
          <div className="lg:hidden mb-6">
            <Logo />
          </div>
          <div className="glass rounded-2xl p-7 sm:p-8">
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>}
          <div className="mt-6 text-center lg:hidden">
            <Slogan />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
