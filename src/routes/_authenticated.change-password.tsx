import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Field } from "@/components/AuthLayout";
import { Alert, Button, Input } from "@/components/FormControls";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/change-password")({
  head: () => ({ meta: [{ title: "Change Password — SmartOps" }] }),
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(false);
    if (form.next.length < 6) return setErr("New password must be at least 6 characters.");
    if (form.next !== form.confirm) return setErr("Passwords do not match.");
    setLoading(true);
    try {
      await changePassword(form.current, form.next);
      setOk(true);
      setForm({ current: "", next: "", confirm: "" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not change password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Change Password"
        description="Pick something strong — at least 6 characters."
      />
      <div className="card-3d max-w-xl rounded-2xl p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          {err && <Alert tone="error">{err}</Alert>}
          {ok && <Alert tone="success">Password updated successfully.</Alert>}
          <Field label="Current password">
            <Input
              type="password"
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
              required
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password">
            <Input
              type="password"
              value={form.next}
              onChange={(e) => setForm({ ...form, next: e.target.value })}
              required
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
              autoComplete="new-password"
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" variant="aqua" disabled={loading}>
              {loading ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
