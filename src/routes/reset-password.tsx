import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout, Field } from "@/components/AuthLayout";
import { Alert, Button, Input } from "@/components/FormControls";
import { useAuth } from "@/lib/auth";

interface Search {
  token?: string;
}

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — SmartOps" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  component: ResetPage,
});

function ResetPage() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const search = Route.useSearch();
  const [token, setToken] = useState(search.token ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) return setErr("Password must be at least 6 characters.");
    if (password !== confirm) return setErr("Passwords do not match.");
    setLoading(true);
    try {
      await resetPassword(token.trim().toUpperCase(), password);
      setOk(true);
      setTimeout(() => router.navigate({ to: "/login" }), 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reset failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Enter your reset code and choose a new password."
      footer={
        <Link to="/login" className="font-semibold text-ink hover:text-aqua">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {err && <Alert tone="error">{err}</Alert>}
        {ok && <Alert tone="success">Password updated. Redirecting to sign in…</Alert>}
        <Field label="Reset code">
          <Input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ABC12345"
            required
            className="tracking-[0.3em] uppercase"
          />
        </Field>
        <Field label="New password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            required
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm password">
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
            required
            autoComplete="new-password"
          />
        </Field>
        <Button type="submit" variant="aqua" className="w-full" disabled={loading || ok}>
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
