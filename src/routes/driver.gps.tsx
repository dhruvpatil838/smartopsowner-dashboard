import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HiOutlineMapPin, HiOutlineSignal, HiOutlineClock } from "react-icons/hi2";
import { DCard, DSection, DButton, DInput, DField, DStat, DEmpty } from "@/components/driver/DriverUI";
import { driverApi, type GPS } from "@/lib/driver-api";

export const Route = createFileRoute("/driver/gps")({
  head: () => ({ meta: [{ title: "GPS Tracking — Driver Dashboard" }] }),
  component: GpsPage,
});

function GpsPage() {
  const [history, setHistory] = useState<GPS[]>([]);
  const [current, setCurrent] = useState<GPS | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ lat: "", lng: "", speedKph: "", etaMinutes: "" });
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const [h, c] = await Promise.all([driverApi.listGps(50), driverApi.getCurrentGps()]);
      setHistory(h);
      setCurrent(c);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
    const id = setInterval(reload, 15_000);
    return () => clearInterval(id);
  }, []);

  function useBrowserLocation() {
    if (!navigator.geolocation) return alert("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setForm((f) => ({
          ...f,
          lat: p.coords.latitude.toFixed(6),
          lng: p.coords.longitude.toFixed(6),
          speedKph: p.coords.speed ? (p.coords.speed * 3.6).toFixed(1) : f.speedKph,
        })),
      (e) => alert(e.message),
      { enableHighAccuracy: true },
    );
  }

  async function share(e: React.FormEvent) {
    e.preventDefault();
    try {
      await driverApi.postGps({
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        speedKph: form.speedKph ? parseFloat(form.speedKph) : 0,
        etaMinutes: form.etaMinutes ? parseFloat(form.etaMinutes) : 0,
      });
      setForm({ lat: "", lng: "", speedKph: "", etaMinutes: "" });
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div>
      <DSection
        title="GPS Tracking"
        description="Share your location and view recent route history."
      />

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DStat
          label="Current Location"
          value={current ? `${current.lat.toFixed(3)}, ${current.lng.toFixed(3)}` : "—"}
          hint={current ? new Date(current.recordedAt).toLocaleTimeString() : "No data yet"}
          icon={HiOutlineMapPin}
        />
        <DStat
          label="Current Speed"
          value={current ? `${current.speedKph.toFixed(0)} km/h` : "—"}
          icon={HiOutlineSignal}
          tone="blue"
        />
        <DStat
          label="Estimated Arrival"
          value={current?.etaMinutes ? `${current.etaMinutes} min` : "—"}
          icon={HiOutlineClock}
          tone="amber"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DCard className="lg:col-span-1">
          <h3 className="text-base font-bold text-slate-900">Share my location</h3>
          <p className="mt-1 text-xs text-slate-500">
            Use the browser GPS button or enter coordinates manually.
          </p>
          <form onSubmit={share} className="mt-4 grid grid-cols-2 gap-3">
            <DField label="Latitude">
              <DInput required value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
            </DField>
            <DField label="Longitude">
              <DInput required value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
            </DField>
            <DField label="Speed (km/h)">
              <DInput value={form.speedKph} onChange={(e) => setForm({ ...form, speedKph: e.target.value })} />
            </DField>
            <DField label="ETA (min)">
              <DInput value={form.etaMinutes} onChange={(e) => setForm({ ...form, etaMinutes: e.target.value })} />
            </DField>
            <div className="col-span-2 flex justify-between gap-2 pt-2">
              <DButton type="button" variant="secondary" onClick={useBrowserLocation}>
                Use browser GPS
              </DButton>
              <DButton type="submit">Share</DButton>
            </div>
          </form>
        </DCard>

        <DCard className="lg:col-span-2 p-0">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-bold text-slate-900">Location history</h3>
            <p className="text-xs text-slate-500">Refreshes automatically every 15 seconds.</p>
          </div>
          {loading ? (
            <p className="p-5 text-sm text-slate-500">Loading…</p>
          ) : history.length === 0 ? (
            <DEmpty>No GPS points shared yet.</DEmpty>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Time</th>
                    <th className="px-4 py-2.5 text-left">Latitude</th>
                    <th className="px-4 py-2.5 text-left">Longitude</th>
                    <th className="px-4 py-2.5 text-left">Speed</th>
                    <th className="px-4 py-2.5 text-left">ETA</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((g) => (
                    <tr key={g._id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-slate-700">
                        {new Date(g.recordedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{g.lat.toFixed(5)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{g.lng.toFixed(5)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{g.speedKph.toFixed(0)} km/h</td>
                      <td className="px-4 py-2.5 tabular-nums">{g.etaMinutes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DCard>
      </div>
    </div>
  );
}
