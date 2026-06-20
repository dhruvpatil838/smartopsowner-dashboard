import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/driver-dashboard")({
  component: () => <Navigate to="/driver-management" replace />,
});
