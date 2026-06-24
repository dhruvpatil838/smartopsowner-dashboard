import { useEffect, type ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth, dashboardForRole, type Role } from "@/lib/auth";

interface RoleGuardProps {
  /** Roles permitted to view this content. */
  allow: Role[];
  children: ReactNode;
}

/**
 * Guards a route's content by role. If the signed-in user is not permitted,
 * fires a toast (once) and redirects to their own dashboard. If the user is
 * signed in but we are still resolving auth, we render nothing; the parent
 * layout shows its own loading state.
 */
export function RoleGuard({ allow, children }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading || !user) return;
    if (!allow.includes(user.role)) {
      toast.error("You don't have access to that page.", {
        description: `Redirected to your ${user.role} dashboard.`,
      });
    }
  }, [loading, user, allow, pathname]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) {
    return <Navigate to={dashboardForRole(user.role)} replace />;
  }
  return <>{children}</>;
}
