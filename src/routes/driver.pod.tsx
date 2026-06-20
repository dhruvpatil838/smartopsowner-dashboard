import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  HiOutlineCamera,
  HiOutlinePhoto,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineArrowPath,
  HiOutlineXMark,
  HiOutlineTruck,
  HiOutlineFlag,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import {
  DCard,
  DSection,
  DButton,
  DField,
  DInput,
  DTextarea,
  DEmpty,
  DBadge,
} from "@/components/driver/DriverUI";
import { useAuth } from "@/lib/auth";
import { podApi, type Pod } from "@/lib/podApi";

export const Route = createFileRoute("/driver/pod")({
  head: () => ({ meta: [{ title: "Proof of Delivery — Driver Dashboard" }] }),
  component: PodPage,
});

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

function validateFile(file: File): string | null {
  const type = file.type.toLowerCase();
  if (!ACCEPTED.includes(type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return "Unsupported format. Use JPG, PNG, or WEBP.";
  }
  if (file.size > MAX_BYTES) {
    return `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`;
  }
  return null;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function PodPage() {
  const { user } = useAuth();
  const driverName = user?.fullName ?? "Driver";
  const driverId = user?.id ?? null;

  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [tripCode, setTripCode] = useState("");
  const [notes, setNotes] = useState("");

  const [startFile, setStartFile] = useState<File | null>(null);
  const [startPreview, setStartPreview] = useState("");
  const [endFile, setEndFile] = useState<File | null>(null);
  const [endPreview, setEndPreview] = useState("");

  const [activePod, setActivePod] = useState<Pod | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingMsg, setSavingMsg] = useState("");

  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    if (!driverId) return;
    setLoading(true);
    setErr(null);
    try {
      const list = await podApi.listForDriver(driverId);
      setPods(list);
      const inProgress = list.find((p) => !p.end_photo_path);
      if (inProgress) {
        setActivePod(inProgress);
        setTripCode(inProgress.trip_code ?? "");
        setNotes(inProgress.notes ?? "");
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  function pickStart(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const v = validateFile(file);
    if (v) {
      alert(v);
      e.target.value = "";
      return;
    }
    setStartFile(file);
    setStartPreview(URL.createObjectURL(file));
  }

  function pickEnd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const v = validateFile(file);
    if (v) {
      alert(v);
      e.target.value = "";
      return;
    }
    setEndFile(file);
    setEndPreview(URL.createObjectURL(file));
  }

  // Step 1: create the POD record (trip start)
  async function startTrip(e: React.FormEvent) {
    e.preventDefault();
    if (!startFile) return alert("Capture or upload a trip-start photo.");
    setSaving(true);
    setSavingMsg("Uploading start photo…");
    setErr(null);
    try {
      const pod = await podApi.create({
        trip_code: tripCode.trim() || null,
        driver_id: driverId,
        driver_name: driverName,
        notes: notes.trim() || null,
      });
      const path = await podApi.uploadPhoto(startFile, driverId, "start");
      const updated = await podApi.attachPhoto(pod.id, "start", path);
      setActivePod(updated);
      setStartFile(null);
      setStartPreview("");
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
      setSavingMsg("");
    }
  }

  // Step 2: attach the end photo to the active POD
  async function endTrip(e: React.FormEvent) {
    e.preventDefault();
    if (!activePod) return;
    if (!endFile) return alert("Capture or upload a trip-end photo.");
    setSaving(true);
    setSavingMsg("Uploading end photo…");
    setErr(null);
    try {
      if (notes.trim() && notes !== activePod.notes) {
        await podApi.updateNotes(activePod.id, notes.trim());
      }
      const path = await podApi.uploadPhoto(endFile, driverId, "end");
      const updated = await podApi.attachPhoto(activePod.id, "end", path);
      setActivePod(updated);
      setEndFile(null);
      setEndPreview("");
      setTripCode("");
      setNotes("");
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
      setSavingMsg("");
    }
  }

  function resetDrafts() {
    setActivePod(null);
    setStartFile(null);
    setEndFile(null);
    setStartPreview("");
    setEndPreview("");
    setTripCode("");
    setNotes("");
  }

  const completed = useMemo(
    () => pods.filter((p) => p.start_photo_path && p.end_photo_path),
    [pods],
  );

  const hasActive = !!activePod && !activePod.end_photo_path;

  return (
    <div>
      <DSection
        title="Proof of Delivery"
        description="Capture or upload photos at trip start and trip end. Images are stored securely and verified by admin."
      />

      {err && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <HiOutlineExclamationTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Upload flow */}
        <DCard className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              {hasActive ? "Trip End — Capture Delivery" : "Trip Start — Capture Pickup"}
            </h3>
            {hasActive && (
              <DBadge tone="amber">
                <HiOutlineClock className="h-3.5 w-3.5" /> Trip in progress
              </DBadge>
            )}
          </div>

          {/* Step 1: trip start */}
          {!hasActive && (
            <form onSubmit={startTrip} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DField label="Trip / Delivery code (optional)">
                  <DInput
                    value={tripCode}
                    onChange={(e) => setTripCode(e.target.value)}
                    placeholder="TRP-2024-0148"
                  />
                </DField>
                <DField label="Notes (optional)">
                  <DInput
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Pickup condition, seal #…"
                  />
                </DField>
              </div>

              <PhotoUploader
                label="Trip Start Photo *"
                preview={startPreview}
                inputRef={startInputRef}
                onPick={pickStart}
                onClear={() => {
                  setStartFile(null);
                  setStartPreview("");
                }}
              />

              <div className="flex justify-end">
                <DButton type="submit" disabled={saving}>
                  {saving ? savingMsg || "Saving…" : "Start Trip"}
                </DButton>
              </div>
            </form>
          )}

          {/* Step 2: trip end */}
          {hasActive && (
            <form onSubmit={endTrip} className="mt-4 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-900">{activePod.driver_name}</p>
                <p className="text-xs text-slate-500">
                  {activePod.trip_code ? `${activePod.trip_code} · ` : ""}
                  Started {fmtTime(activePod.start_photo_at)}
                </p>
                {activePod.start_photo_path && (
                  <img
                    src={podApi.publicUrl(activePod.start_photo_path) ?? ""}
                    alt="Start"
                    className="mt-2 h-20 w-32 rounded-md object-cover"
                  />
                )}
              </div>

              <DField label="Delivery notes (optional)">
                <DTextarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Receiver name, exceptions…"
                />
              </DField>

              <PhotoUploader
                label="Trip End Photo *"
                preview={endPreview}
                inputRef={endInputRef}
                onPick={pickEnd}
                onClear={() => {
                  setEndFile(null);
                  setEndPreview("");
                }}
              />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={resetDrafts}
                  className="text-xs font-semibold text-slate-500 hover:underline"
                >
                  Cancel active trip
                </button>
                <DButton type="submit" disabled={saving}>
                  {saving ? savingMsg || "Saving…" : "Complete Delivery"}
                </DButton>
              </div>
            </form>
          )}
        </DCard>

        {/* Progress / stats */}
        <DCard>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">My PODs</h3>
            <button
              onClick={reload}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Refresh"
            >
              <HiOutlineArrowPath className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Total" value={pods.length} tone="bg-slate-100 text-slate-700" />
            <Stat
              label="In Progress"
              value={pods.filter((p) => !p.end_photo_path).length}
              tone="bg-amber-100 text-amber-700"
            />
            <Stat
              label="Verified"
              value={pods.filter((p) => p.status === "verified").length}
              tone="bg-emerald-100 text-emerald-700"
            />
          </div>

          <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recently completed
          </p>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : completed.length === 0 ? (
            <DEmpty>No completed PODs yet.</DEmpty>
          ) : (
            <ul className="space-y-2">
              {completed.slice(0, 6).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5"
                >
                  <img
                    src={podApi.publicUrl(p.end_photo_path) ?? ""}
                    alt="POD"
                    className="h-11 w-11 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {p.trip_code || "Trip"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {fmtTime(p.end_photo_at)}
                    </p>
                  </div>
                  <DBadge
                    tone={
                      p.status === "verified"
                        ? "green"
                        : p.status === "rejected"
                          ? "red"
                          : "amber"
                    }
                  >
                    {p.status}
                  </DBadge>
                </li>
              ))}
            </ul>
          )}
        </DCard>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-lg p-2">
      <div className={`mx-auto grid h-9 w-9 place-items-center rounded-full ${tone}`}>
        <span className="text-sm font-bold">{value}</span>
      </div>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}

