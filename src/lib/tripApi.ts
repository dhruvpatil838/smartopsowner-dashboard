import { supabase } from "@/lib/supabase";

export type TripStatus =
  | "pending"
  | "assigned"
  | "started"
  | "in_transit"
  | "completed"
  | "cancelled";

export interface Trip {
  id: string;
  trip_code: string;
  pickup_location: string;
  drop_location: string;
  scheduled_date: string | null;
  assigned_driver_id: string | null;
  assigned_vehicle_id: string | null;
  distance_km: number | null;
  estimated_minutes: number | null;
  status: TripStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  drivers?: { id: string; full_name: string; driver_code: string } | null;
  vehicles?: { id: string; vehicle_number: string; model: string } | null;
}

export interface TripStatusEntry {
  id: string;
  trip_id: string;
  status: TripStatus;
  from_status: TripStatus | null;
  actor: string | null;
  note: string | null;
  created_at: string;
}

export interface TripInput {
  trip_code?: string;
  pickup_location: string;
  drop_location: string;
  scheduled_date?: string | null;
  assigned_driver_id?: string | null;
  assigned_vehicle_id?: string | null;
  distance_km?: number | null;
  estimated_minutes?: number | null;
  status?: TripStatus;
  notes?: string | null;
}

export interface TripListParams {
  search?: string;
  status?: TripStatus | "";
  sort?: "trip_code" | "scheduled_date" | "distance_km" | "estimated_minutes" | "created_at" | "status";
  ascending?: boolean;
  page?: number;
  pageSize?: number;
}

export interface TripListResult {
  rows: Trip[];
  total: number;
}

const TABLE = "trips";

export const STATUS_ORDER: TripStatus[] = [
  "pending",
  "assigned",
  "started",
  "in_transit",
  "completed",
  "cancelled",
];

const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  started: "Started",
  in_transit: "In Transit",
  completed: "Completed",
  cancelled: "Cancelled",
};

