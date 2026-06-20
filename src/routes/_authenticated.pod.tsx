import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import {
  HiOutlineCamera,
  HiOutlineEye,
  HiOutlineArrowDownTray,
  HiOutlineCheckBadge,
  HiOutlineXCircle,
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlineArrowPath,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineXMark,
  HiOutlineClock,
  HiOutlineUser,
  HiOutlineMapPin,
  HiOutlineExclamationTriangle,
  HiOutlinePhoto,
  HiOutlineFlag,
  HiOutlineCheckCircle,
} from "react-icons/hi2";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { MButton, MEmpty } from "@/components/management/ManagementUI";
import { useAuth } from "@/lib/auth";
import {
  podApi,
  type Pod,
  type PodStatus,
} from "@/lib/podApi";

export const Route = createFileRoute("/_authenticated/pod")({
  head: () => ({ meta: [{ title: "Proof of Delivery — SmartOps" }] }),
  component: PodAdminPage,
});

const STATUS_LABEL: Record<PodStatus, string> = {
  pending: "Pending",
  verified: "Verified",
  rejected: "Rejected",
};

const STATUS_BADGE: Record<PodStatus, string> = {
  pending: "border-[oklch(0.82_0.08_80)]/40 bg-[oklch(0.95_0.06_70)] text-ink",
  verified: "border-aqua/30 bg-aqua-soft text-ink",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
};

const STATUS_DOT: Record<PodStatus, string> = {
  pending: "bg-[oklch(0.7_0.13_60)]",
  verified: "bg-aqua",
  rejected: "bg-destructive",
};

const PAGE_SIZE = 9;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "MMM d, yyyy · h:mm a") : "—";
}