function PhotoUploader({
  label,
  preview,
  inputRef,
  onPick,
  onClear,
}: {
  label: string;
  preview: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  return (
    <DField label={label}>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-blue-400 hover:bg-blue-50/40">
          {preview ? (
            <img src={preview} alt="preview" className="h-full w-full rounded-lg object-cover" />
          ) : (
            <>
              <HiOutlineCamera className="h-7 w-7" />
              <span className="text-sm font-medium">Capture Photo</span>
              <span className="text-[10px] text-slate-400">Uses device camera</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={onPick}
          />
        </label>

        <label className="flex h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-blue-400 hover:bg-blue-50/40">
          {preview ? (
            <div className="relative h-full w-full">
              <img src={preview} alt="preview" className="h-full w-full rounded-lg object-cover" />
            </div>
          ) : (
            <>
              <HiOutlinePhoto className="h-7 w-7" />
              <span className="text-sm font-medium">Upload from Gallery</span>
              <span className="text-[10px] text-slate-400">JPG, PNG, WEBP · ≤10MB</span>
            </>
          )}
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={onPick}
          />
        </label>
      </div>

      {preview && (
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <HiOutlineCheckCircle className="h-4 w-4" /> Photo ready
          </span>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
          >
            <HiOutlineXMark className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      )}
    </DField>
  );
}
