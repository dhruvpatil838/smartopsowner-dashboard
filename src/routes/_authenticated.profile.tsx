import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { HiOutlineCamera, HiOutlineCheckCircle } from "react-icons/hi2";
import { PageHeader } from "@/components/AppShell";
import { Field } from "@/components/AuthLayout";
import { Alert, Button, Input, Select } from "@/components/FormControls";
import { useAuth, type Role } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My Profile — SmartOps" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;
  const initials = user.fullName
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function onUpload(file: File) {
    setErr(null);
    if (file.size > 2 * 1024 * 1024) {
      setErr("Image must be under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await updateProfile({ profileImage: reader.result as string });
        flash();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Upload failed.");
      }
    };
    reader.readAsDataURL(file);
  }

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await updateProfile({ fullName: fullName.trim(), phone: phone.trim() });
      setEditing(false);
      flash();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    }
  }

  return (
    <div>
      <PageHeader
        title="My Profile"
        description="Manage how SmartOps identifies you across your workspace."
        actions={
          !editing ? (
            <Button variant="aqua" onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card-3d rounded-2xl p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)] text-2xl font-bold text-white aqua-glow">
                {user.profileImage ? (
                  <img src={user.profileImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-ink shadow-[var(--shadow-3d)] transition hover:scale-105"
                aria-label="Upload profile picture"
              >
                <HiOutlineCamera className="h-4 w-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              />
            </div>
            <h2 className="mt-4 font-display text-xl font-bold text-ink">{user.fullName}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-aqua-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-aqua" />
              {user.role}
            </span>
            <p className="mt-4 text-xs text-muted-foreground">
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="card-3d rounded-2xl p-6 lg:col-span-2">
          {saved && (
            <Alert tone="success">
              <span className="inline-flex items-center gap-2">
                <HiOutlineCheckCircle className="h-4 w-4" /> Profile updated.
              </span>
            </Alert>
          )}
          {err && (
            <div className="mt-2">
              <Alert tone="error">{err}</Alert>
            </div>
          )}
          <form onSubmit={onSave} className="mt-3 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!editing}
                />
              </Field>
              <Field label="Phone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!editing} />
              </Field>
              <Field label="Email">
                <Input value={user.email} disabled />
              </Field>
              <Field label="Role">
                <Select value={user.role} disabled>
                  {(["owner", "manager", "worker"] as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {editing && (
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditing(false);
                    setFullName(user.fullName);
                    setPhone(user.phone ?? "");
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="aqua">
                  Save changes
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