function PodAdminPage() {
  const { user } = useAuth();
  const adminName = user?.fullName ?? "Admin";

  const [pods, setPods] = useState<Pod[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState<PodStatus | "">("");
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<Pod | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await podApi.list({
        search: debouncedSearch,
        status: statusFilter,
        page,
        pageSize: PAGE_SIZE,
      });
      setPods(res.rows);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const stats = useMemo(() => {
    return {
      total,
      pending: pods.filter((p) => p.status === "pending").length,
      verified: pods.filter((p) => p.status === "verified").length,
      rejected: pods.filter((p) => p.status === "rejected").length,
    };
  }, [pods, total]);

  async function download(path: string | null, filename: string) {
    if (!path) return;
    setActionError(null);
    try {
      const url = await podApi.createSignedDownloadUrl(path);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  async function verify(status: "verified" | "rejected") {
    if (!detail) return;
    setVerifying(true);
    setActionError(null);
    try {
      const updated = await podApi.verify(detail.id, status, adminName);
      setDetail(updated);
      await load();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  const STAT_CARDS = [
    { label: "Total PODs", value: stats.total, icon: HiOutlineCamera, tone: "aqua" },
    { label: "Pending", value: stats.pending, icon: HiOutlineClock, tone: "amber" },
    { label: "Verified", value: stats.verified, icon: HiOutlineCheckCircle, tone: "emerald" },
    { label: "Rejected", value: stats.rejected, icon: HiOutlineXCircle, tone: "slate" },
  ] as const;

  const toneBg: Record<string, string> = {
    aqua: "bg-gradient-to-br from-aqua to-[oklch(0.55_0.12_230)]",
    emerald: "bg-gradient-to-br from-[oklch(0.7_0.14_160)] to-[oklch(0.5_0.1_160)]",
    amber: "bg-gradient-to-br from-[oklch(0.8_0.13_70)] to-[oklch(0.6_0.13_60)]",
    slate: "bg-gradient-to-br from-[oklch(0.5_0.02_240)] to-[oklch(0.3_0.02_240)]",
  };

  const isComplete = (p: Pod) => !!p.start_photo_path && !!p.end_photo_path;

  return (
    <div>
      <PageHeader
        title="Proof of Delivery"
        description="Review, verify, and download proof-of-delivery photos submitted by drivers."
        actions={
          <MButton variant="secondary" onClick={load}>
            <HiOutlineArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </MButton>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CARDS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card-3d card-3d-hover rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="mt-2 font-display text-3xl font-bold text-ink">
                    {loading ? (
                      <span className="inline-block h-8 w-12 animate-pulse rounded bg-muted" />
                    ) : (
                      s.value
                    )}
                  </p>
                </div>
                <div className={cn("grid h-11 w-11 place-items-center rounded-xl text-white", toneBg[s.tone])}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="card-3d mb-4 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by driver or trip code…"
            className="h-11 w-full rounded-lg border border-input bg-surface pl-9 pr-3 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
          />
        </div>
        <div className="relative">
          <HiOutlineFunnel className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PodStatus | "")}
            className="h-11 rounded-lg border border-input bg-surface pl-9 pr-8 text-sm text-ink outline-none transition focus:border-aqua focus:ring-2 focus:ring-aqua/30"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <HiOutlineExclamationTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Something went wrong.</p>
            <p className="text-xs text-destructive/80">{error}</p>
          </div>
        </div>
      )}

      {!error && !loading && pods.length === 0 ? (
        <MEmpty
          icon={HiOutlineCamera}
          title="No POD submissions yet"
          body="Drivers' proof-of-delivery uploads will appear here for review."
        />
      ) : (
        <>
          {/* Grid of POD cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="card-3d h-64 animate-pulse rounded-2xl" />
                ))
              : pods.map((p, i) => {
                  const startUrl = podApi.publicUrl(p.start_photo_path);
                  const endUrl = podApi.publicUrl(p.end_photo_path);
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="card-3d card-3d-hover overflow-hidden rounded-2xl"
                    >
                      {/* Thumbnail */}
                      <div className="relative h-40 w-full bg-surface-muted">
                        {endUrl || startUrl ? (
                          <img
                            src={endUrl ?? startUrl ?? ""}
                            alt="POD"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full place-items-center text-muted-foreground">
                            <HiOutlinePhoto className="h-8 w-8" />
                          </div>
                        )}
                        <span
                          className={cn(
                            "absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border bg-white/90 px-2.5 py-0.5 text-xs font-semibold backdrop-blur",
                            STATUS_BADGE[p.status],
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[p.status])} />
                          {STATUS_LABEL[p.status]}
                        </span>
                        {!isComplete(p) && (
                          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 backdrop-blur">
                            <HiOutlineClock className="h-3 w-3" /> Incomplete
                          </span>
                        )}
                      </div>

                      {/* Body */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-ink">
                              {p.trip_code || "Untitled trip"}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <HiOutlineUser className="h-3 w-3" /> {p.driver_name}
                            </p>
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {p.start_photo_path || endUrl ? "2 photos" : "—"}
                          </span>
                        </div>

                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <p className="flex items-center gap-1">
                            <HiOutlineFlag className="h-3 w-3 text-aqua" /> Start:{" "}
                            {fmtDate(p.start_photo_at)}
                          </p>
                          <p className="flex items-center gap-1">
                            <HiOutlineMapPin className="h-3 w-3 text-aqua" /> End:{" "}
                            {fmtDate(p.end_photo_at)}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                          <button
                            onClick={() => {
                              setDetail(p);
                              setActionError(null);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-aqua transition hover:bg-aqua-soft"
                          >
                            <HiOutlineEye className="h-4 w-4" /> View
                          </button>
                          <div className="flex items-center gap-1">
                            {p.start_photo_path && (
                              <button
                                onClick={() =>
                                  download(
                                    p.start_photo_path,
                                    `${p.trip_code || "pod"}-start.jpg`,
                                  )
                                }
                                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-ink"
                                title="Download start photo"
                              >
                                <HiOutlineArrowDownTray className="h-4 w-4" />
                              </button>
                            )}
                            {p.end_photo_path && (
                              <button
                                onClick={() =>
                                  download(
                                    p.end_photo_path,
                                    `${p.trip_code || "pod"}-end.jpg`,
                                  )
                                }
                                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-ink"
                                title="Download end photo"
                              >
                                <HiOutlineArrowDownTray className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
          </div>

          {/* Pagination */}
          <div className="card-3d mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl px-4 py-3 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Loading…"
                : `Showing ${pods.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + pods.length} of ${total}`}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <HiOutlineChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
                const p = i + 1;
                const active = p === page;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold transition",
                      active
                        ? "border-aqua bg-aqua text-aqua-foreground"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-ink",
                    )}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <HiOutlineChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Detail / verify modal */}
      <AnimatePresence>
        {detail && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              onClick={() => setDetail(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="glass relative my-4 w-full max-w-4xl rounded-2xl p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl font-bold text-ink">
                      {detail.trip_code || "Untitled trip"}
                    </h2>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                        STATUS_BADGE[detail.status],
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[detail.status])} />
                      {STATUS_LABEL[detail.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {detail.driver_name}
                    {detail.verified_by ? ` · verified by ${detail.verified_by}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => setDetail(null)}
                  className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-ink"
                  aria-label="Close"
                >
                  <HiOutlineXMark className="h-5 w-5" />
                </button>
              </div>

              {actionError && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <HiOutlineExclamationTriangle className="h-4 w-4 shrink-0" />
                  {actionError}
                </div>
              )}

              {/* Two photos side by side */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <PhotoSection
                  title="Trip Start"
                  path={detail.start_photo_path}
                  timestamp={detail.start_photo_at}
                  onDownload={() =>
                    download(detail.start_photo_path, `${detail.trip_code || "pod"}-start.jpg`)
                  }
                />
                <PhotoSection
                  title="Trip End"
                  path={detail.end_photo_path}
                  timestamp={detail.end_photo_at}
                  onDownload={() =>
                    download(detail.end_photo_path, `${detail.trip_code || "pod"}-end.jpg`)
                  }
                />
              </div>

              {detail.notes && (
                <div className="mt-4 rounded-lg border border-border bg-surface-muted/40 p-3 text-sm text-ink">
                  <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Driver notes
                  </p>
                  {detail.notes}
                </div>
              )}

              {/* Verification actions */}
              <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  {detail.verified_at
                    ? `Last action: ${fmtDate(detail.verified_at)}`
                    : "Not yet reviewed."}
                </div>
                <div className="flex items-center gap-2">
                  <MButton
                    variant="secondary"
                    onClick={() => verify("rejected")}
                    disabled={verifying || detail.status === "rejected"}
                  >
                    <HiOutlineXCircle className="h-4 w-4" /> Reject
                  </MButton>
                  <MButton
                    onClick={() => verify("verified")}
                    disabled={verifying || detail.status === "verified"}
                  >
                    <HiOutlineCheckBadge className="h-4 w-4" />
                    {verifying ? "Saving…" : "Verify"}
                  </MButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PhotoSection({
  title,
  path,
  timestamp,
  onDownload,
}: {
  title: string;
  path: string | null;
  timestamp: string | null;
  onDownload: () => void;
}) {
  const url = podApi.publicUrl(path);
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border bg-surface-muted px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <HiOutlineFlag className="h-3.5 w-3.5 text-aqua" />
          {title}
        </div>
        {timestamp && (
          <span className="text-[10px] text-muted-foreground">{fmtDate(timestamp)}</span>
        )}
      </div>
      {url ? (
        <div className="relative">
          <img src={url} alt={title} className="max-h-72 w-full bg-black object-contain" />
          <button
            onClick={onDownload}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-ink shadow backdrop-blur transition hover:bg-white"
          >
            <HiOutlineArrowDownTray className="h-3.5 w-3.5" /> Download
          </button>
        </div>
      ) : (
        <div className="grid h-44 place-items-center text-muted-foreground">
          <div className="flex flex-col items-center gap-1.5">
            <HiOutlinePhoto className="h-6 w-6" />
            <span className="text-xs">No photo uploaded</span>
          </div>
        </div>
      )}
    </div>
  );
}
