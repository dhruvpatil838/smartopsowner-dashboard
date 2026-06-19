import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { HiOutlineMagnifyingGlass, HiOutlineXMark } from "react-icons/hi2";
import type { InventoryItem, Employee, Vehicle, ProductionRun } from "@/lib/store";
import { driverApi, type Trip, type Delivery } from "@/lib/driver-api";
import { getToken } from "@/lib/api";

type Hit = {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  to: string;
};

function readLS<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function match(q: string, ...fields: (string | number | undefined | null)[]) {
  const needle = q.toLowerCase();
  return fields.some((f) => f != null && String(f).toLowerCase().includes(needle));
}

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load driver API datasets once authenticated; ignore if no token / offline.
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([driverApi.listTrips(), driverApi.listDeliveries()])
      .then(([t, d]) => {
        if (cancelled) return;
        if (t.status === "fulfilled") setTrips(t.value);
        if (d.status === "fulfilled") setDeliveries(d.value);
        if (t.status === "rejected" && d.status === "rejected") {
          setErr("Live data unavailable — showing local results only.");
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on outside click / Esc
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const term = q.trim();
    if (!term) return [];
    const out: Hit[] = [];

    const inv = readLS<InventoryItem>("smartops.inventory");
    for (const i of inv) {
      if (match(term, i.name, i.sku, i.category))
        out.push({
          id: `inv-${i.id}`,
          category: "Product",
          title: i.name,
          subtitle: `SKU ${i.sku} · ${i.category} · qty ${i.quantity}`,
          to: "/inventory",
        });
    }

    const emps = readLS<Employee>("smartops.payroll");
    for (const e of emps) {
      if (match(term, e.name, e.role, e.department))
        out.push({
          id: `emp-${e.id}`,
          category: "Employee",
          title: e.name,
          subtitle: `${e.role} · ${e.department}`,
          to: "/payroll",
        });
    }

    const fleet = readLS<Vehicle>("smartops.fleet");
    for (const v of fleet) {
      if (match(term, v.plate, v.model, v.driver))
        out.push({
          id: `veh-${v.id}`,
          category: "Vehicle",
          title: `${v.plate} — ${v.model}`,
          subtitle: `Driver ${v.driver} · ${v.status}`,
          to: "/fleet",
        });
    }

    const prod = readLS<ProductionRun>("smartops.production");
    for (const p of prod) {
      if (match(term, p.product, p.line))
        out.push({
          id: `prd-${p.id}`,
          category: "Production",
          title: p.product,
          subtitle: `Line ${p.line} · ${p.status}`,
          to: "/production",
        });
    }

    for (const t of trips) {
      if (match(term, t.tripCode, t.source, t.destination, t.vehicleNumber))
        out.push({
          id: `trp-${t._id}`,
          category: "Trip",
          title: `${t.tripCode} · ${t.source} → ${t.destination}`,
          subtitle: `Vehicle ${t.vehicleNumber} · ${t.status}`,
          to: "/driver/trips",
        });
    }

    for (const d of deliveries) {
      if (match(term, d.customerName, d.address))
        out.push({
          id: `del-${d._id}`,
          category: "Delivery",
          title: d.customerName || "Customer",
          subtitle: `${d.address || "—"} · ${d.status}`,
          to: "/driver/deliveries",
        });
    }

    return out.slice(0, 50);
  }, [q, trips, deliveries]);

  const grouped = useMemo(() => {
    const g: Record<string, Hit[]> = {};
    for (const h of hits) (g[h.category] ||= []).push(h);
    return g;
  }, [hits]);

  function go(to: string) {
    setOpen(false);
    setQ("");
    router.navigate({ to });
  }

  return (
    <div ref={wrapRef} className="relative flex-1">
      <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search products, orders, drivers, vehicles…  (⌘K)"
        className="h-10 w-full max-w-md rounded-lg border border-input bg-surface/60 pl-9 pr-9 text-sm outline-none transition focus:border-aqua focus:bg-surface focus:ring-2 focus:ring-aqua/30"
      />
      {q && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            setOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label="Clear search"
        >
          <HiOutlineXMark className="h-4 w-4" />
        </button>
      )}

      {open && q.trim() && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[70vh] w-full max-w-md overflow-auto rounded-xl border border-border bg-popover shadow-xl">
          {loading && (
            <div className="px-4 py-3 text-xs text-muted-foreground">Loading live data…</div>
          )}
          {err && (
            <div className="px-4 py-2 text-xs text-amber-700">{err}</div>
          )}
          {hits.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results found for “{q}”.
            </div>
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="py-1">
                <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {cat}
                </div>
                {items.map((h) => (
                  <Link
                    key={h.id}
                    to={h.to}
                    onClick={(e) => {
                      e.preventDefault();
                      go(h.to);
                    }}
                    className="block px-4 py-2 hover:bg-muted"
                  >
                    <div className="text-sm font-medium text-ink">{h.title}</div>
                    {h.subtitle && (
                      <div className="truncate text-xs text-muted-foreground">{h.subtitle}</div>
                    )}
                  </Link>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
