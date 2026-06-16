import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import {
  DCard, DSection, DButton, DInput, DSelect, DTextarea, DField, DModal, DBadge, DEmpty,
} from "@/components/driver/DriverUI";
import { driverApi, type Incident } from "@/lib/driver-api";

export const Route = createFileRoute("/driver/incidents")({
  head: () => ({ meta: [{ title: "Incidents — Driver Dashboard" }] }),
  component: IncidentsPage,
});

const TYPES = ["Vehicle breakdown", "Traffic delay", "Accident", "Customer issue", "Route blocked", "Other"];

const empty = {
  type: TYPES[0],
  description: "",
  location: "",
  occurredAt: new Date().toISOString().slice(0, 16),
  evidenceBase64: "",
  status: "open" as Incident["status"],
};

function IncidentsPage() {
  const [list, setList] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setList(await driverApi.listIncidents());
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setForm((f) => ({ ...f, evidenceBase64: String(r.result || "") }));
    r.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await driverApi.createIncident({
        ...form,
        occurredAt: new Date(form.occurredAt).toISOString(),
      });
      setOpen(false);
      setForm(empty);
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function setStatus(i: Incident, status: Incident["status"]) {
    await driverApi.updateIncident(i._id, { status });
    reload();
  }
  async function remove(i: Incident) {
    if (!confirm("Delete incident?")) return;
    await driverApi.deleteIncident(i._id);
    reload();
  }

  const tone = { open: "red" as const, in_review: "amber" as const, resolved: "green" as const };

  return (
    <div>
      <DSection
        title="Incidents & Delays"
        description="Report any disruption with photo evidence so dispatch can act fast."
        actions={
          <DButton onClick={() => setOpen(true)}>
            <HiOutlinePlus className="h-4 w-4" /> Report incident
          </DButton>
        }
      />

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {loading ? (
        <DEmpty>Loading…</DEmpty>
      ) : list.length === 0 ? (
        <DEmpty>No incidents reported.</DEmpty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {list.map((i) => (
            <DCard key={i._id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{i.type}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {new Date(i.occurredAt).toLocaleString()} · {i.location || "Unknown location"}
                  </p>
                </div>
                <DBadge tone={tone[i.status]}>{i.status.replace("_", " ")}</DBadge>
              </div>
              {i.description && <p className="mt-3 text-sm text-slate-700">{i.description}</p>}
              {i.evidenceBase64 && (
                <img src={i.evidenceBase64} alt="Evidence" className="mt-3 max-h-48 rounded-lg object-cover" />
              )}
              <div className="mt-3 flex items-center justify-between gap-2">
                <select
                  value={i.status}
                  onChange={(e) => setStatus(i, e.target.value as Incident["status"])}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                >
                  <option value="open">Open</option>
                  <option value="in_review">In Review</option>
                  <option value="resolved">Resolved</option>
                </select>
                <button
                  onClick={() => remove(i)}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete"
                >
                  <HiOutlineTrash className="h-4 w-4" />
                </button>
              </div>
            </DCard>
          ))}
        </div>
      )}

      <DModal open={open} onClose={() => setOpen(false)} title="Report incident" wide>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DField label="Incident type">
            <DSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </DSelect>
          </DField>
          <DField label="Location">
            <DInput value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </DField>
          <DField label="When">
            <DInput
              type="datetime-local"
              value={form.occurredAt}
              onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
            />
          </DField>
          <DField label="Status">
            <DSelect
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Incident["status"] })}
            >
              <option value="open">Open</option>
              <option value="in_review">In Review</option>
              <option value="resolved">Resolved</option>
            </DSelect>
          </DField>
          <div className="sm:col-span-2">
            <DField label="Description">
              <DTextarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </DField>
          </div>
          <div className="sm:col-span-2">
            <DField label="Evidence photo">
              <input type="file" accept="image/*" onChange={onFile} className="text-sm" />
              {form.evidenceBase64 && (
                <img src={form.evidenceBase64} alt="" className="mt-2 max-h-40 rounded-lg" />
              )}
            </DField>
          </div>
          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <DButton type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </DButton>
            <DButton type="submit">Report</DButton>
          </div>
        </form>
      </DModal>
    </div>
  );
}
