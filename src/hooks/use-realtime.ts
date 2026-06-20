import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { tripApi, type Trip, type TripNotification } from "@/lib/tripApi";
import type { DriverOption } from "@/lib/tripApi";

/**
 * Admin-side realtime: subscribes to row-level changes on the `trips` table.
 * Whenever a driver updates a trip's status (or any field), `onChange` fires
 * so the admin Trips table can refresh without a page reload.
 */
export function useTripRealtime(enabled: boolean, onChange: () => void) {
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("trips-realtime-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        () => cb.current(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}

/**
 * Driver-side realtime. Resolves the logged-in driver's `drivers` row from their
 * email (since the auth session is keyed by email), then:
 *  - loads trips assigned to them,
 *  - loads their trip_notifications (toast-style),
 *  - subscribes to `trips` + `trip_notifications` realtime channels filtered by
 *    driver_id so new assignments and status changes appear instantly.
 */
export function useDriverRealtime(driverEmail: string | null) {
  const [driver, setDriver] = useState<DriverOption | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [notifications, setNotifications] = useState<TripNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<TripNotification | null>(null);

  // Resolve the driver row from email.
  useEffect(() => {
    if (!driverEmail) return;
    let active = true;
    setLoading(true);
    tripApi
      .driverByEmail(driverEmail)
      .then((d) => {
        if (active) setDriver(d);
      })
      .catch((e) => active && setError((e as Error).message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [driverEmail]);

  // Load trips + notifications for this driver.
  const reload = useRef<() => void>(() => {});
  const loadDriverData = (d: DriverOption | null) => {
    if (!d) return;
    tripApi
      .tripsForDriver(d.id)
      .then(setTrips)
      .catch((e) => setError((e as Error).message));
    tripApi
      .notificationsForDriver(d.id)
      .then((n) => {
        setNotifications(n);
        const latestUnread = n.find((x) => !x.read);
        if (latestUnread) setLastEvent(latestUnread);
      })
      .catch((e) => setError((e as Error).message));
  };
  useEffect(() => {
    if (driver) loadDriverData(driver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver]);

  // Realtime subscriptions.
  useEffect(() => {
    if (!driver) return;
    const channelId = `driver-${driver.id}-realtime`;

    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
          filter: `assigned_driver_id=eq.${driver.id}`,
        },
        () => {
          tripApi
            .tripsForDriver(driver.id)
            .then(setTrips)
            .catch(() => {});
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trip_notifications",
          filter: `driver_id=eq.${driver.id}`,
        },
        (payload) => {
          const n = payload.new as TripNotification;
          setNotifications((prev) => [n, ...prev]);
          setLastEvent(n);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trip_notifications",
          filter: `driver_id=eq.${driver.id}`,
        },
        () => {
          tripApi
            .notificationsForDriver(driver.id)
            .then(setNotifications)
            .catch(() => {});
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "trip_notifications",
          filter: `driver_id=eq.${driver.id}`,
        },
        () => {
          tripApi
            .notificationsForDriver(driver.id)
            .then(setNotifications)
            .catch(() => {});
        },
      )
      .subscribe();

    reload.current = () => loadDriverData(driver);

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    driver,
    trips,
    notifications,
    unreadCount,
    loading,
    error,
    lastEvent,
    clearLastEvent: () => setLastEvent(null),
    reload: () => reload.current(),
  };
}
