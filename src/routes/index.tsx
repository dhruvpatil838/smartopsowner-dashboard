import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth, dashboardForRole } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? dashboardForRole(user.role) : "/login"} replace />;
}