function nextCode(codes: string[]): string {
  let max = 0;
  for (const c of codes) {
    const m = /TRP-(\d+)/.exec(c);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `TRP-${String(max + 1).padStart(4, "0")}`;
}

export interface DriverOption {
  id: string;
  driver_code: string;
  full_name: string;
  email?: string | null;
}

export interface VehicleOption {
  id: string;
  vehicle_number: string;
  model: string;
}

export type TripNotificationType =
  | "trip_assigned"
  | "trip_unassigned"
  | "status_changed";

export interface TripNotification {
  id: string;
  driver_email: string | null;
  driver_id: string | null;
  trip_id: string | null;
  trip_code: string | null;
  type: TripNotificationType;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

export const tripApi = {
  async list(params: TripListParams = {}): Promise<TripListResult> {
    const {
      search = "",
      status = "",
      sort = "created_at",
      ascending = false,
      page = 1,
      pageSize = 10,
    } = params;

    let query = supabase
      .from(TABLE)
      .select(
        "*, drivers:assigned_driver_id(id, full_name, driver_code), vehicles:assigned_vehicle_id(id, vehicle_number, model)",
        { count: "exact" },
      );

    if (search.trim()) {
      const s = search.trim();
      query = query.or(
        `trip_code.ilike.%${s}%,pickup_location.ilike.%${s}%,drop_location.ilike.%${s}%,notes.ilike.%${s}%`,
      );
    }
    if (status) query = query.eq("status", status);

    query = query.order(sort, { ascending });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as unknown as Trip[], total: count ?? 0 };
  },

  async get(id: string): Promise<Trip | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(
        "*, drivers:assigned_driver_id(id, full_name, driver_code), vehicles:assigned_vehicle_id(id, vehicle_number, model)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as unknown as Trip | null;
  },

  async create(input: TripInput): Promise<Trip> {
    if (!input.trip_code) {
      const { data: existing } = await supabase.from(TABLE).select("trip_code");
      input.trip_code = nextCode((existing ?? []).map((r) => r.trip_code));
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert(input as never)
      .select(
        "*, drivers:assigned_driver_id(id, full_name, driver_code), vehicles:assigned_vehicle_id(id, vehicle_number, model)",
      )
      .single();
    if (error) throw new Error(error.message);
    const trip = data as unknown as Trip;

    // Record the initial status in the timeline.
    await supabase.from("trip_status_history").insert({
      trip_id: trip.id,
      status: trip.status,
      from_status: null,
      actor: "system",
      note: "Trip created",
    });

    return trip;
  },

  /** Internal update without the assignment/status side-effects of `update()`. */
  async directUpdate(id: string, patch: Partial<TripInput>): Promise<Trip> {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .select(
        "*, drivers:assigned_driver_id(id, full_name, driver_code), vehicles:assigned_vehicle_id(id, vehicle_number, model)",
      )
      .single();
    if (error) throw new Error(error.message);
    return data as unknown as Trip;
  },

  async update(id: string, patch: Partial<TripInput>): Promise<Trip> {
    // Fetch pre-update state so we can detect driver assignment changes and
    // notify the affected drivers (best-effort).
    const before = await this.get(id);
    const prevDriverId = before?.assigned_driver_id ?? null;
    const prevStatus = before?.status;

    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .select(
        "*, drivers:assigned_driver_id(id, full_name, driver_code), vehicles:assigned_vehicle_id(id, vehicle_number, model)",
      )
      .single();
    if (error) throw new Error(error.message);
    const updated = data as unknown as Trip;

    const newDriverId = updated.assigned_driver_id ?? null;

    // Driver assignment changed -> surface a realtime notification to the driver.
    if (newDriverId !== prevDriverId) {
      if (newDriverId) {
        await this.notifyDriver(
          updated,
          "trip_assigned",
          `New trip assigned: ${updated.trip_code}`,
          `Route ${updated.pickup_location} → ${updated.drop_location}. Scheduled ${updated.scheduled_date ?? "—"}.`,
        );
      } else if (prevDriverId && before) {
        // Driver was unassigned — notify them via their snapshot of the old record.
        await this.notifyDriver(before, "trip_unassigned", `Unassigned from ${updated.trip_code}`, undefined);
      }
    }

    // Status changed via update (e.g. admin editing) -> log + notify.
    if (patch.status && patch.status !== prevStatus && patch.status !== "pending") {
      await supabase.from("trip_status_history").insert({
        trip_id: id,
        status: patch.status,
        from_status: prevStatus ?? null,
        actor: "admin",
        note: "Updated via trip editor",
      });
      await this.notifyDriver(
        updated,
        "status_changed",
        `Trip ${updated.trip_code}: ${STATUS_LABEL[patch.status]}`,
      );
    }

    return updated;
  },

  /**
   * Notify the assigned driver about a trip change. Best-effort: a failure to
   * insert a notification must not break the trip operation that triggered it.
   */
  async notifyDriver(
    trip: Trip,
    type: "trip_assigned" | "trip_unassigned" | "status_changed",
    title: string,
    body?: string,
  ): Promise<void> {
    if (!trip.assigned_driver_id) return;
    const { error } = await supabase.from("trip_notifications").insert({
      driver_email: null,
      driver_id: trip.assigned_driver_id,
      trip_id: trip.id,
      trip_code: trip.trip_code,
      type,
      title,
      body: body ?? null,
    });
    if (error) {
      console.warn("[tripApi] Failed to notify driver:", error.message);
    }
  },
  async changeStatus(
    id: string,
    nextStatus: TripStatus,
    actor: string,
    note?: string,
  ): Promise<Trip> {
    const current = await this.get(id);
    if (!current) throw new Error("Trip not found.");

    const from = current.status;
    if (from === nextStatus) {
      return current;
    }

    const updated = await this.directUpdate(id, { status: nextStatus });

    const { error: histError } = await supabase.from("trip_status_history").insert({
      trip_id: id,
      status: nextStatus,
      from_status: from,
      actor,
      note: note ?? null,
    });
    if (histError) {
      console.warn("[tripApi] Failed to log status change:", histError.message);
    }

    // Realtime: the assigned driver sees the status change instantly.
    await this.notifyDriver(
      updated,
      "status_changed",
      `Trip ${updated.trip_code}: ${TRIP_STATUS_LABEL[nextStatus]}`,
      `Status changed from ${TRIP_STATUS_LABEL[from]} to ${TRIP_STATUS_LABEL[nextStatus]}${note ? ` — ${note}` : ""}.`,
    );

    return updated;
  },

  async cancel(id: string, actor: string, reason?: string): Promise<Trip> {
    return this.changeStatus(id, "cancelled", actor, reason);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async history(tripId: string): Promise<TripStatusEntry[]> {
    const { data, error } = await supabase
      .from("trip_status_history")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as TripStatusEntry[];
  },

  async driverOptions(): Promise<DriverOption[]> {
    const { data, error } = await supabase
      .from("drivers")
      .select("id, driver_code, full_name")
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async vehicleOptions(): Promise<VehicleOption[]> {
    const { data, error } = await supabase
      .from("vehicles")
      .select("id, vehicle_number, model")
      .order("vehicle_number", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /* -------- Driver-side notification API (realtime-backed) -------- */

  async driverByEmail(email: string): Promise<DriverOption | null> {
    const { data, error } = await supabase
      .from("drivers")
      .select("id, driver_code, full_name, email")
      .eq("email", email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as DriverOption | null) ?? null;
  },

  async notificationsForDriver(driverId: string): Promise<TripNotification[]> {
    const { data, error } = await supabase
      .from("trip_notifications")
      .select("*")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as TripNotification[];
  },

  async tripsForDriver(driverId: string): Promise<Trip[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(
        "*, drivers:assigned_driver_id(id, full_name, driver_code), vehicles:assigned_vehicle_id(id, vehicle_number, model)",
      )
      .eq("assigned_driver_id", driverId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Trip[];
  },

  async markNotificationRead(id: string): Promise<void> {
    const { error } = await supabase
      .from("trip_notifications")
      .update({ read: true })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  async markAllNotificationsRead(driverId: string): Promise<void> {
    const { error } = await supabase
      .from("trip_notifications")
      .update({ read: true })
      .eq("driver_id", driverId)
      .eq("read", false);
    if (error) throw new Error(error.message);
  },

  async deleteNotification(id: string): Promise<void> {
    const { error } = await supabase
      .from("trip_notifications")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
  },
};

