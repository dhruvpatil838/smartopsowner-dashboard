import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  HiOutlineUserCircle,
  HiOutlineKey,
  HiOutlineBell,
  HiOutlineShieldCheck,
  HiOutlineArrowRightOnRectangle,
} from "react-icons/hi2";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/FormControls";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — SmartOps" }] }),
  component: SettingsPage,
});

const sections = [
  {
    title: "My Profile",
    description: "Update your name, phone, and avatar.",
    icon: HiOutlineUserCircle,
    to: "/profile" as const,
  },
  {
    title: "Change Password",
    description: "Rotate your password regularly to stay secure.",
    icon: HiOutlineKey,
    to: "/change-password" as const,
  },
];

function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <div>
      <PageHeader title="Settings" description="Account, security, and workspace preferences." />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.to}
              to={s.to}
              className="card-3d card-3d-hover group flex items-start gap-4 rounded-2xl p-5"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-white shadow-[var(--shadow-aqua)]">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-base font-bold text-ink group-hover:text-aqua">
                  {s.title}
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
              </div>
            </Link>
          );
        })}

        <div className="card-3d rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-ink">
              <HiOutlineBell className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-base font-bold text-ink">Notifications</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Operational alerts and weekly digests. Coming with the Reports module.
              </p>
            </div>
          </div>
        </div>

        <div className="card-3d rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-ink">
              <HiOutlineShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-base font-bold text-ink">Role & Access</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                You are signed in as <span className="font-semibold text-ink">{user?.role}</span>.
                Role changes are managed by the workspace owner.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
        <div>
          <h3 className="font-display text-base font-bold text-ink">Sign out</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            End your session on this device.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            logout();
            router.navigate({ to: "/login", replace: true });
          }}
          className="border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          <HiOutlineArrowRightOnRectangle className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
