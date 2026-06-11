import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout, Field } from "@/components/AuthLayout";
import { Alert, Button, Input } from "@/components/FormControls";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — SmartOps" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const t = await requestPasswordReset(email);
      setToken(t);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll generate a one-time reset code for your account."
      footer={
        <>
          Remembered it?{" "}
          <Link to="/login" className="font-semibold text-ink hover:text-aqua">
            Back to sign in
          </Link>
        </>
      }
    >
      {token ? (
        <div className="space-y-4">
          <Alert tone="success">
            <span className="font-semibold">Reset code generated.</span> In a real deployment this is
            emailed to you.
          </Alert>
          <div className="rounded-xl border border-aqua/30 bg-aqua-soft/50 p-4 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Your reset code</p>
            <p className="mt-1 font-display text-2xl font-bold tracking-[0.3em] text-ink">{token}</p>
          </div>
          <Link
            to="/reset-password"
            search={{ token }}
            className="block"
          >
            <Button variant="aqua" className="w-full">
              Continue to reset password
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {err && <Alert tone="error">{err}</Alert>}
          <Field label="Email">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </Field>
          <Button type="submit" variant="aqua" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send reset code"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
