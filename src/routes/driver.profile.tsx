import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HiOutlineUserCircle, HiOutlineKey } from "react-icons/hi2";
import { DCard, DSection, DButton, DInput, DField, DEmpty } from "@/components/driver/DriverUI";
import { driverApi, type DriverProfile } from "@/lib/driver-api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/driver/profile")({
  head: () => ({ meta: [{ title: "Driver Profile — Driver Dashboard" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [vehicleAssigned, setVehicleAssigned] = useState("");
  const [joiningDate, setJoiningDate] = useState("");

  useEffect(() => {
    driverApi
      .getProfile()
      .then((p) => {
        setProfile(p);
        setFullName(p.user.name || "");
        setPhone(p.user.phone || "");
        setEmployeeId(p.driver.employeeId || "");
        setLicenseNumber(p.driver.licenseNumber || "");
        setVehicleAssigned(p.driver.vehicleAssigned || "");
        setJoiningDate((p.driver.joiningDate || "").slice(0, 10));
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all([
        updateProfile({ fullName, phone }),
        driverApi.updateProfile({
          employeeId,
          licenseNumber,
          vehicleAssigned,
          joiningDate: joiningDate || undefined,
        }),
      ]);
      const fresh = await driverApi.getProfile();
      setProfile(fresh);
      alert("Profile updated.");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <DSection
        title="Driver Profile"
        description="Keep your details current — dispatch uses these for assignment."
        actions={
          <Link to="/change-password">
            <DButton variant="secondary">
              <HiOutlineKey className="h-4 w-4" /> Change password
            </DButton>
          </Link>
        }
      />

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {loading ? (
        <DEmpty>Loading profile…</DEmpty>
      ) : !profile ? null : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <DCard className="lg:col-span-1">
            <div className="flex flex-col items-center text-center">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-blue-100 text-blue-700">
                {user?.profileImage ? (
                  <img src={user.profileImage} alt="" className="h-20 w-20 rounded-full object-cover" />
                ) : (
                  <HiOutlineUserCircle className="h-12 w-12" />
                )}
              </div>
              <p className="mt-3 text-lg font-bold text-slate-900">{profile.user.name}</p>
              <p className="text-sm text-slate-500">{profile.user.email}</p>
              <div className="mt-4 w-full space-y-2 text-left text-sm">
                <Row label="Employee ID" value={profile.driver.employeeId || "—"} />
                <Row label="Phone" value={profile.user.phone || "—"} />
                <Row label="License" value={profile.driver.licenseNumber || "—"} />
                <Row label="Vehicle" value={profile.driver.vehicleAssigned || "—"} />
                <Row
                  label="Joined"
                  value={profile.driver.joiningDate ? new Date(profile.driver.joiningDate).toLocaleDateString() : "—"}
                />
              </div>
            </div>
          </DCard>

          <DCard className="lg:col-span-2">
            <h3 className="text-base font-bold text-slate-900">Edit profile</h3>
            <form onSubmit={save} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DField label="Full name">
                <DInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </DField>
              <DField label="Phone">
                <DInput value={phone} onChange={(e) => setPhone(e.target.value)} />
              </DField>
              <DField label="Employee ID">
                <DInput value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
              </DField>
              <DField label="License number">
                <DInput value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
              </DField>
              <DField label="Vehicle assigned">
                <DInput value={vehicleAssigned} onChange={(e) => setVehicleAssigned(e.target.value)} />
              </DField>
              <DField label="Joining date">
                <DInput type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
              </DField>
              <div className="flex justify-end pt-2 sm:col-span-2">
                <DButton type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </DButton>
              </div>
            </form>
          </DCard>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}
