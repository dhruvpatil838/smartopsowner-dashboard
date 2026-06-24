import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RoleGuard } from "@/components/RoleGuard";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-aqua" />
          Loading workspace…
        </div>
      </div>
    );
  }
  // Not signed in -> send to login.
  if (!user) return <Navigate to="/login" replace />;

  // The admin portal is shared by owners + supervisors. Drivers are bounced.
  return (
    <RoleGuard allow={["owner", "supervisor"]}>
      <AppShell />
    </RoleGuard>
  );
}
