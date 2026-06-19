import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { HiOutlineCamera, HiOutlinePencil } from "react-icons/hi2";
import {
  DCard, DSection, DButton, DTextarea, DField, DSelect, DEmpty, DBadge,
  DELIVERY_STATUS_TONE, prettyStatus,
} from "@/components/driver/DriverUI";
import { driverApi, type Delivery } from "@/lib/driver-api";

export const Route = createFileRoute("/driver/pod")({
  head: () => ({ meta: [{ title: "Proof of Delivery — Driver Dashboard" }] }),
  component: PodPage,
});

function PodPage() {
  const [list, setList] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [photo, setPhoto] = useState<string>("");
  const [signature, setSignature] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setList(await driverApi.listDeliveries());
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

  const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const MAX_BYTES = 10 * 1024 * 1024;
  const [requirePhoto, setRequirePhoto] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("smartops.pod.requirePhoto") !== "false";
  });
  useEffect(() => {
    localStorage.setItem("smartops.pod.requirePhoto", String(requirePhoto));
  }, [requirePhoto]);

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.toLowerCase();
    if (!ACCEPTED.includes(type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      alert("Unsupported format. Please upload JPG, JPEG, PNG, or WEBP.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      alert(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`);
      e.target.value = "";
      return;
    }
    const r = new FileReader();
    r.onload = () => setPhoto(String(r.result || ""));
    r.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return alert("Select a delivery first.");
    if (requirePhoto && !photo) return alert("A POD photo is required to confirm this delivery.");
    setSaving(true);
    try {
      await driverApi.confirmDelivery(selectedId, {
        photoBase64: photo || undefined,
        signatureBase64: signature || undefined,
        notes,
      });
      setPhoto("");
      setSignature("");
      setNotes("");
      setSelectedId("");
      reload();
      alert("Proof of delivery uploaded.");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const eligible = list.filter((d) => d.status !== "delivered" && d.status !== "cancelled");
  const confirmed = list.filter((d) => d.status === "delivered");

  return (
    <div>
      <DSection
        title="Proof of Delivery"
        description="Upload a photo, capture a signature, add remarks — and confirm the delivery."
      />

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DCard className="lg:col-span-2">
          <h3 className="text-base font-bold text-slate-900">New POD</h3>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading deliveries…</p>
          ) : eligible.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No active deliveries to confirm.</p>
          ) : (
            <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-4">
              <DField label="Delivery">
                <DSelect
                  required
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  <option value="">— Select delivery —</option>
                  {eligible.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.customerName || "Customer"} · {d.address || "no address"} ({prettyStatus(d.status)})
                    </option>
                  ))}
                </DSelect>
              </DField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DField label="Delivery photo">
                  <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 hover:border-blue-400 hover:bg-blue-50/40">
                    {photo ? (
                      <img src={photo} alt="POD" className="h-full w-full rounded-lg object-cover" />
                    ) : (
                      <>
                        <HiOutlineCamera className="h-6 w-6" />
                        <span>Tap to upload photo</span>
                      </>
                    )}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
                  </label>
                </DField>

                <DField label="Customer signature">
                  <SignaturePad value={signature} onChange={setSignature} />
                </DField>
              </div>

              <DField label="Delivery notes">
                <DTextarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the customer mentioned…" />
              </DField>

              <div className="flex justify-end">
                <DButton type="submit" disabled={saving}>
                  {saving ? "Uploading…" : "Confirm delivery"}
                </DButton>
              </div>
            </form>
          )}
        </DCard>

        <DCard>
          <h3 className="text-base font-bold text-slate-900">Recent confirmations</h3>
          <p className="mt-1 text-xs text-slate-500">{confirmed.length} delivered with POD.</p>
          {confirmed.length === 0 ? (
            <DEmpty>No confirmed deliveries yet.</DEmpty>
          ) : (
            <ul className="mt-3 space-y-3">
              {confirmed.slice(0, 8).map((d) => (
                <li key={d._id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                  {d.photoBase64 ? (
                    <img src={d.photoBase64} alt="POD" className="h-12 w-12 rounded-md object-cover" />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-md bg-slate-100 text-slate-400">
                      <HiOutlinePencil className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{d.customerName || "Customer"}</p>
                    <p className="truncate text-xs text-slate-500">
                      {d.deliveredAt ? new Date(d.deliveredAt).toLocaleString() : ""}
                    </p>
                  </div>
                  <DBadge tone={DELIVERY_STATUS_TONE[d.status]}>{prettyStatus(d.status)}</DBadge>
                </li>
              ))}
            </ul>
          )}
        </DCard>
      </div>
    </div>
  );
}

function SignaturePad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (c.width / rect.width), y: (e.clientY - rect.top) * (c.height / rect.height) };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    const p = pos(e);
    ctx.moveTo(p.x, p.y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL("image/png"));
  }
  function clear() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    onChange("");
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white">
      <canvas
        ref={canvasRef}
        width={600}
        height={160}
        className="h-40 w-full touch-none rounded-t-lg bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
        <span>{value ? "Signature captured" : "Sign above with finger or mouse"}</span>
        <button type="button" onClick={clear} className="font-semibold text-blue-600 hover:underline">
          Clear
        </button>
      </div>
    </div>
  );
}
