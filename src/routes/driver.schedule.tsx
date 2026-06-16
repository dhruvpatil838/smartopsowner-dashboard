import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DCard, DSection, DBadge, DEmpty, TRIP_STATUS_TONE, prettyStatus } from "@/components/driver/DriverUI";
import { driverApi, type Trip } from "@/lib/driver-api";

export const Route = createFileRoute("/driver/schedule")({
  head: () => ({ meta: [{ title: "Schedule — Driver Dashboard" }] }),
  component: SchedulePage,
});

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function SchedulePage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    driverApi.listTrips().then(setTrips).finally(() => setLoading(false));
  }, []);

  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  function tripsFor(date: Date) {
    return trips.filter((t) => {
      const ds = (t.expectedDelivery || t.startDate)?.slice(0, 10);
      return ds === date.toISOString().slice(0, 10);
    });
  }

  const today = new Date();
  const todayList = tripsFor(today);
  const upcoming = trips
    .filter((t) => {
      const d = new Date(t.expectedDelivery || t.startDate);
      return d > today;
    })
    .slice(0, 6);

  return (
    <div>
      <DSection title="Delivery Schedule" description="Plan your week. Tap any day to see deliveries." />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DCard className="lg:col-span-2 p-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h3 className="text-base font-bold text-slate-900">
              Week of {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const d = new Date(weekStart);
                  d.setDate(d.getDate() - 7);
                  setWeekStart(d);
                }}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
              >
                ◀ Prev
              </button>
              <button
                onClick={() => setWeekStart(startOfWeek(new Date()))}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const d = new Date(weekStart);
                  d.setDate(d.getDate() + 7);
                  setWeekStart(d);
                }}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
              >
                Next ▶
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px bg-slate-100">
            {week.map((d) => {
              const isToday = d.toDateString() === new Date().toDateString();
              const items = tripsFor(d);
              return (
                <div key={d.toISOString()} className="min-h-32 bg-white p-2">
                  <p className={`text-xs font-semibold ${isToday ? "text-blue-700" : "text-slate-500"}`}>
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? "text-blue-700" : "text-slate-900"}`}>
                    {d.getDate()}
                  </p>
                  <div className="mt-2 space-y-1">
                    {items.slice(0, 3).map((t) => (
                      <div
                        key={t._id}
                        className="truncate rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-800"
                        title={`${t.tripCode}: ${t.source} → ${t.destination}`}
                      >
                        {t.tripCode}
                      </div>
                    ))}
                    {items.length > 3 && (
                      <p className="text-[10px] text-slate-400">+{items.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DCard>

        <DCard>
          <h3 className="text-base font-bold text-slate-900">Today’s deliveries</h3>
          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Loading…</p>
          ) : todayList.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nothing on your plate today. 🎉</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {todayList.map((t) => (
                <li key={t._id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{t.tripCode}</p>
                    <DBadge tone={TRIP_STATUS_TONE[t.status]}>{prettyStatus(t.status)}</DBadge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {t.source} → {t.destination}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DCard>
      </div>

      <h3 className="mb-3 text-lg font-bold text-slate-900">Upcoming deliveries</h3>
      {upcoming.length === 0 ? (
        <DEmpty>No upcoming deliveries scheduled.</DEmpty>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((t) => (
            <DCard key={t._id}>
              <p className="text-xs text-slate-500">
                {new Date(t.expectedDelivery || t.startDate).toLocaleDateString()}
              </p>
              <p className="mt-1 font-semibold text-slate-900">{t.tripCode}</p>
              <p className="text-sm text-slate-600">
                {t.source} → {t.destination}
              </p>
              <div className="mt-2">
                <DBadge tone={TRIP_STATUS_TONE[t.status]}>{prettyStatus(t.status)}</DBadge>
              </div>
            </DCard>
          ))}
        </div>
      )}
    </div>
  );
}
